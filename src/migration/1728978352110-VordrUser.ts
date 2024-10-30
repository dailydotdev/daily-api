import { MigrationInterface, QueryRunner } from "typeorm";

export class VordrUser1728978352110 implements MigrationInterface {
  name = 'VordrUser1728978352110'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX "IDX_post_flags_vordr" ON post (((flags->'vordr')::boolean))`);

    await queryRunner.query(`CREATE OR REPLACE FUNCTION vordr_update_flags()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.flags @> '{"vordr": true}' THEN
    -- If vordr on user is set to true
    -- Set showOnFeed to false and vordr to true in post table, and set vordr to true in comment table
    UPDATE
      post
    SET
      "showOnFeed" = FALSE,
      "flags" = jsonb_set(jsonb_set(flags,
        '{vordr}', 'true', true),         -- set vordr to true
        '{showOnFeed}', 'false', true)    -- set showOnFeed to true
    WHERE
      ("authorId" = NEW.id OR "scoutId" = NEW.id)
      AND "showOnFeed" = TRUE;

    UPDATE
      comment
    SET
      "flags" = jsonb_set(flags, '{vordr}', 'true', true)
    WHERE
      "userId" = NEW.id;

  -- If vordr on user is set to false, and vordr on post is true
  -- Set showOnFeed to true and vordr to false in post table, and set vordr to false in comment table
  ELSIF NEW.flags @> '{"vordr": false}' THEN
    UPDATE
      post
    SET
      "showOnFeed" = TRUE,
      "flags" = jsonb_set(jsonb_set(flags,
        '{vordr}', 'false', true),        -- set vordr to false
        '{showOnFeed}', 'true', true)     -- set showOnFeed to true
    WHERE
      ("authorId" = NEW.id OR "scoutId" = NEW.id)
      AND (flags->'vordr')::boolean = true;

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
WHEN (OLD.flags -> 'vordr' IS DISTINCT FROM NEW.flags -> 'vordr')
EXECUTE FUNCTION vordr_update_flags();`);

    await queryRunner.query(`DROP FUNCTION comment_flags_update_vordr`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_post_flags_vordr"`);

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
