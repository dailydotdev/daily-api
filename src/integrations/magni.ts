import fetch, { Response } from 'node-fetch';
import { fetchOptions } from '../http';

const magniOrigin = process.env.MAGNI_ORIGIN;

export interface SearchResultFeedback {
  chunkId: string;
  value: number;
}

export const postFeedback = async (
  userId: string,
  params: SearchResultFeedback,
): Promise<Response> =>
  fetch(`${magniOrigin}/feedback`, {
    ...fetchOptions,
    method: 'post',
    body: JSON.stringify(params),
    headers: {
      'X-User-Id': userId,
      'Content-Type': 'application/json',
    },
  });
