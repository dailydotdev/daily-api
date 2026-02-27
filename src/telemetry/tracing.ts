import type { Message } from '@google-cloud/pubsub';

import { type Span } from '@opentelemetry/api';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';

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
    [ATTR_MESSAGING_SYSTEM]: 'gcp_pubsub',
    [ATTR_MESSAGING_DESTINATION_NAME]: subscription,
    [ATTR_MESSAGING_MESSAGE_ID]: message.id,
    [ATTR_MESSAGING_MESSAGE_BODY_SIZE]: message.data?.length || 0,
  });
};

export const createSpanProcessor = (): BatchSpanProcessor => {
  const traceExporter = new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  });

  return new BatchSpanProcessor(traceExporter, {
    maxQueueSize: 4096,
    maxExportBatchSize: 512,
    scheduledDelayMillis: 5000,
    exportTimeoutMillis: 30000,
  });
};
