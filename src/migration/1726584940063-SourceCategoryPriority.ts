import { MigrationInterface, QueryRunner } from 'typeorm';

export class SourceCategoryPriority1726584940063 implements MigrationInterface {
  name = 'SourceCategoryPriority1726584940063';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "source_category" ADD "priority" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "source_category" DROP COLUMN "priority"`,
    );
  }
}
