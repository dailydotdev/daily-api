import { MigrationInterface, QueryRunner } from 'typeorm';

export class OpportunityAnonUserClaim1764256128667
  implements MigrationInterface
{
  name = 'OpportunityAnonUserClaim1764256128667';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "opportunity" ADD "flags" jsonb NOT NULL DEFAULT '{}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "opportunity" DROP COLUMN "flags"`);
  }
}
