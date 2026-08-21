import { MigrationInterface, QueryRunner } from 'typeorm';

export class DatasetToolClaim1787800000000 implements MigrationInterface {
  name = 'DatasetToolClaim1787800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      /* sql */ `ALTER TABLE "dataset_tool" ADD COLUMN IF NOT EXISTS "claimedByCompanyId" text`,
    );
    await queryRunner.query(
      /* sql */ `ALTER TABLE "dataset_tool" ADD COLUMN IF NOT EXISTS "claimedByUserId" text`,
    );
    await queryRunner.query(
      /* sql */ `ALTER TABLE "dataset_tool" ADD COLUMN IF NOT EXISTS "claimedAt" timestamptz`,
    );
    await queryRunner.query(
      /* sql */ `ALTER TABLE "dataset_tool" ADD CONSTRAINT "FK_dataset_tool_claimed_by_company_id" FOREIGN KEY ("claimedByCompanyId") REFERENCES "company"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      /* sql */ `ALTER TABLE "dataset_tool" ADD CONSTRAINT "FK_dataset_tool_claimed_by_user_id" FOREIGN KEY ("claimedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      /* sql */ `CREATE INDEX IF NOT EXISTS "IDX_dataset_tool_claimed_by_company_id" ON "dataset_tool" ("claimedByCompanyId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      /* sql */ `DROP INDEX IF EXISTS "IDX_dataset_tool_claimed_by_company_id"`,
    );
    await queryRunner.query(
      /* sql */ `ALTER TABLE "dataset_tool" DROP CONSTRAINT IF EXISTS "FK_dataset_tool_claimed_by_user_id"`,
    );
    await queryRunner.query(
      /* sql */ `ALTER TABLE "dataset_tool" DROP CONSTRAINT IF EXISTS "FK_dataset_tool_claimed_by_company_id"`,
    );
    await queryRunner.query(
      /* sql */ `ALTER TABLE "dataset_tool" DROP COLUMN IF EXISTS "claimedAt"`,
    );
    await queryRunner.query(
      /* sql */ `ALTER TABLE "dataset_tool" DROP COLUMN IF EXISTS "claimedByUserId"`,
    );
    await queryRunner.query(
      /* sql */ `ALTER TABLE "dataset_tool" DROP COLUMN IF EXISTS "claimedByCompanyId"`,
    );
  }
}
