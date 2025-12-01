import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserHideExperience1764520729009 implements MigrationInterface {
  name = 'UserHideExperience1764520729009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD IF NOT EXISTS "hideExperience" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_user_hideExperience" ON "user" ("hideExperience")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_hideExperience"`);
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN IF EXISTS "hideExperience"`,
    );
  }
}
