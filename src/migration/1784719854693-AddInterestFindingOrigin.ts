import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInterestFindingOrigin1784719854693 implements MigrationInterface {
  name = 'AddInterestFindingOrigin1784719854693';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "interest_finding" ADD COLUMN IF NOT EXISTS "origin" text NOT NULL DEFAULT 'search'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "interest_finding" DROP COLUMN IF EXISTS "origin"`,
    );
  }
}
