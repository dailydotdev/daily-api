import { MigrationInterface, QueryRunner } from "typeorm";

export class SourceMemberFollowers1749656464598 implements MigrationInterface {
    name = 'SourceMemberFollowers1749656464598'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION increment_source_members_count()
                RETURNS TRIGGER
                LANGUAGE PLPGSQL
                AS
            $$
            DECLARE
                source_id_to_update TEXT;
                old_is_follower BOOLEAN := FALSE;
                new_is_follower BOOLEAN := FALSE;
            BEGIN
                IF TG_OP = 'DELETE' THEN
                    source_id_to_update := OLD."sourceId";
                    old_is_follower := (OLD.type = 'source' AND OLD.status IN ('follow', 'subscribed'));
                ELSE
                    source_id_to_update := NEW."sourceId";
                    new_is_follower := (NEW.type = 'source' AND NEW.status IN ('follow', 'subscribed'));
                END IF;

                IF TG_OP = 'UPDATE' THEN
                    old_is_follower := (OLD.type = 'source' AND OLD.status IN ('follow', 'subscribed'));
                END IF;

                IF (TG_OP = 'DELETE' AND OLD.type = 'source') OR 
                   (TG_OP != 'DELETE' AND NEW.type = 'source') THEN
                    
                    UPDATE source
                    SET flags = jsonb_set(
                                  flags,
                                  '{totalMembers}',
                                  to_jsonb((
                                      SELECT COUNT(DISTINCT "userId")
                                      FROM content_preference
                                      WHERE "sourceId" = source_id_to_update
                                      AND type = 'source'
                                      AND status IN ('follow', 'subscribed')
                                  ))
                                )
                    WHERE id = source_id_to_update
                    AND type != 'squad';
                END IF;
                
                IF TG_OP = 'DELETE' THEN
                    RETURN OLD;
                ELSE
                    RETURN NEW;
                END IF;
            END;
            $$
        `);

        await queryRunner.query(`
            CREATE OR REPLACE TRIGGER increment_source_members_count
            AFTER INSERT OR UPDATE OR DELETE ON "content_preference"
            FOR EACH ROW
            EXECUTE PROCEDURE increment_source_members_count()
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TRIGGER IF EXISTS increment_source_members_count ON "content_preference"`);
        await queryRunner.query(`DROP FUNCTION IF EXISTS increment_source_members_count()`);
    }
}
