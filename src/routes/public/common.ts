/**
 * Shared constants and utilities for the public API routes.
 */

export const MAX_LIMIT = 50;
export const DEFAULT_LIMIT = 20;

/**
 * Parse and validate a limit query parameter.
 * @param limitParam - The limit query string parameter
 * @returns A valid limit between 1 and MAX_LIMIT
 */
export const parseLimit = (limitParam?: string): number => {
  const parsed = parseInt(limitParam || '', 10) || DEFAULT_LIMIT;
  return Math.min(Math.max(1, parsed), MAX_LIMIT);
};

/**
 * Ensure the database connection is initialized.
 * @param con - The database connection from fastify
 * @throws Error if connection is not initialized
 */
export const ensureDbConnection = <T>(con: T | undefined): T => {
  if (!con) {
    throw new Error('Database connection not initialized');
  }
  return con;
};
