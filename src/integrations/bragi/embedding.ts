import { EmbeddingRequest } from '@dailydotdev/schema';
import { getBragiProxyClient } from './clients';
import {
  LEDGER_EMBEDDING_DIMENSION,
  LEDGER_EMBEDDING_MODEL,
  LEDGER_EMBEDDING_PROVIDER,
} from '../../common/ledgerEmbedding';

// An entity description and the plan text looked up against it go through the
// same call, so the two sides cannot drift onto different models.
export const embedLedgerText = async (input: string[]): Promise<number[][]> => {
  const { instance, garmr } = getBragiProxyClient();
  const { data } = await garmr.execute(() =>
    instance.embedding(
      new EmbeddingRequest({
        provider: LEDGER_EMBEDDING_PROVIDER,
        model: LEDGER_EMBEDDING_MODEL,
        input,
      }),
    ),
  );

  if (data.length !== input.length) {
    throw new Error(
      `Embedding returned ${data.length} vectors for ${input.length} inputs`,
    );
  }

  return data.map(({ embedding }) => {
    if (embedding.length !== LEDGER_EMBEDDING_DIMENSION) {
      throw new Error(
        `Embedding returned ${embedding.length} dimensions, expected ${LEDGER_EMBEDDING_DIMENSION}`,
      );
    }

    return embedding;
  });
};
