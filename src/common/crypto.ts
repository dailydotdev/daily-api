import { webcrypto as crypto } from 'node:crypto';

const bufToBase64 = (x: ArrayBuffer) => Buffer.from(x).toString('base64');

export const encrypt = async (
  input: string,
  key: string,
  algorithmName = 'AES-CBC',
  algorithmLength = 256,
  ivLength = 16,
): Promise<string> => {
  const keyObject = await crypto.subtle.importKey(
    'raw',
    Buffer.from(key, 'utf-8'),
    {
      name: algorithmName,
      length: algorithmLength,
    },
    true,
    ['encrypt', 'decrypt'],
  );
  const iv = crypto.getRandomValues(new Uint8Array(ivLength));
  const encrypted = await crypto.subtle.encrypt(
    {
      name: algorithmName,
      iv,
    },
    keyObject,
    new TextEncoder().encode(input),
  );
  return bufToBase64(iv) + ':' + bufToBase64(encrypted);
};

export const decrypt = async (
  input: string,
  key: string,
  algorithmName = 'AES-CBC',
  algorithmLength = 256,
): Promise<string> => {
  const keyObject = await crypto.subtle.importKey(
    'raw',
    Buffer.from(key, 'utf-8'),
    {
      name: algorithmName,
      length: algorithmLength,
    },
    true,
    ['encrypt', 'decrypt'],
  );

  const [iv, encrypted] = input.split(':').map((x) => Buffer.from(x, 'base64'));

  const decrypted = await crypto.subtle.decrypt(
    {
      name: algorithmName,
      iv,
    },
    keyObject,
    encrypted,
  );
  return new TextDecoder().decode(decrypted);
};
