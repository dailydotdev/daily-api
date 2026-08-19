import '../src/config';
import { IsNull, Not, Or } from 'typeorm';
import createOrGetConnection from '../src/db';
import { LedgerEntity } from '../src/entity/claim/LedgerEntity';
import {
  LEDGER_EMBEDDING_MODEL,
  toVectorLiteral,
} from '../src/common/ledgerEmbedding';
import { embedLedgerText } from '../src/integrations/bragi/embedding';

// Discovery only compares vectors stamped with the model it queries with, so
// after a model change every described entity drops out of the results and the
// endpoint answers 200 with an empty list — a silent outage rather than a
// failure. This re-embeds whatever is not on the current model.
const BATCH_SIZE = 100;

(async (): Promise<void> => {
  const dryRun = process.argv.includes('--dry-run');
  const con = await createOrGetConnection();
  const repo = con.getRepository(LedgerEntity);

  const stale = await repo.find({
    select: ['id', 'canonicalName', 'description'],
    where: {
      description: Not(IsNull()),
      descriptionEmbeddingModel: Or(IsNull(), Not(LEDGER_EMBEDDING_MODEL)),
    },
  });

  console.log(
    `${stale.length} described entities are not on ${LEDGER_EMBEDDING_MODEL}`,
  );

  if (dryRun || !stale.length) {
    console.table(
      stale.slice(0, 20).map(({ canonicalName }) => ({ canonicalName })),
    );
    process.exit(0);
  }

  for (let i = 0; i < stale.length; i += BATCH_SIZE) {
    const batch = stale.slice(i, i + BATCH_SIZE);
    const embeddings = await embedLedgerText(
      batch.map(({ description }) => description as string),
    );

    await con.transaction((manager) =>
      Promise.all(
        batch.map(({ id }, index) =>
          manager
            .createQueryBuilder()
            .update(LedgerEntity)
            .set({
              descriptionEmbedding: () => ':embedding',
              descriptionEmbeddingModel: LEDGER_EMBEDDING_MODEL,
            })
            .where({ id })
            .setParameter('embedding', toVectorLiteral(embeddings[index]))
            .execute(),
        ),
      ),
    );

    console.log(`${Math.min(i + BATCH_SIZE, stale.length)}/${stale.length}`);
  }

  process.exit(0);
})();
