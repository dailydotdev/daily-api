import { MigrationInterface, QueryRunner } from 'typeorm';

export class PostOptionality1678256072490 implements MigrationInterface {
  name = 'PostOptionality1678256072490';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "tweeted"`);
    await queryRunner.query(
      `ALTER TABLE "post" ALTER COLUMN "title" DROP NOT NULL`,
    );
    await queryRunner.query(
      `INSERT INTO "public"."source" ("id", "name", "handle", "private") VALUES ('unknown', 'unknown', 'unknown', 'true') ON CONFLICT DO NOTHING`,
    );
    await queryRunner.query(
      `ALTER TABLE "post" ALTER COLUMN "sourceId" SET DEFAULT 'unknown'`,
    );
    await queryRunner.query(
      `ALTER TABLE "post" ALTER COLUMN "sourceId" SET NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "post" ADD "tweeted" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "post" ALTER COLUMN "title" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "post" ALTER COLUMN "sourceId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "post" ALTER COLUMN "sourceId" DROP DEFAULT`,
    );
  }
}
