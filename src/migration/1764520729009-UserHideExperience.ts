import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserHideExperience1764520729009 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD IF NOT EXISTS "hideExperience" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN IF EXISTS "hideExperience"`,
    );
  }
}
