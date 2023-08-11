import fetch, { Response } from 'node-fetch';
import { fetchOptions } from '../http';
import { ValidationError } from 'apollo-server-errors';

export const magniOrigin = process.env.MAGNI_ORIGIN;

export interface SearchResultFeedback {
  chunkId: string;
  value: number;
}

export interface SearchSession {
  id: string;
  prompt: string;
  createdAt: Date;
}

export const postFeedback = async (
  userId: string,
  params: SearchResultFeedback,
): Promise<void> => {
  const res = await fetch(`${magniOrigin}/feedback`, {
    ...fetchOptions,
    method: 'post',
    body: JSON.stringify(params),
    headers: {
      'X-User-Id': userId,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) throw new ValidationError(await res.text());
};

interface SessionResponse {
  sessions: SearchSession[];
}

export interface SearchSessionParams {
  limit?: number;
  lastId?: string;
}

export const getSessions = async (
  userId: string,
  { limit = 30, lastId }: SearchSessionParams = {},
): Promise<SearchSession[]> => {
  const params = new URLSearchParams({ limit: limit.toString() });

  if (lastId) params.append('lastId', lastId);

  const url = `${magniOrigin}/sessions?${params.toString()}`;
  const res = await fetch(url, {
    ...fetchOptions,
    headers: { 'X-User-Id': userId },
  });

  if (!res.ok) throw new ValidationError(await res.text());

  const json: SessionResponse = await res.json();

  return json.sessions;
};
