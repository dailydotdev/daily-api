import { MigrationInterface, QueryRunner } from 'typeorm';

export class AltCompanyName1764281763755 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "company" ADD COLUMN IF NOT EXISTS "altName" text DEFAULT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_company_altName_trgm" ON "company" USING gin("altName" gin_trgm_ops)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_company_altName_lower" ON "company" (LOWER("altName"))`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_company_altName_slugify" ON "company" (slugify("altName"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_company_altName_slugify"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_company_altName_lower"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_company_altName_trgm"`);
    await queryRunner.query(
      `ALTER TABLE "company" DROP COLUMN IF EXISTS "altName"`,
    );
  }
}
