import { generateTrackingId } from '../ids';
import { retryFetch } from './retry';

const generateEventId = (now) => {
  const randomStr = (Math.random() + 1).toString(36).substring(8);
  const timePart = (now.getTime() / 1000).toFixed(0);
  return `${timePart}${randomStr}`;
};

export async function sendAnalyticsEvent<
  T extends { event_name: string; event_timestamp: Date; user_id: string },
>(events: T[]): Promise<void> {
  const now = new Date();
  const [visit_id, session_id] = await Promise.all([
    generateTrackingId(),
    generateTrackingId(),
  ]);
  const transformed = events.map((event) => ({
    event_id: generateEventId(now),
    visit_id,
    session_id,
    ...event,
  }));
  await retryFetch(
    `${process.env.ANALYTICS_URL}/e`,
    {
      method: 'POST',
      body: JSON.stringify({ events: transformed }),
      headers: {
        'content-type': 'application/json',
      },
    },
    { retries: 3 },
  );
}
