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
          IF NEW.upvotes <> OLD.upvotes THEN
            UPDATE  source
            SET     flags = jsonb_set(
                              flags,
                              '{totalUpvotes}',
                              to_jsonb(
                                COALESCE(CAST(flags->>'totalUpvotes' AS INTEGER), 0) +
                                (CASE WHEN NEW.upvotes > OLD.upvotes THEN 1 ELSE -1 END)
                              )
                            )
            WHERE   id = NEW."sourceId"
            AND     type = 'squad';
          END IF;
          RETURN NEW;
        END;
        $$
      `);
    queryRunner.query(
      `CREATE TRIGGER update_squad_upvotes_count AFTER UPDATE ON "post" FOR EACH ROW EXECUTE PROCEDURE update_squad_upvotes_count()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    queryRunner.query(
      'DROP TRIGGER IF EXISTS update_squad_upvotes_count ON post',
    );
    queryRunner.query('DROP FUNCTION IF EXISTS update_squad_upvotes_count');
  }
}
