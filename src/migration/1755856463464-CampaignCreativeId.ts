import { MigrationInterface, QueryRunner } from 'typeorm';

export class CampaignCreativeId1755856463464 implements MigrationInterface {
  name = 'CampaignCreativeId1755856463464';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "campaign" ADD "creativeId" uuid NOT NULL DEFAULT uuid_generate_v4()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "campaign" DROP COLUMN "creativeId"`);
  }
}
