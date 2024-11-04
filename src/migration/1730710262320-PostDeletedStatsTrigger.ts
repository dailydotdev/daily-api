import { MigrationInterface, QueryRunner } from 'typeorm';

export class PostDeletedStatsTrigger1730710262320
  implements MigrationInterface
{
  name = 'PostDeletedStatsTrigger1730710262320';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_source_stats_on_delete()
      RETURNS TRIGGER AS $$
      BEGIN
        UPDATE  source
        SET     flags = flags || jsonb_build_object(
                          'totalPosts',
                          GREATEST(0, COALESCE(CAST(flags->>'totalPosts' AS INTEGER) , 0) - 1),
                          'totalUpvotes',
                          GREATEST(0, COALESCE(CAST(flags->>'totalUpvotes' AS INTEGER), 0) - NEW.upvotes),
                          'totalViews',
                          GREATEST(0, COALESCE(CAST(flags->>'totalViews' AS INTEGER), 0) - NEW.views)
                        )
        WHERE id = NEW."sourceId";
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(
      `
        CREATE TRIGGER update_source_stats_on_delete
        AFTER UPDATE ON "post"
        FOR EACH ROW
        WHEN (NEW.deleted <> OLD.deleted)
        EXECUTE PROCEDURE update_source_stats_on_delete();
      `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS update_source_stats_on_delete ON post',
    );
    await queryRunner.query(
      'DROP FUNCTION IF EXISTS update_source_stats_on_delete',
    );
  }
}
