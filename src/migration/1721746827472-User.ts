import { MigrationInterface, QueryRunner } from "typeorm";

export class User1721746827472 implements MigrationInterface {
  name = 'User1721746827472'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" ADD "weekStart" integer`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "weekStart"`);
  }
}
