/**
 * Shared helper used by domain-specific mock modules under `src/mocks/`.
 */
export const isMockEnabled = (): boolean =>
  process.env.MOCK_EXTERNAL_SERVICES === 'true';
