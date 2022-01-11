import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlertMyFeedDefaultValue1641904779220
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."alerts" ALTER COLUMN "myFeed" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."alerts" ALTER COLUMN "myFeed" SET NOT NULL`,
    );
  }
}
