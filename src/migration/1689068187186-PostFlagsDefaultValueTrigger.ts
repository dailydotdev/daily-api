import { MigrationInterface, QueryRunner } from "typeorm";

export class PostFlagsDefaultValueTrigger1689068187186 implements MigrationInterface {
    name = 'PostFlagsDefaultValueTrigger1689068187186'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
          CREATE OR REPLACE FUNCTION post_default_flags()
            RETURNS TRIGGER
            LANGUAGE PLPGSQL
            AS
          $$
          BEGIN
            NEW."flags" = '{"sentAnalyticsReport":true,"visible":true,"showOnFeed":true}' || NEW."flags";
            RETURN NEW;
          END;
          $$
        `)
        await queryRunner.query('CREATE TRIGGER post_default_flags_trigger BEFORE INSERT ON "post" FOR EACH ROW EXECUTE PROCEDURE post_default_flags()')
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
      await queryRunner.query('DROP TRIGGER IF EXISTS post_default_flags_trigger ON post')
      await queryRunner.query('DROP FUNCTION IF EXISTS post_default_flags')
    }

}
