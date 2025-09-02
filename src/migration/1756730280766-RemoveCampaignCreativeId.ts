import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveCampaignCreativeId1756730280766
  implements MigrationInterface
{
  name = 'RemoveCampaignCreativeId1756730280766';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "campaign" DROP COLUMN "creativeId"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "campaign" ADD "creativeId" uuid NOT NULL DEFAULT uuid_generate_v4()`,
    );
  }
}
