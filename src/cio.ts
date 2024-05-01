import { TrackClient } from 'customerio-node';

export const cio = new TrackClient(
  process.env.CIO_SITE_ID,
  process.env.CIO_API_KEY,
);

export function dateToCioTimestamp(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}
