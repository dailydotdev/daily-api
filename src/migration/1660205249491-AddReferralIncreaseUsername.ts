import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReferralIncreaseUsername1660205249491
  implements MigrationInterface
{
  name = 'AddReferralIncreaseUsername1660205249491';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user"
      ADD "referral" text`);
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "username" type character varying(39)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "referral"`);
  }
}
