import { MigrationInterface, QueryRunner } from 'typeorm';

export class SquadTotalPostsTrigger1714633817175 implements MigrationInterface {
  name = 'SquadTotalPostsTrigger1714633817175';

  public async up(queryRunner: QueryRunner): Promise<void> {
    queryRunner.query(`
        CREATE OR REPLACE FUNCTION update_squad_posts_count()
          RETURNS TRIGGER
          LANGUAGE PLPGSQL
          AS
        $$
        DECLARE
          s public.source;
        BEGIN
          SELECT * INTO s FROM public.source WHERE id = NEW."sourceId";
          IF s.type = 'squad' THEN
            UPDATE source
            SET flags = jsonb_set(flags, array['totalPosts'], to_jsonb(COALESCE(CAST(flags->>'totalPosts' AS INTEGER), 0) + 1))
            WHERE id = s.id;
          END IF;
          RETURN NEW;
        END;
        $$
      `);
    queryRunner.query(
      `CREATE TRIGGER update_squad_posts_count AFTER INSERT ON "post" FOR EACH ROW EXECUTE PROCEDURE update_squad_posts_count()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    queryRunner.query(
      'DROP TRIGGER IF EXISTS update_squad_posts_count ON post',
    );
    queryRunner.query('DROP FUNCTION IF EXISTS update_squad_posts_count');
  }
}
