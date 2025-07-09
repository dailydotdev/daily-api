import { MigrationInterface, QueryRunner } from 'typeorm';

export class ContentJSON1752062615323 implements MigrationInterface {
  name = 'ContentJSON1752062615323';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "post" ADD "contentJSON" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "contentJSON"`);
  }
}
