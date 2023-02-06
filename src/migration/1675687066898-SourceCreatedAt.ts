import { MigrationInterface, QueryRunner } from 'typeorm';

export class SourceCreatedAt1675687066898 implements MigrationInterface {
  name = 'SourceCreatedAt1675687066898';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "source" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "source" DROP COLUMN "createdAt"`);
  }
}
