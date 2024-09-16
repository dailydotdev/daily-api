import { MigrationInterface, QueryRunner } from 'typeorm';

export class SourceMembersCountDecrement1725981967186
  implements MigrationInterface
{
  name = 'SourceMembersCountDecrement1725981967186';

  public async up(queryRunner: QueryRunner): Promise<void> {
    queryRunner.query(`
        CREATE OR REPLACE FUNCTION blocked_squad_members_count()
          RETURNS TRIGGER
          LANGUAGE PLPGSQL
          AS
        $$
        BEGIN
          UPDATE  source
          SET     flags = jsonb_set(
                            flags,
                            '{totalMembers}',
                            to_jsonb(COALESCE(CAST(flags->>'totalMembers' AS INTEGER), 0) - 1)
                          )
          WHERE   id = NEW."sourceId"
          AND     type = 'squad';
          RETURN NEW;
        END;
        $$
      `);
    queryRunner.query(
      `
        CREATE TRIGGER blocked_squad_members_count
        AFTER UPDATE ON "source_member"
        FOR EACH ROW
        WHEN (NEW.role = 'blocked' and OLD.role != 'blocked')
        EXECUTE PROCEDURE blocked_squad_members_count()
      `,
    );

    queryRunner.query(`
      CREATE OR REPLACE FUNCTION removed_squad_members_count()
        RETURNS TRIGGER
        LANGUAGE PLPGSQL
        AS
      $$
      BEGIN
        UPDATE  source
        SET     flags = jsonb_set(
                          flags,
                          '{totalMembers}',
                          to_jsonb(COALESCE(CAST(flags->>'totalMembers' AS INTEGER), 0) - 1)
                        )
        WHERE   id = OLD."sourceId"
        AND     type = 'squad';
        RETURN OLD;
      END;
      $$
    `);
    queryRunner.query(
      `
      CREATE TRIGGER removed_squad_members_count
      AFTER DELETE ON "source_member"
      FOR EACH ROW
      WHEN (OLD.role != 'blocked')
      EXECUTE PROCEDURE removed_squad_members_count()
    `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    queryRunner.query(
      'DROP TRIGGER IF EXISTS removed_squad_members_count ON post',
    );
    queryRunner.query('DROP FUNCTION IF EXISTS removed_squad_members_count');

    queryRunner.query(
      'DROP TRIGGER IF EXISTS blocked_squad_members_count ON post',
    );
    queryRunner.query('DROP FUNCTION IF EXISTS blocked_squad_members_count');
  }
}
