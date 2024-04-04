import { MigrationInterface, QueryRunner } from 'typeorm';

export class PostSlug1712228361792 implements MigrationInterface {
  name = 'PostSlug1712228361792';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "post" ADD "slug" text NOT NULL GENERATED ALWAYS AS (trim(BOTH '-' FROM regexp_replace(lower(trim(COALESCE(post.title,'empty-title')||'-'||post.id)), '[^a-z0-9\\\\-_]+', '-', 'gi'))) STORED;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "slug"`);
  }
}
