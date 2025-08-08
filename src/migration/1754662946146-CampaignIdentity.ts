import { MigrationInterface, QueryRunner } from 'typeorm';

export class CampaignIdentity1754662946146 implements MigrationInterface {
  name = 'CampaignIdentity1754662946146';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."campaign" REPLICA IDENTITY FULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."campaign" REPLICA IDENTITY DEFAULT`,
    );
  }
}
