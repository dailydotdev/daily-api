import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserExperienceFlagsImport1763996658211
  implements MigrationInterface
{
  name = 'UserExperienceFlagsImport1763996658211';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_experience" ADD "flags" jsonb NOT NULL DEFAULT '{}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_experience" DROP COLUMN "flags"`,
    );
  }
}
