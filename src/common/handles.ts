import { handleRegex, validateRegex } from './object';
import { DataSource, EntityManager } from 'typeorm';
import { checkDisallowHandle } from '../entity/DisallowHandle';
import { ValidationError } from 'apollo-server-errors';

const minUsernameLength = 3;
const getHandleTooShortError = (key: string): ValidationError =>
  new ValidationError(JSON.stringify({ [key]: `${key} is too short` }));

export async function validateAndTransformHandle(
  handle: string | undefined,
  key: string,
  entityManager: DataSource | EntityManager,
): Promise<string> {
  const transformed = handle
    ? handle.toLowerCase().replace('@', '').trim()
    : '';

  if (
    key === 'username' &&
    transformed.length > 0 &&
    transformed.length < minUsernameLength
  ) {
    throw getHandleTooShortError(key);
  }

  validateRegex([[key, transformed, handleRegex, true]]);
  const disallowHandle = await checkDisallowHandle(entityManager, transformed);
  if (disallowHandle) {
    throw new ValidationError(
      JSON.stringify({ handle: 'handle is already used' }),
    );
  }
  return transformed;
}
