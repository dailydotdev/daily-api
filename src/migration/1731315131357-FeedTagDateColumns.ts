import { MigrationInterface, QueryRunner } from 'typeorm';

export class FeedTagDateColumns1731315131357 implements MigrationInterface {
  name = 'FeedTagDateColumns1731315131357';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "feed_tag" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "feed_tag" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_c04e86377257df2a6a4181421f" ON "feed_tag" ("updatedAt") `,
    );

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION feed_tag_updated_at_time()
        RETURNS TRIGGER
        LANGUAGE PLPGSQL
        AS
      $$
      BEGIN
        NEW."updatedAt" = now();
        RETURN NEW;
      END;
      $$
    `);
    await queryRunner.query(
      'CREATE OR REPLACE TRIGGER feed_tag_updated_at_update_trigger BEFORE UPDATE ON "feed_tag" FOR EACH ROW WHEN (OLD.blocked IS DISTINCT FROM NEW.blocked) EXECUTE PROCEDURE feed_tag_updated_at_time()',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS feed_tag_updated_at_update_trigger ON "feed_tag"',
    );
    await queryRunner.query('DROP FUNCTION IF EXISTS feed_tag_updated_at_time');

    await queryRunner.query(
      `DROP INDEX "public"."IDX_c04e86377257df2a6a4181421f"`,
    );

    await queryRunner.query(`ALTER TABLE "feed_tag" DROP COLUMN "updatedAt"`);
    await queryRunner.query(`ALTER TABLE "feed_tag" DROP COLUMN "createdAt"`);
  }
}
