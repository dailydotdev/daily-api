import { MigrationInterface, QueryRunner } from 'typeorm';

export class UnknownSource1677643070022 implements MigrationInterface {
  name = 'UnknownSource1677643070022';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // the image is still subject for change based on product team's response
    await queryRunner.query(
      `INSERT INTO "public"."source" ("id", "name", "private", "image") VALUES ('community', 'Community recommendations', true, 'https://res.cloudinary.com/daily-now/image/upload/t_logo,f_auto/v1/logos/community')`,
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
