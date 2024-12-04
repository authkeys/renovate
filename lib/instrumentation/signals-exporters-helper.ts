import { OTLPLogExporter as OTLPLogExporterGrpc } from '@opentelemetry/exporter-logs-otlp-grpc';
import { OTLPLogExporter as OTLPLogExporterHttp } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPLogExporter as OTLPLogExporterProto } from '@opentelemetry/exporter-logs-otlp-proto';
import { OTLPMetricExporter as OTLPMetricExporterGrpc } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { OTLPMetricExporter as OTLPMetricExporterHttp } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPMetricExporter as OTLPMetricExporterProto } from '@opentelemetry/exporter-metrics-otlp-proto';
import { OTLPTraceExporter as OTLPTraceExporterGrpc } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPTraceExporter as OTLPTraceExporterHttp } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPTraceExporter as OTLPTraceExporterProto } from '@opentelemetry/exporter-trace-otlp-proto';
import type {
  LogRecordProcessor} from '@opentelemetry/sdk-logs';
import {
  BatchLogRecordProcessor,
  ConsoleLogRecordExporter, NoopLogRecordProcessor,
  SimpleLogRecordProcessor
} from '@opentelemetry/sdk-logs';
import type { MetricReader } from '@opentelemetry/sdk-metrics';
import { ConsoleMetricExporter, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import type {
  SpanProcessor } from '@opentelemetry/sdk-trace-base';
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  NoopSpanProcessor,
  SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { MultiPushMetricExporter } from './multi-push-metrics-exporter';

type ObjectValues<T> = T[keyof T];

const SIGNAL = {
  TRACES: 'traces',
  METRICS: 'metrics',
  LOGS: 'logs',
} as const;

type SignalType = ObjectValues<typeof SIGNAL>;

const EXPORTER = {
  OTLP: 'otlp',
  CONSOLE: 'console',
  NONE: 'none'
} as const;

const PROTOCOL = {
  GRPC: 'grpc',
  HTTP_JSON: 'http/json',
  HTTP_PROTOBUF: 'http/protobuf',
} as const;

type ProtocolType = ObjectValues<typeof PROTOCOL>;

const globalProtocol =
  process.env.OTEL_EXPORTER_OTLP_PROTOCOL ?? PROTOCOL.HTTP_PROTOBUF;

const signalsProtocolExporterClasses = {
  traces: {
    otlp: {
      grpc: OTLPTraceExporterGrpc,
      'http/json': OTLPTraceExporterHttp,
      'http/protobuf': OTLPTraceExporterProto,
    },
    console: ConsoleSpanExporter,
  },
  metrics: {
    otlp: {
      grpc: OTLPMetricExporterGrpc,
      'http/json': OTLPMetricExporterHttp,
      'http/protobuf': OTLPMetricExporterProto,
    },
    console: ConsoleMetricExporter,
  },
  logs: {
    otlp: {
      grpc: OTLPLogExporterGrpc,
      'http/json': OTLPLogExporterHttp,
      'http/protobuf': OTLPLogExporterProto,
    },
    console: ConsoleLogRecordExporter,
  },
};

function getOtlpExporterClass<T>(signal: SignalType, protocol: ProtocolType): T {
  if (protocol in signalsProtocolExporterClasses[signal].otlp) {
    return signalsProtocolExporterClasses[signal].otlp[protocol] as T;
  }
  throw new Error(`Unsupported ${signal} exporter protocol: ${protocol}`);
}

function getOTLPExporterTraceClass():
  | typeof OTLPTraceExporterGrpc
  | typeof OTLPTraceExporterHttp
  | typeof OTLPTraceExporterProto {
  return getOtlpExporterClass(
    SIGNAL.TRACES,
    (process.env.OTEL_EXPORTER_OTLP_TRACES_PROTOCOL as ProtocolType) ??
      globalProtocol,
  );
}

function getOTLPExporterMetricsClass():
  | typeof OTLPMetricExporterGrpc
  | typeof OTLPMetricExporterHttp
  | typeof OTLPMetricExporterProto {
  return getOtlpExporterClass(
    SIGNAL.METRICS,
    (process.env.OTEL_EXPORTER_OTLP_METRICS_PROTOCOL as ProtocolType) ??
      globalProtocol,
  );
}

function getOTLPExporterLogsClass():
  | typeof OTLPLogExporterGrpc
  | typeof OTLPLogExporterHttp
  | typeof OTLPLogExporterProto {
  return getOtlpExporterClass(
    SIGNAL.LOGS,
    (process.env.OTEL_EXPORTER_OTLP_LOGS_PROTOCOL as ProtocolType) ??
      globalProtocol,
  );
}

function getUniqueExporters(exporters: string): string[] {
  return exporters.split(',').map((e) => e.trim()).filter((e) => !!e).reduce((acc, curr) => {
    if (acc.includes(curr)) {
      return acc;
    }
    return [...acc, curr];
  }, [] as string[]);
}

export function getSpanProcessors(): SpanProcessor[] {
  let _exporters = process.env.OTEL_TRACES_EXPORTER ?? EXPORTER.OTLP;
  // honor the old RENOVATE_TRACING_CONSOLE_EXPORTER env var
  if (process.env.RENOVATE_TRACING_CONSOLE_EXPORTER) {
    _exporters += `,${EXPORTER.CONSOLE}`;
  }
  const exporters = getUniqueExporters(_exporters);
  if (exporters.length === 0 || exporters.includes(EXPORTER.NONE)) {
    return [];
  }
  return exporters.map((exporter) => {
    if (exporter === EXPORTER.NONE) {
      return new NoopSpanProcessor();
    }
    if (exporter === EXPORTER.CONSOLE) {
      return new SimpleSpanProcessor(new (signalsProtocolExporterClasses[SIGNAL.TRACES].console as any)());
    }
    if (exporter === EXPORTER.OTLP) {
      return new BatchSpanProcessor(new (getOTLPExporterTraceClass() as any)());
    }
    return new NoopSpanProcessor();
  });
}

export function getMetricReader(): MetricReader | undefined {
  const _exporters = process.env.OTEL_METRICS_EXPORTER ?? EXPORTER.OTLP;
  const exporters = getUniqueExporters(_exporters);
  if (exporters.length === 0 || exporters.includes(EXPORTER.NONE)) {
    return;
  }
  if (exporters.length === 1) {
    if (exporters[0] === EXPORTER.OTLP) {
      return new PeriodicExportingMetricReader({
        exporter: new (getOTLPExporterMetricsClass() as any)(),
      });
    }
    if (exporters[0] === EXPORTER.CONSOLE) {
      return new PeriodicExportingMetricReader({
        exporter: new ConsoleMetricExporter(),
      });
    }
    return ;
  }
  const exportersInstances = exporters.map((exporter) => {
    if (exporter === EXPORTER.CONSOLE) {
      return new ConsoleMetricExporter();
    }
    if (exporter === EXPORTER.OTLP) {
      return new (getOTLPExporterMetricsClass() as any)();
    }
    return new ConsoleMetricExporter();
  });
  return new PeriodicExportingMetricReader({
    exporter: new MultiPushMetricExporter(exportersInstances),
  });
}

export function getLogRecordsProcessors(): LogRecordProcessor[] {
  const _exporters = process.env.OTEL_LOGS_EXPORTER ?? EXPORTER.OTLP;
  const exporters = getUniqueExporters(_exporters);
  if (exporters.length === 0 || exporters.includes(EXPORTER.NONE)) {
    return [];
  }
  return exporters.map((exporter) => {
    if (exporter === EXPORTER.NONE) {
      return new NoopLogRecordProcessor();
    }
    if (exporter === EXPORTER.CONSOLE) {
      return new SimpleLogRecordProcessor(new (signalsProtocolExporterClasses[SIGNAL.LOGS].console as any)());
    }
    if (exporter === EXPORTER.OTLP) {
      return new BatchLogRecordProcessor(new (getOTLPExporterLogsClass() as any)());
    }
    return new NoopLogRecordProcessor();
  });
}
