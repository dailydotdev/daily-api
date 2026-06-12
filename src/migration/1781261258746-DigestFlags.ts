import { MigrationInterface, QueryRunner } from 'typeorm';

export class DigestFlags1781261258746 implements MigrationInterface {
  name = 'DigestFlags1781261258746';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "post" ADD "digestFlags" jsonb NOT NULL DEFAULT '{}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "digestFlags"`);
  }
}
