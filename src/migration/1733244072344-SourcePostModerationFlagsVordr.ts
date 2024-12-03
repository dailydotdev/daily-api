import { MigrationInterface, QueryRunner } from 'typeorm';

export class SourcePostModerationFlagsVordr1733244072344
  implements MigrationInterface
{
  name = 'SourcePostModerationFlagsVordr1733244072344';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "source_post_moderation" ADD "flags" jsonb NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_source_post_moderation_flags_vordr" ON post USING HASH (((flags->'vordr')::boolean))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_source_post_moderation_flags_vordr"`,
    );
    await queryRunner.query(
      `ALTER TABLE "source_post_moderation" DROP COLUMN "flags"`,
    );
  }
}
