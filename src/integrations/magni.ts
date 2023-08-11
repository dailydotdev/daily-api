import fetch, { Response } from 'node-fetch';
import { fetchOptions } from '../http';
import { ValidationError } from 'apollo-server-errors';

const magniOrigin = process.env.MAGNI_ORIGIN;

export interface SearchResultFeedback {
  chunkId: string;
  value: number;
}

export interface SearchSessionHistory {
  id: string;
  prompt: string;
  createdAt: Date;
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

interface SessionResponse {
  sessions: SearchSessionHistory[];
}

export const getSessions = async (
  userId: string,
  limit = 30,
  lastId?: string,
): Promise<SearchSessionHistory[]> => {
  const params = new URLSearchParams({ limit: limit.toString() });

  if (lastId) params.append('lastId', lastId);

  const res = await fetch(`${magniOrigin}/feedback`, {
    ...fetchOptions,
    method: 'get',
    headers: {
      'X-User-Id': userId,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) throw new ValidationError(await res.text());

  const json: SessionResponse = await res.json();

  return json.sessions;
};
