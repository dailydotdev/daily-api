import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClaimSupersededByClaim1786800000000 implements MigrationInterface {
  name = 'ClaimSupersededByClaim1786800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      /* sql */ `ALTER TABLE "claim" ADD COLUMN IF NOT EXISTS "supersededByClaimId" uuid`,
    );
    await queryRunner.query(
      /* sql */ `ALTER TABLE "claim" DROP CONSTRAINT IF EXISTS "FK_claim_superseded_by_claim_id"`,
    );
    await queryRunner.query(
      /* sql */ `ALTER TABLE "claim" ADD CONSTRAINT "FK_claim_superseded_by_claim_id" FOREIGN KEY ("supersededByClaimId") REFERENCES "claim"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      /* sql */ `ALTER TABLE "claim" DROP CONSTRAINT IF EXISTS "FK_claim_superseded_by_claim_id"`,
    );
    await queryRunner.query(
      /* sql */ `ALTER TABLE "claim" DROP COLUMN IF EXISTS "supersededByClaimId"`,
    );
  }
}
