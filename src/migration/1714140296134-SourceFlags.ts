import { MigrationInterface, QueryRunner } from 'typeorm';

export class SourceFlags1714140296134 implements MigrationInterface {
  name = 'SourceFlags1714140296134';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "source" ADD "flags" jsonb NOT NULL DEFAULT '{}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "source" DROP COLUMN "flags"`);
  }
}
