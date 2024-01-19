import { opentelemetry } from '../telemetry/opentelemetry';

export function getNotificationFailedCounter(): opentelemetry.Counter<{
  channel: string;
}> {
  const meter = opentelemetry.metrics.getMeter('api-bg');
  return meter.createCounter('notification_failed', {
    description:
      'Number of notifications failed to be sent via different channels',
  });
}
