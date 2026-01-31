import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSourceStack1769541356722 implements MigrationInterface {
  name = 'AddSourceStack1769541356722';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create the source_stack table
    await queryRunner.query(`
      CREATE TABLE "source_stack" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "sourceId" text NOT NULL,
        "toolId" uuid NOT NULL,
        "position" integer NOT NULL,
        "icon" text,
        "title" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "createdById" text NOT NULL,
        CONSTRAINT "PK_source_stack_id" PRIMARY KEY ("id")
      )
    `);

    // Add index on sourceId for efficient lookups
    await queryRunner.query(`
      CREATE INDEX "IDX_source_stack_source_id" ON "source_stack" ("sourceId")
    `);

    // Add unique constraint on (sourceId, toolId) to prevent duplicates
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_source_stack_source_tool_unique" ON "source_stack" ("sourceId", "toolId")
    `);

    // Add foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "source_stack"
      ADD CONSTRAINT "FK_source_stack_source_id"
      FOREIGN KEY ("sourceId") REFERENCES "source"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "source_stack"
      ADD CONSTRAINT "FK_source_stack_tool_id"
      FOREIGN KEY ("toolId") REFERENCES "dataset_tool"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "source_stack"
      ADD CONSTRAINT "FK_source_stack_created_by_id"
      FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "source_stack" DROP CONSTRAINT "FK_source_stack_created_by_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "source_stack" DROP CONSTRAINT "FK_source_stack_tool_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "source_stack" DROP CONSTRAINT "FK_source_stack_source_id"
    `);

    // Drop indexes
    await queryRunner.query(`
      DROP INDEX "IDX_source_stack_source_tool_unique"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_source_stack_source_id"
    `);

    // Drop the table
    await queryRunner.query(`
      DROP TABLE "source_stack"
    `);
  }
}
