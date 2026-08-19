import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClaimCandidateUniqueStatement1787132867529
  implements MigrationInterface
{
  name = 'ClaimCandidateUniqueStatement1787132867529';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Redelivered extractions filed the same statement twice, and those rows
    // are audit ground truth that cannot be deleted — so the index binds only
    // what is written from here on and leaves the history it cannot repair
    // outside its predicate. Reading the cutover from the database means the
    // build can never trip over a duplicate that landed before it ran.
    const [{ cutover }]: { cutover: string }[] = await queryRunner.query(
      /* sql */ `
        SELECT (now() AT TIME ZONE 'UTC')::text AS cutover
      `,
    );

    // md5 instead of the raw statement: a claim can be longer than the 2704
    // byte btree tuple limit, which would fail the insert rather than the index.
    await queryRunner.query(/* sql */ `
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_claim_candidate_postId_statement_unique"
        ON "claim_candidate" ("postId", md5("statement"))
        WHERE "createdAt" > '${cutover}'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "IDX_claim_candidate_postId_statement_unique"
    `);
  }
}
