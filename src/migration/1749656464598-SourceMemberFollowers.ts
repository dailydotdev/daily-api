import { MigrationInterface, QueryRunner } from "typeorm";

export class SourceMemberFollowers1749656464598 implements MigrationInterface {
    name = 'SourceMemberFollowers1749656464598'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TRIGGER IF EXISTS increment_squad_members_count ON "source_member"`);
        await queryRunner.query(`DROP FUNCTION IF EXISTS increment_squad_members_count()`);
        await queryRunner.query(`DROP TRIGGER IF EXISTS blocked_squad_members_count ON "source_member"`);
        await queryRunner.query(`DROP FUNCTION IF EXISTS blocked_squad_members_count()`);
        await queryRunner.query(`DROP TRIGGER IF EXISTS removed_squad_members_count ON "source_member"`);

        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION increment_source_members_count()
                RETURNS TRIGGER
                LANGUAGE PLPGSQL
                AS
            $$
            BEGIN
                UPDATE source
                SET flags = jsonb_set(
                              flags,
                              '{totalMembers}',
                              to_jsonb(COALESCE(CAST(flags->>'totalMembers' AS INTEGER), 0) + 1)
                            )
                WHERE id = NEW."sourceId";
                RETURN NEW;
            END;
            $$
        `);

        await queryRunner.query(`
            CREATE OR REPLACE TRIGGER increment_source_members_count
            AFTER INSERT ON "content_preference"
            FOR EACH ROW
            WHEN (NEW.type = 'source' AND NEW.status IN ('follow', 'subscribed'))
            EXECUTE PROCEDURE increment_source_members_count()
        `);

        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION blocked_source_members_count()
                RETURNS TRIGGER
                LANGUAGE PLPGSQL
                AS
            $$
            BEGIN
                UPDATE source
                SET flags = jsonb_set(
                              flags,
                              '{totalMembers}',
                              to_jsonb(COALESCE(CAST(flags->>'totalMembers' AS INTEGER), 0) - 1)
                            )
                WHERE id = NEW."sourceId";
                RETURN NEW;
            END;
            $$
            `);

        await queryRunner.query(`
            CREATE OR REPLACE TRIGGER blocked_source_members_count
            AFTER UPDATE ON "content_preference"
            FOR EACH ROW
            WHEN (NEW.type = 'source' AND NEW.status IN ('blocked') AND OLD.status NOT IN ('blocked'))
            EXECUTE PROCEDURE blocked_source_members_count()
        `);

        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION decrement_source_members_count()
                RETURNS TRIGGER
                LANGUAGE PLPGSQL
                AS
            $$
            BEGIN
                UPDATE source
                SET flags = jsonb_set(
                              flags,
                              '{totalMembers}',
                              to_jsonb(COALESCE(CAST(flags->>'totalMembers' AS INTEGER), 0) - 1)
                            )
                WHERE id = OLD."sourceId";
                RETURN OLD;
            END;
            $$
        `);

        await queryRunner.query(`
            CREATE OR REPLACE TRIGGER decrement_source_members_count
            AFTER DELETE ON "content_preference"
            FOR EACH ROW
            WHEN (OLD.type = 'source' AND OLD.status IN ('follow', 'subscribed'))
            EXECUTE PROCEDURE decrement_source_members_count()
        `);

        await queryRunner.query(`
            CREATE OR REPLACE TRIGGER increment_source_members_count_unblock
            AFTER UPDATE ON "content_preference"
            FOR EACH ROW
            WHEN (NEW.type = 'source' AND NEW.status IN ('follow', 'subscribed') AND OLD.status NOT IN ('follow', 'subscribed'))
            EXECUTE PROCEDURE increment_source_members_count()
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TRIGGER IF EXISTS increment_source_members_count ON "content_preference"`);
        await queryRunner.query(`DROP TRIGGER IF EXISTS increment_source_members_count_unblock ON "content_preference"`);
        await queryRunner.query(`DROP FUNCTION IF EXISTS increment_source_members_count()`);
        await queryRunner.query(`DROP TRIGGER IF EXISTS blocked_source_members_count ON "content_preference"`);
        await queryRunner.query(`DROP FUNCTION IF EXISTS blocked_source_members_count()`);
        await queryRunner.query(`DROP TRIGGER IF EXISTS decrement_source_members_count ON "content_preference"`);
        await queryRunner.query(`DROP FUNCTION IF EXISTS decrement_source_members_count()`);


    await queryRunner.query(`
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
    await queryRunner.query(
      `
      CREATE OR REPLACE TRIGGER increment_squad_members_count
      AFTER INSERT ON "source_member"
      FOR EACH ROW
      WHEN (NEW.role != 'blocked')
      EXECUTE PROCEDURE increment_squad_members_count()
    `,
    );

    await queryRunner.query(`
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
    await queryRunner.query(
      `
        CREATE TRIGGER blocked_squad_members_count
        AFTER UPDATE ON "source_member"
        FOR EACH ROW
        WHEN (NEW.role = 'blocked' and OLD.role != 'blocked')
        EXECUTE PROCEDURE blocked_squad_members_count()
      `,
    );

    await queryRunner.query(`
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
    await queryRunner.query(
      `
      CREATE TRIGGER removed_squad_members_count
      AFTER DELETE ON "source_member"
      FOR EACH ROW
      WHEN (OLD.role != 'blocked')
      EXECUTE PROCEDURE removed_squad_members_count()
    `,
    );
    }
}
