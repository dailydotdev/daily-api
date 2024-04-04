import { MigrationInterface, QueryRunner } from 'typeorm';

export class PostSlug1712228361792 implements MigrationInterface {
  name = 'PostSlug1712228361792';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "post" ADD "slug" text NOT NULL GENERATED ALWAYS AS (trim(BOTH '-' FROM regexp_replace(lower(trim(COALESCE(post.title,'')||'-'||post.id)), '[^a-z0-9-]+', '-', 'gi'))) STORED;`,
    );
    await queryRunner.query(
      `ALTER TABLE "post" ADD CONSTRAINT "UQ_cd1bddce36edc3e766798eab376" UNIQUE ("slug")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_post_slug" ON "post" ("slug") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_post_slug"`);
    await queryRunner.query(
      `ALTER TABLE "post" DROP CONSTRAINT "UQ_cd1bddce36edc3e766798eab376"`,
    );
    await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "slug"`);
  }
}
