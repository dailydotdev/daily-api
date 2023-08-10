import fetch, { Response } from 'node-fetch';
import { fetchOptions } from '../http';
import { FastifyRequest } from 'fastify';

const magniOrigin = process.env.MAGNI_ORIGIN;

export const postFeedback = async (req: FastifyRequest): Promise<Response> =>
  fetch(`${magniOrigin}/feedback`, {
    ...fetchOptions,
    method: 'post',
    body: JSON.stringify(req.params),
    headers: {
      cookie: req.headers.cookie,
      'Content-Type': 'application/json',
    },
  });
