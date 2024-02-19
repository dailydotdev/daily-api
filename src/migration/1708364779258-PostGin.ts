import { MigrationInterface, QueryRunner } from 'typeorm';

export class PostGin1708364779258 implements MigrationInterface {
  name = 'PostGin1708364779258';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_post_tsv" ON "post" USING GIN(tsv)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_post_tsv"`);
  }
}
