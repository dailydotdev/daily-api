import { MigrationInterface, QueryRunner } from 'typeorm';

export class SquadTotalPostsTrigger1714633817175 implements MigrationInterface {
  name = 'SquadTotalPostsTrigger1714633817175';

  public async up(queryRunner: QueryRunner): Promise<void> {
    queryRunner.query(`
        CREATE OR REPLACE FUNCTION increment_squad_posts_count()
          RETURNS TRIGGER
          LANGUAGE PLPGSQL
          AS
        $$
        BEGIN
          UPDATE  source
          SET     flags = jsonb_set(flags, '{totalPosts}', to_jsonb(COALESCE(CAST(flags->>'totalPosts' AS INTEGER), 0) + 1))
          WHERE   id = NEW."sourceId"
          AND     type = 'squad';
          RETURN NEW;
        END;
        $$
      `);
    queryRunner.query(
      `CREATE TRIGGER increment_squad_posts_count AFTER INSERT ON "post" FOR EACH ROW EXECUTE PROCEDURE increment_squad_posts_count()`,
    );

    queryRunner.query(`
        CREATE OR REPLACE FUNCTION decrement_squad_posts_count()
          RETURNS TRIGGER
          LANGUAGE PLPGSQL
          AS
        $$
        BEGIN
          IF OLD.deleted = false AND NEW.deleted = true THEN
            UPDATE  source
            SET     flags = jsonb_set(flags, '{totalPosts}', to_jsonb(GREATEST(0, COALESCE(CAST(flags->>'totalPosts' AS INTEGER), 0) - 1)))
            WHERE   id = NEW."sourceId"
            AND     type = 'squad';
          END IF;
          RETURN NEW;
        END;
        $$
      `);
    queryRunner.query(
      `CREATE TRIGGER decrement_squad_posts_count AFTER UPDATE ON "post" FOR EACH ROW EXECUTE PROCEDURE decrement_squad_posts_count()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    queryRunner.query(
      'DROP TRIGGER IF EXISTS decrement_squad_posts_count ON post',
    );
    queryRunner.query('DROP FUNCTION IF EXISTS decrement_squad_posts_count');

    queryRunner.query(
      'DROP TRIGGER IF EXISTS increment_squad_posts_count ON post',
    );
    queryRunner.query('DROP FUNCTION IF EXISTS increment_squad_posts_count');
  }
}
