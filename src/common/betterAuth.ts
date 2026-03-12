import type { FastifyRequest } from 'fastify';

export const toRequestUrl = (request: FastifyRequest): URL => {
  const protocol = request.headers['x-forwarded-proto'] ?? 'http';
  const host = request.headers.host ?? 'localhost';
  return new URL(request.url, `${String(protocol)}://${host}`);
};
