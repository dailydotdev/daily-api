import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserExperienceLevel1713784472035 implements MigrationInterface {
  name = 'UserExperienceLevel1713784472035';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" ADD "experienceLevel" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "experienceLevel"`);
  }
}
