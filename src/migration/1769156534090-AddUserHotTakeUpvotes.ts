import { MigrationInterface, QueryRunner } from 'typeorm';

export class HotTakeVoting1769156534090 implements MigrationInterface {
  name = 'HotTakeVoting1769156534090';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Rename user_hot_take to hot_take
    await queryRunner.query(`ALTER TABLE "user_hot_take" RENAME TO "hot_take"`);
    await queryRunner.query(`ALTER INDEX "IDX_user_hot_take_user_id" RENAME TO "IDX_hot_take_user_id"`);
    await queryRunner.query(`ALTER TABLE "hot_take" RENAME CONSTRAINT "PK_user_hot_take_id" TO "PK_hot_take_id"`);
    await queryRunner.query(`ALTER TABLE "hot_take" RENAME CONSTRAINT "FK_user_hot_take_user_id" TO "FK_hot_take_user_id"`);

    // Create new user_hot_take table (like user_post)
    await queryRunner.query(`
        CREATE TABLE "user_hot_take" (
          "hotTakeId" uuid NOT NULL,
          "userId" character varying NOT NULL,
          "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
          "votedAt" TIMESTAMP,
          "vote" smallint NOT NULL DEFAULT 0,
          CONSTRAINT "PK_user_hot_take" PRIMARY KEY ("hotTakeId", "userId")
        )
      `);
    await queryRunner.query(`CREATE INDEX "IDX_user_hot_take_hotTakeId_userId" ON "user_hot_take" ("hotTakeId", "userId")`);
    await queryRunner.query(`CREATE INDEX "IDX_user_hot_take_userId_vote_votedAt" ON "user_hot_take" ("userId", "vote", "votedAt")`);

    await queryRunner.query(`
        ALTER TABLE "user_hot_take"
          ADD CONSTRAINT "FK_user_hot_take_hot_take_id"
          FOREIGN KEY ("hotTakeId")
          REFERENCES "hot_take"("id")
          ON DELETE CASCADE
      `);
    await queryRunner.query(`
        ALTER TABLE "user_hot_take"
          ADD CONSTRAINT "FK_user_hot_take_user_id"
          FOREIGN KEY ("userId")
          REFERENCES "user"("id")
          ON DELETE CASCADE
      `);

    // Create votedAt trigger function
    await queryRunner.query(`
        CREATE OR REPLACE FUNCTION hot_take_voted_at_time()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW."votedAt" = now();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `);
    await queryRunner.query(`
        CREATE TRIGGER user_hot_take_voted_at_trigger
        BEFORE INSERT OR UPDATE ON user_hot_take
        FOR EACH ROW
        WHEN (NEW.vote IS DISTINCT FROM 0)
        EXECUTE FUNCTION hot_take_voted_at_time();
      `);

    // Create vote insert trigger
    await queryRunner.query(`
        CREATE OR REPLACE FUNCTION user_hot_take_vote_insert_trigger_function()
        RETURNS TRIGGER AS $$
        BEGIN
          IF NEW.vote = 1 THEN
            UPDATE hot_take SET upvotes = upvotes + 1 WHERE id = NEW."hotTakeId";
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `);
    await queryRunner.query(`
        CREATE TRIGGER user_hot_take_vote_insert_trigger
        AFTER INSERT ON user_hot_take
        FOR EACH ROW
        EXECUTE FUNCTION user_hot_take_vote_insert_trigger_function();
      `);

    // Create vote update trigger
    await queryRunner.query(`
        CREATE OR REPLACE FUNCTION user_hot_take_vote_update_trigger_function()
        RETURNS TRIGGER AS $$
        BEGIN
          IF OLD.vote IS DISTINCT FROM NEW.vote THEN
            IF OLD.vote = 0 AND NEW.vote = 1 THEN
              UPDATE hot_take SET upvotes = upvotes + 1 WHERE id = NEW."hotTakeId";
            ELSIF OLD.vote = 1 AND NEW.vote = 0 THEN
              UPDATE hot_take SET upvotes = upvotes - 1 WHERE id = NEW."hotTakeId";
            END IF;
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `);
    await queryRunner.query(`
        CREATE TRIGGER user_hot_take_vote_update_trigger
        AFTER UPDATE ON user_hot_take
        FOR EACH ROW
        EXECUTE FUNCTION user_hot_take_vote_update_trigger_function();
      `);

    // Create vote delete trigger
    await queryRunner.query(`
        CREATE OR REPLACE FUNCTION user_hot_take_vote_delete_trigger_function()
        RETURNS TRIGGER AS $$
        BEGIN
          IF OLD.vote = 1 THEN
            UPDATE hot_take SET upvotes = upvotes - 1 WHERE id = OLD."hotTakeId";
          END IF;
          RETURN OLD;
        END;
        $$ LANGUAGE plpgsql;
      `);
    await queryRunner.query(`
        CREATE TRIGGER user_hot_take_vote_delete_trigger
        AFTER DELETE ON user_hot_take
        FOR EACH ROW
        EXECUTE FUNCTION user_hot_take_vote_delete_trigger_function();
      `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop triggers
    await queryRunner.query('DROP TRIGGER IF EXISTS user_hot_take_vote_delete_trigger ON user_hot_take');
    await queryRunner.query('DROP FUNCTION IF EXISTS user_hot_take_vote_delete_trigger_function');
    await queryRunner.query('DROP TRIGGER IF EXISTS user_hot_take_vote_update_trigger ON user_hot_take');
    await queryRunner.query('DROP FUNCTION IF EXISTS user_hot_take_vote_update_trigger_function');
    await queryRunner.query('DROP TRIGGER IF EXISTS user_hot_take_vote_insert_trigger ON user_hot_take');
    await queryRunner.query('DROP FUNCTION IF EXISTS user_hot_take_vote_insert_trigger_function');
    await queryRunner.query('DROP TRIGGER IF EXISTS user_hot_take_voted_at_trigger ON user_hot_take');
    await queryRunner.query('DROP FUNCTION IF EXISTS hot_take_voted_at_time');

    // Drop user_hot_take table
    await queryRunner.query('ALTER TABLE "user_hot_take" DROP CONSTRAINT "FK_user_hot_take_user_id"');
    await queryRunner.query('ALTER TABLE "user_hot_take" DROP CONSTRAINT "FK_user_hot_take_hot_take_id"');
    await queryRunner.query('DROP INDEX "IDX_user_hot_take_userId_vote_votedAt"');
    await queryRunner.query('DROP INDEX "IDX_user_hot_take_hotTakeId_userId"');
    await queryRunner.query('DROP TABLE "user_hot_take"');

    // Rename hot_take back to user_hot_take
    await queryRunner.query('ALTER TABLE "hot_take" RENAME CONSTRAINT "FK_hot_take_user_id" TO "FK_user_hot_take_user_id"');
    await queryRunner.query('ALTER TABLE "hot_take" RENAME CONSTRAINT "PK_hot_take_id" TO "PK_user_hot_take_id"');
    await queryRunner.query('ALTER INDEX "IDX_hot_take_user_id" RENAME TO "IDX_user_hot_take_user_id"');
    await queryRunner.query('ALTER TABLE "hot_take" RENAME TO "user_hot_take"');
  }
}
