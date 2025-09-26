import { MigrationInterface, QueryRunner } from 'typeorm';

export class SourcePostModerationFlagsDedup1758797445760
  implements MigrationInterface
{
  name = 'SourcePostModerationFlagsDedup1758797445760';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_source_post_moderation_flags_dedupKey" ON source_post_moderation USING HASH ((flags->>'dedupKey'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_source_post_moderation_flags_dedupKey"`,
    );
  }
}
