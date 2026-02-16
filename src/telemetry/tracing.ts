import type { FastifyInstance } from 'fastify';
import type { Message } from '@google-cloud/pubsub';

import dc from 'node:diagnostics_channel';

import {
  trace,
  context,
  type Span,
  type SpanOptions,
  SpanStatusCode,
} from '@opentelemetry/api';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';

import { type AppVersionRequest, channelName } from './common';
import { addApiSpanLabels } from './register';
import {
  ATTR_MESSAGING_DESTINATION_NAME,
  ATTR_MESSAGING_MESSAGE_BODY_SIZE,
  ATTR_MESSAGING_MESSAGE_ID,
  ATTR_MESSAGING_SYSTEM,
  // @ts-expect-error - no longer resolves types because of cjs/esm change but values are exported
} from '@opentelemetry/semantic-conventions/incubating';

export const addPubsubSpanLabels = (
  span: Span,
  subscription: string,
  message: Message | { id: string; data?: Buffer },
): void => {
  span.setAttributes({
    [ATTR_MESSAGING_SYSTEM]: 'pubsub',
    [ATTR_MESSAGING_DESTINATION_NAME]: subscription,
    [ATTR_MESSAGING_MESSAGE_ID]: message.id,
    [ATTR_MESSAGING_MESSAGE_BODY_SIZE]: message.data?.length || 0,
  });
};

export const subscribeTracingHooks = (serviceName: string): void => {
  dc.subscribe(channelName, (message) => {
    const { fastify } = message as { fastify: FastifyInstance };
    fastify.decorate('tracer', trace.getTracer(serviceName));
    fastify.decorateRequest('span');

    fastify.addHook('onRequest', async (req) => {
      req.span = trace.getSpan(context.active());
    });

    // Decorate the main span with some metadata
    fastify.addHook('onResponse', async (req: AppVersionRequest) => {
      if (req?.span?.isRecording()) {
        addApiSpanLabels(req.span, req);
      }
    });
  });
};

export const createSpanProcessor = (): BatchSpanProcessor => {
  const traceExporter = new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  });

  return new BatchSpanProcessor(traceExporter);
};

export const runInSpan = async <T>(
  name: string,
  func: (span: Span) => Promise<T>,
  options?: SpanOptions,
): Promise<T> =>
  trace
    .getTracer('runInSpan')
    .startActiveSpan(name, options ?? {}, async (span) => {
      try {
        return await func(span);
      } catch (originalError) {
        const err = originalError as Error;

        span.recordException(err);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: err?.message,
        });
        throw err;
      } finally {
        span.end();
      }
    }) as T;

export const runInSpanSync = <T>(
  name: string,
  func: (span: Span) => T,
  options?: SpanOptions,
): T =>
  trace.getTracer('runInSpan').startActiveSpan(name, options ?? {}, (span) => {
    try {
      return func(span);
    } catch (originalError) {
      const err = originalError as Error;

      span.recordException(err);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err?.message,
      });
      throw err;
    } finally {
      span.end();
    }
  }) as T;

export const runInRootSpan = async <T>(
  name: string,
  func: (span: Span) => Promise<T>,
  options?: SpanOptions,
): Promise<T> => runInSpan(name, func, { ...options, root: true });

export const runInRootSpanSync = <T>(
  name: string,
  func: (span: Span) => T,
  options?: SpanOptions,
): T => runInSpanSync(name, func, { ...options, root: true });
