import { randomUUID } from 'crypto';
import { customAlphabet } from 'nanoid/async';
import { FastifyRequest } from 'fastify';
import { counters } from './telemetry';

const alphabet =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
export const generateLongId = customAlphabet(alphabet, 21);
export const generateShortId = customAlphabet(alphabet, 9);
export const generateVerifyCode = customAlphabet('1234567890', 6);
export const generateUUID = () => randomUUID();

export const generateTrackingId = (
  req: FastifyRequest,
  origin: string,
): Promise<string> => {
  counters?.api?.generateTrackingId?.add(1, { origin });
  return generateLongId();
};
