import { MigrationInterface, QueryRunner } from 'typeorm';

export class SharePostCountExcludePrivate1774183615000
  implements MigrationInterface
{
  name = 'SharePostCountExcludePrivate1774183615000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION post_reposts_insert_trigger_function()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.type = 'share'
          AND NEW."sharedPostId" IS NOT NULL
          AND NEW.visible = TRUE
          AND NEW.deleted = FALSE
          AND NEW.private = FALSE
        THEN
          UPDATE post
            SET reposts = reposts + 1
          WHERE id = NEW."sharedPostId";
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION post_reposts_update_trigger_function()
      RETURNS TRIGGER AS $$
      DECLARE
        old_counted BOOLEAN;
        new_counted BOOLEAN;
      BEGIN
        IF NEW.type = 'share' AND NEW."sharedPostId" IS NOT NULL THEN
          old_counted := (
            OLD.visible = TRUE
            AND OLD.deleted = FALSE
            AND OLD.private = FALSE
          );
          new_counted := (
            NEW.visible = TRUE
            AND NEW.deleted = FALSE
            AND NEW.private = FALSE
          );

          IF old_counted = TRUE AND new_counted = FALSE THEN
            UPDATE post
              SET reposts = GREATEST(reposts - 1, 0)
            WHERE id = NEW."sharedPostId";
          ELSIF old_counted = FALSE AND new_counted = TRUE THEN
            UPDATE post
              SET reposts = reposts + 1
            WHERE id = NEW."sharedPostId";
          END IF;
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION post_reposts_delete_trigger_function()
      RETURNS TRIGGER AS $$
      BEGIN
        IF OLD.type = 'share'
          AND OLD."sharedPostId" IS NOT NULL
          AND OLD.visible = TRUE
          AND OLD.deleted = FALSE
          AND OLD.private = FALSE
        THEN
          UPDATE post
            SET reposts = GREATEST(reposts - 1, 0)
          WHERE id = OLD."sharedPostId";
        END IF;

        RETURN OLD;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Backfill: recalculate reposts count excluding private reposts
    // Run manually in batches by date range:
    // UPDATE post SET reposts = (
    //   SELECT COUNT(*)
    //   FROM post sp
    //   WHERE sp."sharedPostId" = post.id
    //     AND sp.deleted = false
    //     AND sp.visible = true
    //     AND sp.private = false
    //     AND sp.type = 'share'
    // )
    // WHERE id IN (
    //   SELECT DISTINCT "sharedPostId"
    //   FROM post
    //   WHERE type = 'share'
    //     AND "createdAt" >= :start
    //     AND "createdAt" < :end
    // );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION post_reposts_insert_trigger_function()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.type = 'share'
          AND NEW."sharedPostId" IS NOT NULL
          AND NEW.visible = TRUE
          AND NEW.deleted = FALSE
        THEN
          UPDATE post
            SET reposts = reposts + 1
          WHERE id = NEW."sharedPostId";
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION post_reposts_update_trigger_function()
      RETURNS TRIGGER AS $$
      DECLARE
        old_counted BOOLEAN;
        new_counted BOOLEAN;
      BEGIN
        IF NEW.type = 'share' AND NEW."sharedPostId" IS NOT NULL THEN
          old_counted := (OLD.visible = TRUE AND OLD.deleted = FALSE);
          new_counted := (NEW.visible = TRUE AND NEW.deleted = FALSE);

          IF old_counted = TRUE AND new_counted = FALSE THEN
            UPDATE post
              SET reposts = GREATEST(reposts - 1, 0)
            WHERE id = NEW."sharedPostId";
          ELSIF old_counted = FALSE AND new_counted = TRUE THEN
            UPDATE post
              SET reposts = reposts + 1
            WHERE id = NEW."sharedPostId";
          END IF;
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION post_reposts_delete_trigger_function()
      RETURNS TRIGGER AS $$
      BEGIN
        IF OLD.type = 'share'
          AND OLD."sharedPostId" IS NOT NULL
          AND OLD.visible = TRUE
          AND OLD.deleted = FALSE
        THEN
          UPDATE post
            SET reposts = GREATEST(reposts - 1, 0)
          WHERE id = OLD."sharedPostId";
        END IF;

        RETURN OLD;
      END;
      $$ LANGUAGE plpgsql;
    `);
  }
}
