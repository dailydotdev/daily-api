import { MigrationInterface, QueryRunner } from "typeorm";

export class VordrUser1727578711381 implements MigrationInterface {
  name = 'VordrUser1727578711381'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE OR REPLACE FUNCTION vordr_update_flags()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.flags @> '{"vordr": true}' THEN
    -- If vordr is true, set showOnFeed to false and banned to true in post table
    UPDATE
      post
    SET
      "showOnFeed" = FALSE,
      "banned" = TRUE,
      "flags" = jsonb_set(jsonb_set(jsonb_set(flags,
        '{showOnFeed}', 'false', true),   -- set showOnFeed to false
        '{vordr}', 'true', true),         -- set vordr to true
        '{banned}', 'true', true)         -- set banned to true
    WHERE
      "authorId" = NEW.id;

    UPDATE
      comment
    SET
      "flags" = jsonb_set(flags, '{vordr}', 'true', true)
    WHERE
      "userId" = NEW.id;

  ELSIF NEW.flags @> '{"vordr": false}' THEN
    -- If vordr is false, set showOnFeed to true and banned to false in post table
    UPDATE
      post
    SET
      "showOnFeed" = TRUE,
      "banned" = FALSE,
      "flags" = jsonb_set(jsonb_set(jsonb_set(flags,
        '{showOnFeed}', 'false', true),   -- set showOnFeed to true
        '{vordr}', 'false', true),        -- set vordr to false
        '{banned}', 'false', true)        -- set banned to false
    WHERE
      "authorId" = NEW.id;

    UPDATE
      comment
    SET
      "flags" = jsonb_set(flags, '{vordr}', 'false', true)
    WHERE
      "userId" = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;`);

    await queryRunner.query(`CREATE OR REPLACE TRIGGER user_flags_vordr
AFTER UPDATE OF flags ON "user"
FOR EACH ROW
WHEN ((OLD.flags ->> 'vordr')::boolean IS DISTINCT FROM ((NEW.flags ->> 'vordr'))::boolean)
EXECUTE FUNCTION vordr_update_flags();`);

    await queryRunner.query(`DROP FUNCTION comment_flags_update_vordr`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE OR REPLACE FUNCTION comment_flags_update_vordr()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the 'vordr' key in the flags JSONB column has changed
  IF (NEW.flags ->> 'vordr')::boolean IS DISTINCT FROM (OLD.flags ->> 'vordr')::boolean THEN
    UPDATE comment
    SET flags = jsonb_set(flags, '{vordr}', to_jsonb((NEW.flags ->> 'vordr')::boolean))
    WHERE "userId" = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;`);

    await queryRunner.query(`CREATE OR REPLACE TRIGGER user_flags_vordr
AFTER UPDATE OF flags ON "user"
FOR EACH ROW
WHEN ((OLD.flags ->> 'vordr')::boolean IS DISTINCT FROM ((NEW.flags ->> 'vordr'))::boolean)
EXECUTE FUNCTION comment_flags_update_vordr();`);

    await queryRunner.query(`DROP FUNCTION vordr_update_flags`);
  }
}
