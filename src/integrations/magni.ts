import fetch from 'node-fetch';
import { fetchOptions } from '../http';
import { ValidationError } from 'apollo-server-errors';

export const magniOrigin = process.env.MAGNI_ORIGIN;

export interface SearchResultFeedback {
  chunkId: string;
  value: number;
}

export interface SearchSessionHistory {
  id: string;
  prompt: string;
  createdAt: string;
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

interface SearchChunkError {
  message: string;
  code: string;
}

interface SearchChunkSource {
  id: string;
  title: string;
  snippet: string;
  url: string;
}

interface SearchChunk {
  id: string;
  prompt: string;
  response: string; // markdown
  error: SearchChunkError;
  createdAt: string;
  completedAt: string;
  feedback: number;
  sources: SearchChunkSource[];
}

export interface Search {
  id: string;
  createdAt: string;
  chunks: SearchChunk[];
}

export const getSession = async (
  userId: string,
  sessionId: string,
): Promise<Search> => {
  const url = `${magniOrigin}/sessions?id=${sessionId}`;
  const res = await fetch(url, {
    ...fetchOptions,
    headers: { 'X-User-Id': userId },
  });

  if (!res.ok) throw new ValidationError(await res.text());

  return res.json();
};
