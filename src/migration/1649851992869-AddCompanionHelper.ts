import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCompanionHelper1649851992869 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."alerts" ADD "companionHelper" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."alerts" DROP COLUMN "companionHelper"`,
    );
  }
}
