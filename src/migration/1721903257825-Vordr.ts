import { MigrationInterface, QueryRunner } from "typeorm";

export class Vordr1721903257825 implements MigrationInterface {
  name = 'Vordr1721903257825'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" ADD "flags" jsonb NOT NULL DEFAULT '{}'`);
    await queryRunner.query(`ALTER TABLE "comment" ADD "flags" jsonb NOT NULL DEFAULT '{}'`);

    await queryRunner.query(`CREATE INDEX "IDX_user_flags_vordr" ON post USING HASH (((flags->'vordr')::boolean))`);
    await queryRunner.query(`CREATE INDEX "IDX_comment_flags_vordr" ON post USING HASH (((flags->'vordr')::boolean))`);

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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER user_flags_vordr ON "user"`);
    await queryRunner.query(`DROP FUNCTION comment_flags_update_vordr`);

    await queryRunner.query(`DROP INDEX "IDX_user_flags_vordr"`);
    await queryRunner.query(`DROP INDEX "IDX_comment_flags_vordr"`);

    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "flags"`);
    await queryRunner.query(`ALTER TABLE "comment" DROP COLUMN "flags"`);

  }
}
