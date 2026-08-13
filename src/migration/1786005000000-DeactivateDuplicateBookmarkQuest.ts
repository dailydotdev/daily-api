import type { MigrationInterface, QueryRunner } from 'typeorm';

const questId = '2cd4f6e7-a253-4c90-8a7d-45f0aee84019';

export class DeactivateDuplicateBookmarkQuest1786005000000
  implements MigrationInterface
{
  name = 'DeactivateDuplicateBookmarkQuest1786005000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      UPDATE "quest"
      SET "active" = false
      WHERE "id" = '${questId}'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      UPDATE "quest"
      SET "active" = true
      WHERE "id" = '${questId}'
    `);
  }
}
