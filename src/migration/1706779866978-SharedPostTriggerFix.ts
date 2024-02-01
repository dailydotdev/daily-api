import { MigrationInterface, QueryRunner } from 'typeorm';

export class SharedPostTriggerFix1706779866978 implements MigrationInterface {
  name = 'SharedPostTriggerFix1706779866978';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_shared_post_tags()
      RETURNS TRIGGER AS $$
      BEGIN
          IF NEW."tagsStr" IS DISTINCT FROM OLD."tagsStr" THEN
            UPDATE post
            SET "tagsStr" = NEW."tagsStr", "metadataChangedAt" = now()
            WHERE "sharedPostId" = NEW.id;
          END IF;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      CREATE OR REPLACE TRIGGER trigger_update_shared_post_tags
      AFTER UPDATE ON public.post
      FOR EACH ROW
      EXECUTE FUNCTION update_shared_post_tags();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
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
      CREATE OR REPLACE TRIGGER trigger_update_shared_post_tags
      AFTER UPDATE ON public.post
      FOR EACH ROW
      EXECUTE FUNCTION update_shared_post_tags();
    `);
  }
}
