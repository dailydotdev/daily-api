import type { FastifyReply, FastifyRequest } from 'fastify';

export const getClientIp = (request: FastifyRequest): string =>
  (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
  request.ip;

export const toRequestUrl = (request: FastifyRequest): URL => {
  const protocol = request.headers['x-forwarded-proto'] ?? 'http';
  const host = request.headers.host ?? 'localhost';
  return new URL(request.url, `${String(protocol)}://${host}`);
};

export const toHeaders = (
  headersObj: FastifyRequest['headers'],
  contentType?: string,
): Headers => {
  const headers = new Headers();
  const skipHeaders = new Set(['content-length', 'transfer-encoding']);
  Object.entries(headersObj).forEach(([key, value]) => {
    if (!value || skipHeaders.has(key.toLowerCase())) {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry) => headers.append(key, entry));
      return;
    }
    headers.set(key, value);
  });

  if (contentType) {
    headers.set('content-type', contentType);
  }

  return headers;
};

const toRequestBody = (
  request: FastifyRequest,
): { body?: string; contentType?: string } => {
  if (request.body === undefined || request.body === null) {
    return {};
  }

  const incomingContentType = request.headers['content-type'] ?? '';
  const isFormEncoded = incomingContentType.includes(
    'application/x-www-form-urlencoded',
  );

  if (isFormEncoded) {
    if (typeof request.body === 'object') {
      return {
        body: new URLSearchParams(
          request.body as Record<string, string>,
        ).toString(),
      };
    }
    return { body: String(request.body) };
  }

  return {
    body: JSON.stringify(request.body),
    contentType: 'application/json',
  };
};

export const buildBetterAuthRequest = (
  request: FastifyRequest,
  overrideUrl?: string,
  overrideBody?: string,
): Request => {
  const requestBody = toRequestBody(request);
  const headers = toHeaders(request.headers, requestBody.contentType);
  const url = overrideUrl ?? toRequestUrl(request).toString();
  const body = overrideBody ?? requestBody.body;
  return new Request(url, {
    method: request.method,
    headers,
    ...(body ? { body } : {}),
  });
};

export const copyResponseHeaders = (
  reply: FastifyReply,
  response: Response,
): void => {
  const nodeHeaders = response.headers as Headers & {
    getSetCookie?: () => string[];
  };

  response.headers.forEach((value, key) => {
    if (key.toLowerCase() !== 'set-cookie') {
      void reply.header(key, value);
    }
  });

  const setCookies = nodeHeaders.getSetCookie?.() ?? [];
  if (setCookies.length > 0) {
    void reply.header('set-cookie', setCookies);
  }
};
