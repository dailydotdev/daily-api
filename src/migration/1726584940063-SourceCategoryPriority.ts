import { MigrationInterface, QueryRunner } from 'typeorm';

export class SourceCategoryPriority1726584940063 implements MigrationInterface {
  name = 'SourceCategoryPriority1726584940063';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "source_category" WHERE "title" IN('Data', 'Cloud', 'DevOps', 'General')`,
    );
    await queryRunner.query(`
      INSERT INTO "source_category"
      (title, enabled)
      VALUES
      ('Basics', true),
      ('AI', true),
      ('DevRel', true),
      ('Open Source', true),
      ('DevOps & Cloud', true)
      ON CONFLICT DO NOTHING;
    `);
    await queryRunner.query(
      `ALTER TABLE "source_category" ADD "priority" integer`,
    );
    await queryRunner.query(
      `
        DO $$
        DECLARE
            categories TEXT[] := ARRAY['Basics','Web','Mobile','DevOps & Cloud','AI','Games','DevTools','Career','Open Source','DevRel','Fun'];
            i INT;
        BEGIN
            -- Iterate over the array and update the table
            FOR i IN 1..array_length(categories, 1) LOOP
                UPDATE source_category
                SET priority = i
                WHERE slug = trim(BOTH '-' FROM regexp_replace(lower(trim(COALESCE(LEFT(categories[i],100),''))), '[^a-z0-9-]+', '-', 'gi'));
            END LOOP;
        END $$;
      `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "source_category" DROP COLUMN "priority"`,
    );
    await queryRunner.query(
      `DELETE FROM "source_category" WHERE "title" IN(
        'Basics',
        'AI',
        'DevRel',
        'Open Source'
        'DevOps & Cloud'
      )`,
    );
    await queryRunner.query(`
      INSERT INTO "source_category"
      (title, enabled)
      VALUES
      ('General', true),
      ('Data', true),
      ('Cloud', true),
      ('DevOps', true),
      ON CONFLICT DO NOTHING;
    `);
  }
}
