import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserCloudProvider1782600000000 implements MigrationInterface {
  name = 'UserCloudProvider1782600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" ADD "cloudProvider" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "cloudProvider"`);
  }
}
