import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClaimCandidateNote1787085561243 implements MigrationInterface {
  name = 'ClaimCandidateNote1787085561243';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      /* sql */ `ALTER TABLE "claim_candidate" ADD COLUMN IF NOT EXISTS "note" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      /* sql */ `ALTER TABLE "claim_candidate" DROP COLUMN IF EXISTS "note"`,
    );
  }
}
