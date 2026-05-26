import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFavoritedAtToSourceMember1779395956183
  implements MigrationInterface
{
  name = 'AddFavoritedAtToSourceMember1779395956183';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      ALTER TABLE "source_member"
      ADD COLUMN IF NOT EXISTS "favoritedAt" TIMESTAMP WITH TIME ZONE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      ALTER TABLE "source_member"
      DROP COLUMN IF EXISTS "favoritedAt"
    `);
  }
}
