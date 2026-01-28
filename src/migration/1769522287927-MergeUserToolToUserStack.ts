import { MigrationInterface, QueryRunner } from 'typeorm';

export class MergeUserToolToUserStack1769522287927
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Migrate UserTool data to UserStack
    // Map category -> section, and set startedAt, icon, title to null
    // Add 1000 to position to avoid conflicts with existing stack items
    await queryRunner.query(`
      INSERT INTO user_stack (id, "userId", "toolId", section, position, "startedAt", icon, title, "createdAt")
      SELECT
        id,
        "userId",
        "toolId",
        category as section,
        position + 1000,
        NULL,
        NULL,
        NULL,
        "createdAt"
      FROM user_tool
      ON CONFLICT DO NOTHING
    `);

    // Step 2: Drop the user_tool table
    await queryRunner.query(`
      DROP TABLE IF EXISTS user_tool
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Recreate the user_tool table
    await queryRunner.query(`
      CREATE TABLE "user_tool" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" text NOT NULL,
        "toolId" uuid NOT NULL,
        "category" text NOT NULL,
        "position" integer NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_tool_id" PRIMARY KEY ("id")
      )
    `);

    // Step 2: Add index on userId
    await queryRunner.query(`
      CREATE INDEX "IDX_user_tool_user_id" ON "user_tool" ("userId")
    `);

    // Step 3: Add foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "user_tool"
      ADD CONSTRAINT "FK_user_tool_user_id"
      FOREIGN KEY ("userId") REFERENCES "user"(id) ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "user_tool"
      ADD CONSTRAINT "FK_user_tool_tool_id"
      FOREIGN KEY ("toolId") REFERENCES dataset_tool(id) ON DELETE CASCADE
    `);

    // Step 4: Migrate tool sections back from user_stack to user_tool
    // Tool categories were: Development, Design, Productivity, Communication, AI
    await queryRunner.query(`
      INSERT INTO user_tool (id, "userId", "toolId", category, position, "createdAt")
      SELECT
        id,
        "userId",
        "toolId",
        section as category,
        position - 1000,
        "createdAt"
      FROM user_stack
      WHERE section IN ('Development', 'Design', 'Productivity', 'Communication', 'AI')
    `);

    // Step 5: Delete the migrated items from user_stack
    await queryRunner.query(`
      DELETE FROM user_stack
      WHERE section IN ('Development', 'Design', 'Productivity', 'Communication', 'AI')
    `);
  }
}
