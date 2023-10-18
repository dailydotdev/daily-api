import { handleRegex, validateRegex } from './object';
import { DataSource, EntityManager } from 'typeorm';
import { checkDisallowHandle } from '../entity/DisallowHandle';
import { ValidationError } from 'apollo-server-errors';

export async function validateAndTransformHandle(
  handle: string | undefined,
  key: string,
  entityManager: DataSource | EntityManager,
): Promise<string> {
  const transformed = handle?.toLowerCase().replace('@', '').trim();
  validateRegex([[key, transformed, handleRegex, true]]);
  const disallowHandle = await checkDisallowHandle(entityManager, transformed);
  if (disallowHandle) {
    throw new ValidationError(
      JSON.stringify({ handle: 'handle is already used' }),
    );
  }
  return transformed;
}
