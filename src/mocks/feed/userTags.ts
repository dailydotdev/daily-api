/**
 * Mock response for the feed service `/api/user_tags` endpoint.
 * Returns a static list when `MOCK_EXTERNAL_SERVICES=true` is set in env.
 */
const MOCK_USER_TAGS = [
  'javascript',
  'typescript',
  'react',
  'nodejs',
  'backend',
  'frontend',
  'css',
  'database',
  'observability',
  'architecture',
  'python',
  'go',
  'rust',
  'docker',
  'kubernetes',
  'graphql',
  'testing',
  'security',
  'devops',
  'machine-learning',
];

export const mockUserTagsResponse = (limit: number): string[] =>
  MOCK_USER_TAGS.slice(0, limit);
