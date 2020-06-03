import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

export const encrypt = (
  input: string,
  key: string,
  algorithm = 'aes256',
  ivLength = 16,
): string => {
  const iv = randomBytes(ivLength);
  const cipher = createCipheriv(algorithm, key, iv);
  const ciphered = cipher.update(input, 'utf8', 'hex') + cipher.final('hex');
  return `${iv.toString('hex')}:${ciphered}`;
};

export const decrypt = (
  input: string,
  key: string,
  algorithm = 'aes256',
): string => {
  const components = input.split(':');
  const iv = Buffer.from(components.shift(), 'hex');
  const decipher = createDecipheriv(algorithm, key, iv);
  const deciphered = decipher.update(components.join(':'), 'hex', 'utf8');
  return deciphered + decipher.final('utf8');
};
