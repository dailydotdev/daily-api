import { randomUUID } from 'crypto';
import { customAlphabet } from 'nanoid/async';

const alphabet =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
export const generateTrackingId = customAlphabet(alphabet, 21);
export const generateShortId = customAlphabet(alphabet, 9);
export const generateUUID = () => randomUUID();
