import fetch from 'node-fetch';
import { base64 } from './base64';

export const addOrRemoveSuperfeedrSubscription = async (
  rss: string,
  topic: string,
  operation: 'subscribe' | 'unsubscribe',
): Promise<void> => {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const params = new URLSearchParams();
  params.append('hub.mode', operation);
  params.append('hub.topic', rss);
  params.append('hub.callback', `${process.env.WEBHOOK_URL}/${topic}`);
  params.append('hub.secret', process.env.WEBHOOK_SECRET);
  params.append('format', 'json');
  const auth = `Basic ${base64(
    `${process.env.SUPERFEEDR_USER}:${process.env.SUPERFEEDR_PASS}`,
  )}`;
  const res = await fetch('https://push.superfeedr.com/', {
    method: 'POST',
    body: params,
    headers: {
      authorization: auth,
    },
  });
  if (res.status >= 200 && res.status < 300) {
    return;
  }

  throw res;
};
