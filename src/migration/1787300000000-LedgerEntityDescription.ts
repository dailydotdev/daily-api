import type { MigrationInterface, QueryRunner } from 'typeorm';

export class LedgerEntityDescription1787300000000 implements MigrationInterface {
  name = 'LedgerEntityDescription1787300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      CREATE EXTENSION IF NOT EXISTS vector
    `);

    // What the entity is and what approach it displaced. A plan that never
    // names the entity still describes the problem it solves, and this is the
    // only column that prose can reach.
    await queryRunner.query(/* sql */ `
      ALTER TABLE "ledger_entity"
        ADD COLUMN IF NOT EXISTS "description" text
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "ledger_entity"
        ADD COLUMN IF NOT EXISTS "descriptionEmbedding" vector(3072)
    `);

    // Two models produce two incompatible spaces, so the lookup compares only
    // vectors stamped with the model it is querying with.
    await queryRunner.query(/* sql */ `
      ALTER TABLE "ledger_entity"
        ADD COLUMN IF NOT EXISTS "descriptionEmbeddingModel" text
    `);

    // No ANN index on purpose. HNSW and IVFFlat buy speed by giving up recall,
    // and recall on an entity the plan cannot name is the whole point of this
    // column; an exact scan over the entity table is milliseconds at this size.
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      ALTER TABLE "ledger_entity"
        DROP COLUMN IF EXISTS "descriptionEmbeddingModel"
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "ledger_entity"
        DROP COLUMN IF EXISTS "descriptionEmbedding"
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "ledger_entity"
        DROP COLUMN IF EXISTS "description"
    `);
  }
}
