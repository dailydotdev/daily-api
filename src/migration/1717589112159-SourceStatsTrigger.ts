import { MigrationInterface, QueryRunner } from 'typeorm';

export class SourceStatsTrigger1717589112159 implements MigrationInterface {
  name = 'SourceStatsTrigger1717589112159';

  public async up(queryRunner: QueryRunner): Promise<void> {
    queryRunner.query(`
        CREATE OR REPLACE FUNCTION increment_squad_posts_count()
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
          WHERE   id = NEW."sourceId";
          RETURN NEW;
        END;
        $$
      `);

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
          WHERE   id = NEW."sourceId";
          RETURN NEW;
        END;
        $$
      `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
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
  }
}
