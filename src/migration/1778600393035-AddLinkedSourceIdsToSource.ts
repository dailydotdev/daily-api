import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLinkedSourceIdsToSource1778600393035 implements MigrationInterface {
  name = 'AddLinkedSourceIdsToSource1778600393035';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "source"
      ADD COLUMN IF NOT EXISTS "linkedSourceIds" text[] NOT NULL DEFAULT '{}'
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_source_linked_source_ids"
      ON "source" USING gin ("linkedSourceIds")
      WHERE "linkedSourceIds" <> '{}'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_source_linked_source_ids"`,
    );

    await queryRunner.query(
      `ALTER TABLE "source" DROP COLUMN IF EXISTS "linkedSourceIds"`,
    );
  }
}
