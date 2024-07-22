import { MigrationInterface, QueryRunner } from "typeorm";

export class PostStatsUpdated1721301769783 implements MigrationInterface {
    name = 'PostStatsUpdated1721301769783'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "post" ADD "statsUpdatedAt" TIMESTAMP NOT NULL DEFAULT now()`);

        await queryRunner.query(`
          CREATE OR REPLACE FUNCTION post_stats_updated_at_time()
            RETURNS TRIGGER
            LANGUAGE PLPGSQL
            AS
          $$
          BEGIN
            NEW."statsUpdatedAt" = now();
            RETURN NEW;
          END;
          $$
        `)
        await queryRunner.query('CREATE OR REPLACE TRIGGER post_stats_updated_at_update_trigger BEFORE UPDATE ON "post" FOR EACH ROW WHEN (OLD.upvotes IS DISTINCT FROM NEW.upvotes OR OLD.downvotes IS DISTINCT FROM NEW.downvotes OR OLD.comments IS DISTINCT FROM NEW.comments) EXECUTE PROCEDURE post_stats_updated_at_time()')
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TRIGGER IF EXISTS post_stats_updated_at_update_trigger ON "post"')
        await queryRunner.query('DROP FUNCTION IF EXISTS post_stats_updated_at_time')

        await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "statsUpdatedAt"`);
    }

}
