import { MigrationInterface, QueryRunner } from 'typeorm';

export class SourceStatsTrigger1717589112159 implements MigrationInterface {
  name = 'SourceStatsTrigger1717589112159';

  public async up(queryRunner: QueryRunner): Promise<void> {
    queryRunner.query(
      'DROP TRIGGER IF EXISTS increment_squad_posts_count ON post',
    );
    queryRunner.query('DROP FUNCTION IF EXISTS increment_squad_posts_count');

    queryRunner.query(`
      CREATE OR REPLACE FUNCTION increment_source_posts_count()
        RETURNS TRIGGER
        LANGUAGE PLPGSQL
        AS
      $$
      BEGIN
        UPDATE  source
        SET     flags = jsonb_set(flags, '{totalPosts}', to_jsonb(COALESCE(CAST(flags->>'totalPosts' AS INTEGER) , 0) + 1))
        WHERE   id = NEW."sourceId";
        RETURN NEW;
      END;
      $$
    `);
    queryRunner.query(
      `
        CREATE TRIGGER increment_source_posts_count
        AFTER INSERT ON "post"
        FOR EACH ROW
        EXECUTE PROCEDURE increment_source_posts_count()
      `,
    );

    queryRunner.query(
      'DROP TRIGGER IF EXISTS update_squad_upvotes_count ON post',
    );
    queryRunner.query('DROP FUNCTION IF EXISTS update_squad_upvotes_count');

    queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_source_upvotes_count()
        RETURNS TRIGGER
        LANGUAGE PLPGSQL
        AS
      $$
      BEGIN
        UPDATE  source
        SET     flags = jsonb_set(
                          flags,
                          '{totalUpvotes}',
                          to_jsonb(
                            GREATEST(
                              0,
                              COALESCE(CAST(flags->>'totalUpvotes' AS INTEGER), 0) + (NEW.upvotes - OLD.upvotes)
                            )
                          )
                        )
        WHERE   id = NEW."sourceId";
        RETURN NEW;
      END;
      $$
    `);
    queryRunner.query(
      `
        CREATE TRIGGER update_source_upvotes_count
        AFTER UPDATE ON "post"
        FOR EACH ROW
        WHEN (NEW.upvotes <> OLD.upvotes)
        EXECUTE PROCEDURE update_source_upvotes_count()
      `,
    );

    queryRunner.query(
      'DROP TRIGGER IF EXISTS increment_squad_views_count ON post',
    );
    queryRunner.query('DROP FUNCTION IF EXISTS increment_squad_views_count');

    queryRunner.query(`
      CREATE OR REPLACE FUNCTION increment_source_views_count()
        RETURNS TRIGGER
        LANGUAGE PLPGSQL
        AS
      $$
      BEGIN
        UPDATE  source
        SET     flags = jsonb_set(
                          flags,
                          '{totalViews}',
                          to_jsonb(COALESCE(CAST(flags->>'totalViews' AS INTEGER), 0) + (NEW.views - OLD.views))
                        )
        WHERE   id = NEW."sourceId";
        RETURN NEW;
      END;
      $$
    `);

    queryRunner.query(
      `
        CREATE TRIGGER increment_source_views_count
        AFTER UPDATE ON "post"
        FOR EACH ROW
        WHEN (NEW.views > OLD.views)
        EXECUTE PROCEDURE increment_source_views_count()
      `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    queryRunner.query(
      'DROP TRIGGER IF EXISTS increment_source_views_count ON post',
    );
    queryRunner.query('DROP FUNCTION IF EXISTS increment_source_views_count');

    queryRunner.query(`
      CREATE OR REPLACE FUNCTION increment_squad_views_count()
        RETURNS TRIGGER
        LANGUAGE PLPGSQL
        AS
      $$
      BEGIN
        UPDATE  source
        SET     flags = jsonb_set(
                          flags,
                          '{totalViews}',
                          to_jsonb(COALESCE(CAST(flags->>'totalViews' AS INTEGER), 0) + (NEW.views - OLD.views))
                        )
        WHERE   id = NEW."sourceId"
        AND     type = 'squad';
        RETURN NEW;
      END;
      $$
    `);
    queryRunner.query(
      `
        CREATE TRIGGER increment_squad_views_count
        AFTER UPDATE ON "post"
        FOR EACH ROW
        WHEN (NEW.views > OLD.views)
        EXECUTE PROCEDURE increment_squad_views_count()
      `,
    );

    queryRunner.query(
      'DROP TRIGGER IF EXISTS update_source_upvotes_count ON post',
    );
    queryRunner.query('DROP FUNCTION IF EXISTS update_source_upvotes_count');

    queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_squad_upvotes_count()
        RETURNS TRIGGER
        LANGUAGE PLPGSQL
        AS
      $$
      BEGIN
        UPDATE  source
        SET     flags = jsonb_set(
                          flags,
                          '{totalUpvotes}',
                          to_jsonb(
                            GREATEST(
                              0,
                              COALESCE(CAST(flags->>'totalUpvotes' AS INTEGER), 0) + (NEW.upvotes - OLD.upvotes)
                            )
                          )
                        )
        WHERE   id = NEW."sourceId"
        AND     type = 'squad';
        RETURN NEW;
      END;
      $$
    `);
    queryRunner.query(
      `
        CREATE TRIGGER update_squad_upvotes_count
        AFTER UPDATE ON "post"
        FOR EACH ROW
        WHEN (NEW.upvotes <> OLD.upvotes)
        EXECUTE PROCEDURE update_squad_upvotes_count()
      `,
    );

    queryRunner.query(
      'DROP TRIGGER IF EXISTS increment_source_posts_count ON post',
    );
    queryRunner.query('DROP FUNCTION IF EXISTS increment_source_posts_count');

    queryRunner.query(`
      CREATE OR REPLACE FUNCTION increment_squad_posts_count()
        RETURNS TRIGGER
        LANGUAGE PLPGSQL
        AS
      $$
      BEGIN
        UPDATE  source
        SET     flags = jsonb_set(flags, '{totalPosts}', to_jsonb(COALESCE(CAST(flags->>'totalPosts' AS INTEGER) , 0) + 1))
        WHERE   id = NEW."sourceId"
        AND     type = 'squad';
        RETURN NEW;
      END;
      $$
    `);
    queryRunner.query(
      `
        CREATE TRIGGER increment_squad_posts_count
        AFTER INSERT ON "post"
        FOR EACH ROW
        EXECUTE PROCEDURE increment_squad_posts_count()
      `,
    );
  }
}
