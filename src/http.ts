import { Agent, type RequestInit } from 'undici';

const agent = new Agent({
  keepAliveTimeout: 5000,
});

export type { RequestInit };

export const fetchOptions: RequestInit = {
  dispatcher: agent,
};
