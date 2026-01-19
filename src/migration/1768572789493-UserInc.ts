import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserInc1768572789493 implements MigrationInterface {
  name = 'UserInc1768572789493';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD "inc" integer NOT NULL DEFAULT '0'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "inc"`);
  }
}
