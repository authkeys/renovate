import is from '@sindresorhus/is';

export function isTelemetryEnabled(): boolean {
  if (process.env.OTEL_SDK_DISABLED === 'true') {
    return false;
  }
  return isTraceDebuggingEnabled() || isTraceSendingEnabled() || isLogsSendingEnabled() || isMetricsSendingEnabled();
}

export function isTraceDebuggingEnabled(): boolean {
  return !!process.env.RENOVATE_TRACING_CONSOLE_EXPORTER;
}

export function isTraceSendingEnabled(): boolean {
  return !!process.env.OTEL_EXPORTER_OTLP_ENDPOINT || !!process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
}

export function isLogsSendingEnabled(): boolean {
  return process.env.OTEL_LOGS_ENABLED === 'true' && (!!process.env.OTEL_EXPORTER_OTLP_ENDPOINT || !!process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT);
}

export function isMetricsSendingEnabled(): boolean {
  return process.env.OTEL_METRICS_ENABLED === 'true' && (!!process.env.OTEL_EXPORTER_OTLP_ENDPOINT || !!process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT);
}

export function massageThrowable(e: unknown): string | undefined {
  if (is.nullOrUndefined(e)) {
    return undefined;
  }
  if (e instanceof Error) {
    return e.message;
  }
  return String(e);
}
