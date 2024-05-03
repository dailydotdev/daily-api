import { MigrationInterface, QueryRunner } from 'typeorm';

export class SquadTotalViewsTrigger1714667947050 implements MigrationInterface {
  name = 'SquadTotalViewsTrigger1714667947050';

  public async up(queryRunner: QueryRunner): Promise<void> {
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
                            to_jsonb(COALESCE(CAST(flags->>'totalViews' AS INTEGER), 0) + 1)
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    queryRunner.query(
      'DROP TRIGGER IF EXISTS increment_squad_views_count ON post',
    );
    queryRunner.query('DROP FUNCTION IF EXISTS increment_squad_views_count');
  }
}
