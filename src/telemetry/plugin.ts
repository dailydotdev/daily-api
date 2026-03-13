import type { FastifyPluginCallback, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import {
  trace,
  context,
  type Span,
  SpanStatusCode,
  type Tracer,
  type Context,
  type TextMapSetter,
  type TextMapGetter,
  propagation,
} from '@opentelemetry/api';

import { getRPCMetadata, RPCType } from '@opentelemetry/core';
import {
  ATTR_HTTP_RESPONSE_STATUS_CODE,
  ATTR_HTTP_ROUTE,
} from '@opentelemetry/semantic-conventions';

const kRequestSpan = Symbol('fastify otel request span');
const kRequestContext = Symbol('fastify otel request context');
const kRequestContextValue = Symbol('fastify otel request context value');

export interface OpenTelemetry {
  span: Span | null;
  tracer: Tracer;
  context: Context;
  inject: <C>(carrier: C, setter?: TextMapSetter<C>) => void;
  extract: <C>(carrier: C, getter?: TextMapGetter<C>) => Context;
}

export interface FastifyOtelPluginOptions {
  tracer?: Tracer;
}

declare module 'fastify' {
  interface FastifyRequest {
    opentelemetry(): OpenTelemetry;
    [kRequestSpan]: Span | null;
    [kRequestContext]: Context;
    [kRequestContextValue]: Context | null;
  }
}

const plugin: FastifyPluginCallback<FastifyOtelPluginOptions> = async (
  instance,
  opts,
) => {
  const tracer = opts.tracer ?? trace.getTracer('fastify-otel');

  instance.decorateRequest(
    'opentelemetry',
    function opentelemetry(this: FastifyRequest): OpenTelemetry {
      const ctx = this[kRequestContext];
      const span = this[kRequestSpan];

      return {
        span,
        tracer,
        context: ctx,
        inject: (carrier, setter) => propagation.inject(ctx, carrier, setter),
        extract: (carrier, getter) => propagation.extract(ctx, carrier, getter),
      };
    },
  );
  instance.decorateRequest(kRequestSpan, null);
  instance.decorateRequest(kRequestContextValue, null);
  instance.decorateRequest(kRequestContext, {
    getter(this: FastifyRequest) {
      return this[kRequestContextValue] ?? context.active();
    },
    setter(this: FastifyRequest, value: Context) {
      this[kRequestContextValue] = value;
    },
  });

  instance.addHook('onRequest', async (request) => {
    const requestPath = request.routeOptions.url;
    let ctx = context.active();

    if (trace.getSpan(ctx) == null) {
      ctx = propagation.extract(ctx, request.headers);
    }

    const span = trace.getSpan(ctx);

    if (span != null && requestPath != null) {
      span.setAttributes({
        [ATTR_HTTP_ROUTE]: requestPath,
      });

      span.updateName(`${request.method} ${requestPath}`);

      const rpcMetadata = getRPCMetadata(ctx);
      if (rpcMetadata?.type === RPCType.HTTP) {
        rpcMetadata.route = requestPath;
      }
    }

    request[kRequestContext] = ctx;
    request[kRequestSpan] = span ?? null;
  });

  instance.addHook('onSend', (request, reply, payload, done) => {
    const span = request[kRequestSpan];

    if (span != null) {
      if (reply.statusCode >= 500) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: `HTTP ${reply.statusCode}`,
        });
      } else {
        span.setStatus({
          code: SpanStatusCode.OK,
          message: 'OK',
        });
      }
      span.setAttributes({
        [ATTR_HTTP_RESPONSE_STATUS_CODE]: reply.statusCode,
      });
    }

    request[kRequestSpan] = null;
    done(null, payload);
  });

  instance.addHook('onError', async (request, _, error) => {
    const span = request[kRequestSpan];

    if (span != null) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.recordException(error);
    }
  });
};

export default fp(plugin, {
  name: 'opentelemetry',
});
