import { MigrationInterface, QueryRunner } from 'typeorm';

export class SourceCategoryPriority1726584940063 implements MigrationInterface {
  name = 'SourceCategoryPriority1726584940063';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "source_category"`);
    await queryRunner.query(
      `ALTER TABLE "source_category" ADD "priority" integer`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_source_category_priority" ON "source_category" ("priority") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_source_category_priority"`,
    );
    await queryRunner.query(
      `ALTER TABLE "source_category" DROP COLUMN "priority"`,
    );
    await queryRunner.query(`
      INSERT INTO "source_category"
      (title, enabled)
      VALUES
      ('General', true),
      ('Web', true),
      ('Mobile', true),
      ('Games', true),
      ('DevOps', true),
      ('Cloud', true),
      ('Career', true),
      ('Data', true),
      ('Fun', true),
      ('DevTools', true)
      ON CONFLICT DO NOTHING;
    `);
  }
}
