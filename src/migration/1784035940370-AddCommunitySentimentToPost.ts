import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCommunitySentimentToPost1784035940370
  implements MigrationInterface
{
  name = 'AddCommunitySentimentToPost1784035940370';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      ALTER TABLE "post"
        ADD COLUMN IF NOT EXISTS "communitySentiment" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      ALTER TABLE "post"
        DROP COLUMN IF EXISTS "communitySentiment"
    `);
  }
}
