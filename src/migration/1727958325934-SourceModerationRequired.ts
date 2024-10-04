import { MigrationInterface, QueryRunner } from 'typeorm';

export class SourceModerationRequired1727958325934
  implements MigrationInterface
{
  name = 'SourceModerationRequired1727958325934';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "source" ADD "moderationRequired" boolean DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "source" DROP COLUMN "moderationRequired"`,
    );
  }
}
