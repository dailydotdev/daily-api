import { MigrationInterface, QueryRunner } from 'typeorm';

export class AwardSquadTrigger1749107653425 implements MigrationInterface {
  name = 'AwardSquadTrigger.ts1749107653425';

  public async up(queryRunner: QueryRunner): Promise<void> {
    queryRunner.query(`
        CREATE OR REPLACE FUNCTION increment_squad_awards_count()
          RETURNS TRIGGER
          LANGUAGE PLPGSQL
          AS
        $$
        BEGIN
          IF NEW."flags"->>'sourceId' IS NOT NULL THEN
              UPDATE source
              SET flags = jsonb_set(flags, '{totalAwards}', to_jsonb(COALESCE(CAST(flags->>'totalAwards' AS INTEGER) , 0) + 1))
              WHERE id = NEW."flags"->>'sourceId';
          END IF;
          RETURN NEW;
      END;
        $$
      `);
    queryRunner.query(
      `
        CREATE TRIGGER increment_squad_awards_count
        AFTER INSERT ON "user_transaction"
        FOR EACH ROW
        EXECUTE PROCEDURE increment_squad_awards_count()
      `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    queryRunner.query(
      'DROP TRIGGER IF EXISTS increment_squad_awards_count ON user_transaction',
    );
    queryRunner.query('DROP FUNCTION IF EXISTS increment_squad_awards_count');
  }
}
