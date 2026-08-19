import { ModelProvider } from '@dailydotdev/schema';

// Frozen into the vector column's type: changing either the model or the
// dimension means re-embedding every entity, so the model is recorded on the
// row and a lookup only compares vectors that came from the same one.
export const LEDGER_EMBEDDING_MODEL = 'text-embedding-3-large';
export const LEDGER_EMBEDDING_DIMENSION = 3072;
export const LEDGER_EMBEDDING_PROVIDER = ModelProvider.OpenAI;

// pgvector reads its literal from text, so a bound parameter has to arrive as
// the bracketed form rather than as a postgres array.
export const toVectorLiteral = (embedding: number[]): string =>
  `[${embedding.join(',')}]`;
