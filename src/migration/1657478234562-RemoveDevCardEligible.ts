import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveDevCardEligible1657478234562 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."user" DROP COLUMN "devcardEligible"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."user" ADD "devcardEligible" boolean NOT NULL DEFAULT false`,
    );
  }
}
