import { MigrationInterface, QueryRunner } from "typeorm";

export class MergeDatasetStackToTool1769072476606 implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Add the new toolId column (nullable initially)
    await queryRunner.query(`
        ALTER TABLE user_stack
        ADD COLUMN "toolId" uuid
      `);

    // Step 2: Insert any missing dataset_stack entries into dataset_tool
    await queryRunner.query(`
        INSERT INTO dataset_tool (id, title, "titleNormalized", "faviconUrl", "faviconSource", "createdAt", "updatedAt")
        SELECT
          gen_random_uuid(),
          ds.title,
          ds."titleNormalized",
          NULL,
          'none',
          ds."createdAt",
          ds."createdAt"
        FROM dataset_stack ds
        WHERE NOT EXISTS (
          SELECT 1 FROM dataset_tool dt WHERE dt."titleNormalized" = ds."titleNormalized"
        )
      `);

    // Step 3: Update toolId to point to matching dataset_tool entries
    await queryRunner.query(`
        UPDATE user_stack us
        SET "toolId" = dt.id
        FROM dataset_stack ds
        JOIN dataset_tool dt ON dt."titleNormalized" = ds."titleNormalized"
        WHERE us."stackId" = ds.id
      `);

    // Step 4: Drop the old foreign key and stackId column
    await queryRunner.query(`
        ALTER TABLE user_stack
        DROP CONSTRAINT IF EXISTS "FK_user_stack_stack_id"
      `);

    await queryRunner.query(`
        ALTER TABLE user_stack
        DROP COLUMN "stackId"
      `);

    // Step 5: Make toolId NOT NULL and add foreign key
    await queryRunner.query(`
        ALTER TABLE user_stack
        ALTER COLUMN "toolId" SET NOT NULL
      `);

    await queryRunner.query(`
        ALTER TABLE user_stack
        ADD CONSTRAINT "FK_user_stack_tool_id"
        FOREIGN KEY ("toolId") REFERENCES dataset_tool(id) ON DELETE CASCADE
      `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE user_stack
        DROP CONSTRAINT IF EXISTS "FK_user_stack_tool_id"
      `);

    await queryRunner.query(`
        ALTER TABLE user_stack
        RENAME COLUMN "toolId" TO "stackId"
      `);

    await queryRunner.query(`
        ALTER TABLE user_stack
        ADD CONSTRAINT "FK_user_stack_stack_id"
        FOREIGN KEY ("stackId") REFERENCES dataset_stack(id) ON DELETE CASCADE
      `);
  }
}
