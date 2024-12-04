import { ClientRequest } from 'node:http';
import type {
  Context,
  Span,
  SpanOptions,
  Tracer,
  TracerProvider,
} from '@opentelemetry/api';
import * as api from '@opentelemetry/api';
import { SpanStatusCode } from '@opentelemetry/api';
import { BunyanInstrumentation } from '@opentelemetry/instrumentation-bunyan';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici';
import { Resource } from '@opentelemetry/resources';
import type { NodeSDKConfiguration } from '@opentelemetry/sdk-node';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import { ATTR_SERVICE_NAMESPACE } from '@opentelemetry/semantic-conventions/incubating';
import { pkg } from '../expose.cjs';
import {
  getLogRecordsProcessors, getMetricReader, getSpanProcessors
} from './signals-exporters-helper';
import {
  isLogsSendingEnabled,
  isMetricsSendingEnabled,
  isTelemetryEnabled,
  isTraceSendingEnabled,
  massageThrowable,
} from './utils';

let sdk: NodeSDK;

let otelSDKConfig: Partial<NodeSDKConfiguration> = {};

init();

export function init(): void {
  if (!isTelemetryEnabled()) {
    return;
  }

  otelSDKConfig = {
    instrumentations: [
      new UndiciInstrumentation(),
      new HttpInstrumentation({
        applyCustomAttributesOnSpan: /* istanbul ignore next */ (
          span,
          request,
          response,
        ) => {
          // ignore 404 errors when the branch protection of Github could not be found. This is expected if no rules are configured
          if (
            request instanceof ClientRequest &&
            request.host === `api.github.com` &&
            request.path.endsWith(`/protection`) &&
            response.statusCode === 404
          ) {
            span.setStatus({ code: SpanStatusCode.OK });
          }
        },
      }),
      new BunyanInstrumentation(),
    ],
    resource: new Resource({
      // https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/resource/semantic_conventions/README.md#semantic-attributes-with-sdk-provided-default-value
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? 'renovate',
      [ATTR_SERVICE_NAMESPACE]:
        process.env.OTEL_SERVICE_NAMESPACE ?? 'renovatebot.com',
      [ATTR_SERVICE_VERSION]: process.env.OTEL_SERVICE_VERSION ?? pkg.version,
    }),
  };

  if (isTraceSendingEnabled()) {
    otelSDKConfig.spanProcessors = getSpanProcessors();
  }

  if (isMetricsSendingEnabled()) {
    otelSDKConfig.metricReader = getMetricReader();
  }

  if (isLogsSendingEnabled()) {
    otelSDKConfig.logRecordProcessors = getLogRecordsProcessors();
  }

  sdk = new NodeSDK(otelSDKConfig);
  sdk.start();

}

/* istanbul ignore next */

// https://github.com/open-telemetry/opentelemetry-js-api/issues/34
export async function shutdown(): Promise<void> {
  if (sdk) {
    if (otelSDKConfig.metricReader) {
      await otelSDKConfig.metricReader.forceFlush();
    }
    await sdk.shutdown();
  }
}

/* istanbul ignore next */
export function disableInstrumentations(): void {
  // NEEDED?
}

export function getTracerProvider(): TracerProvider {
  return api.trace.getTracerProvider();
}

function getTracer(): Tracer {
  return getTracerProvider().getTracer('renovate');
}

export function instrument<F extends () => ReturnType<F>>(
  name: string,
  fn: F,
): ReturnType<F>;
export function instrument<F extends () => ReturnType<F>>(
  name: string,
  fn: F,
  options: SpanOptions,
): ReturnType<F>;
export function instrument<F extends () => ReturnType<F>>(
  name: string,
  fn: F,
  options: SpanOptions = {},
  context: Context = api.context.active(),
): ReturnType<F> {
  return getTracer().startActiveSpan(name, options, context, (span: Span) => {
    try {
      const ret = fn();
      if (ret instanceof Promise) {
        return ret
          .catch((e) => {
            span.recordException(e);
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: massageThrowable(e),
            });
            throw e;
          })
          .finally(() => span.end()) as ReturnType<F>;
      }
      span.end();
      return ret;
    } catch (e) {
      span.recordException(e);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: massageThrowable(e),
      });
      span.end();
      throw e;
    }
  });
}
