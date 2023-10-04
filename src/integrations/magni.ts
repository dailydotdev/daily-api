import { fetchOptions } from '../http';
import { retryFetch } from './retry';

export const magniOrigin = process.env.MAGNI_ORIGIN;

export interface SearchResultFeedback {
  chunkId: string;
  value: number;
}

export interface SearchSession {
  id: string;
  prompt: string;
  createdAt: string;
}

export const postFeedback = async (
  userId: string,
  params: SearchResultFeedback,
): Promise<void> => {
  await retryFetch(`${magniOrigin}/feedback`, {
    ...fetchOptions,
    method: 'post',
    body: JSON.stringify(params),
    headers: {
      'X-User-Id': userId,
      'Content-Type': 'application/json',
    },
  });
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
  const res = await retryFetch<SessionResponse>(url, {
    ...fetchOptions,
    headers: { 'X-User-Id': userId },
  });

  return res.sessions;
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
  createdAt: Date;
  completedAt: Date;
  feedback: number;
  sources: SearchChunkSource[];
}

export interface Search {
  id: string;
  createdAt: Date;
  chunks: SearchChunk[];
}

export const getSession = async (
  userId: string,
  sessionId: string,
): Promise<Search> => {
  const url = `${magniOrigin}/session?id=${sessionId}`;
  return retryFetch(url, {
    ...fetchOptions,
    headers: { 'X-User-Id': userId },
  });
};
