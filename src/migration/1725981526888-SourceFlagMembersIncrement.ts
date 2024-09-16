import { MigrationInterface, QueryRunner } from 'typeorm';

export class SourceFlagMembersIncrement1725981526888
  implements MigrationInterface
{
  name = 'SourceFlagMembersIncrement1725981526888';

  public async up(queryRunner: QueryRunner): Promise<void> {
    queryRunner.query(`
      CREATE OR REPLACE FUNCTION increment_squad_members_count()
        RETURNS TRIGGER
        LANGUAGE PLPGSQL
        AS
      $$
      BEGIN
        UPDATE  source
        SET     flags = jsonb_set(
                          flags,
                          '{totalMembers}',
                          to_jsonb(COALESCE(CAST(flags->>'totalMembers' AS INTEGER), 0) + 1)
                        )
        WHERE   id = NEW."sourceId"
        AND     type = 'squad';
        RETURN NEW;
      END;
      $$
    `);
    queryRunner.query(
      `
      CREATE TRIGGER increment_squad_members_count
      AFTER INSERT ON "source_member"
      FOR EACH ROW
      WHEN (NEW.role = 'member')
      EXECUTE PROCEDURE increment_squad_members_count()
    `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    queryRunner.query(
      'DROP TRIGGER IF EXISTS increment_squad_members_count ON post',
    );
    queryRunner.query('DROP FUNCTION IF EXISTS increment_squad_members_count');
  }
}
