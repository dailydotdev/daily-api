import { MigrationInterface, QueryRunner } from 'typeorm';

export class SquadPostingMinReputation1785657831047
  implements MigrationInterface
{
  name = 'SquadPostingMinReputation1785657831047';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "source" ADD COLUMN IF NOT EXISTS "postingMinReputation" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "source" DROP COLUMN IF EXISTS "postingMinReputation"`,
    );
  }
}
