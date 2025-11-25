import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserExperienceCustomLocation1764076115716
  implements MigrationInterface
{
  name = 'UserExperienceCustomLocation1764076115716';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_experience" ADD "customLocation" jsonb NOT NULL DEFAULT '{}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_experience" DROP COLUMN "customLocation"`,
    );
  }
}
