import { MigrationInterface, QueryRunner } from 'typeorm';

export class SharePostTrigger1706363895498 implements MigrationInterface {
  name = 'SharePostTrigger1706363895498';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_sharedPostId" ON "post" ("sharedPostId") `,
    );
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION shared_post_tags_on_insert()
      RETURNS TRIGGER AS $$
      DECLARE
        tags_str text;
      BEGIN
          IF NEW."sharedPostId" IS NOT NULL THEN
            SELECT "tagsStr" INTO tags_str
            FROM post
            WHERE id = NEW."sharedPostId";
            NEW."tagsStr" := tags_str;
          END IF;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      CREATE TRIGGER trigger_shared_post_tags_on_insert
      BEFORE INSERT ON public.post
      FOR EACH ROW
      EXECUTE FUNCTION shared_post_tags_on_insert();
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_shared_post_tags()
      RETURNS TRIGGER AS $$
      BEGIN
          IF NEW."tagsStr" <> OLD."tagsStr" THEN
            UPDATE post
            SET "tagsStr" = NEW."tagsStr", "metadataChangedAt" = now()
            WHERE "sharedPostId" = NEW.id;
          END IF;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      CREATE TRIGGER trigger_update_shared_post_tags
      AFTER UPDATE ON public.post
      FOR EACH ROW
      EXECUTE FUNCTION update_shared_post_tags();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trigger_update_shared_post_tags ON public.post;`,
    );
    await queryRunner.query(`DROP FUNCTION IF EXISTS update_shared_post_tags;`);

    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trigger_shared_post_tags_on_insert ON public.post;`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS shared_post_tags_on_insert;`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_sharedPostId"`);
  }
}
