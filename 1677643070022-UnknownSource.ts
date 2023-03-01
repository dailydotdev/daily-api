import { MigrationInterface, QueryRunner } from 'typeorm';

export class UnknownSource1677643070022 implements MigrationInterface {
  name = 'UnknownSource1677643070022';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "public"."source" ("id", "name", "private") VALUES ('unknown', 'Unknown', true)`,
    );
    await queryRunner.query(
      `UPDATE "public"."post" SET "sourceId" = 'unknown' WHERE "sourceId" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "post" ALTER COLUMN "sourceId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "post" ALTER COLUMN "sourceId" SET DEFAULT 'unknown'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "post" ALTER COLUMN "sourceId" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "post" ALTER COLUMN "sourceId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `UPDATE "public"."post" SET "sourceId" = NULL WHERE "sourceId" = 'unknown'`,
    );
    await queryRunner.query(
      `DELETE FROM "public"."source" WHERE id = 'unknown'`,
    );
  }
}
