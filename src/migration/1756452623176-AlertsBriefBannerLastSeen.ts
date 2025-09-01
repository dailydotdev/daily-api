import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlertsBriefBannerLastSeen1756452623176 implements MigrationInterface {
  name = 'AlertsBriefBannerLastSeen1756452623176';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "alerts" ADD "briefBannerLastSeen" TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "alerts" DROP COLUMN "briefBannerLastSeen"`,
    );
  }
}
