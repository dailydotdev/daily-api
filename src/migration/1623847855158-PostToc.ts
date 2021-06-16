import { MigrationInterface, QueryRunner } from 'typeorm';

export class PostToc1623847855158 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."post"
        ADD "description" text`,
    );
    await queryRunner.query(`ALTER TABLE "public"."post"
      ADD "toc" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "public"."post"
      DROP COLUMN "toc"`);
    await queryRunner.query(
      `ALTER TABLE "public"."post"
        DROP COLUMN "description"`,
    );
  }
}
