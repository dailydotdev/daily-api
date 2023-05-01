import { MigrationInterface, QueryRunner } from 'typeorm';

export class ContentCuration1682690930599 implements MigrationInterface {
  name = 'ContentCuration1682690930599';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "post" ADD "contentCuration" text array NOT NULL DEFAULT '{}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "contentCuration"`);
  }
}
