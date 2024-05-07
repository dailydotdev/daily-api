import { MigrationInterface, QueryRunner } from 'typeorm';

export class SquadTotalUpvotesTrigger1714662136871
  implements MigrationInterface
{
  name = 'SquadTotalUpvotesTrigger1714662136871';

  public async up(queryRunner: QueryRunner): Promise<void> {
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    queryRunner.query(
      'DROP TRIGGER IF EXISTS update_squad_upvotes_count ON post',
    );
    queryRunner.query('DROP FUNCTION IF EXISTS update_squad_upvotes_count');
  }
}
