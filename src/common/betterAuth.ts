import type { FastifyRequest } from 'fastify';
export const toRequestUrl = (request: FastifyRequest): URL =>
  new URL(request.url, `${request.protocol}://${request.host}`);
