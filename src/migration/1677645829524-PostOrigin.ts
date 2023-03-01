import { MigrationInterface, QueryRunner } from 'typeorm';

export class PostOrigin1677645829524 implements MigrationInterface {
  name = 'PostOrigin1677645829524';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "post" ADD "visible" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(`ALTER TABLE "post" ADD "visibleAt" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "post" ADD "origin" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "origin"`);
    await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "visibleAt"`);
    await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "visible"`);
  }
}
