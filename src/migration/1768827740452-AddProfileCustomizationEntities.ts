import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProfileCustomizationEntities1768827740452
  implements MigrationInterface
{
  name = 'AddProfileCustomizationEntities1768827740452';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create dataset tables
    await queryRunner.query(`
      CREATE TABLE "dataset_stack" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" text NOT NULL,
        "titleNormalized" text NOT NULL,
        "icon" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_dataset_stack_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_dataset_stack_title_normalized_unique"
        ON "dataset_stack" ("titleNormalized")
    `);

    await queryRunner.query(`
      CREATE TABLE "dataset_gear" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" text NOT NULL,
        "nameNormalized" text NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_dataset_gear_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_dataset_gear_name_normalized_unique"
        ON "dataset_gear" ("nameNormalized")
    `);

    await queryRunner.query(`
      CREATE TABLE "dataset_tool" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" text NOT NULL,
        "titleNormalized" text NOT NULL,
        "url" text,
        "faviconUrl" text,
        "faviconSource" text NOT NULL DEFAULT 'none',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_dataset_tool_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_dataset_tool_title_normalized_unique"
        ON "dataset_tool" ("titleNormalized")
    `);

    // Create user tables
    await queryRunner.query(`
      CREATE TABLE "user_stack" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" text NOT NULL,
        "stackId" uuid NOT NULL,
        "section" text NOT NULL,
        "position" integer NOT NULL,
        "startedAt" date,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_stack_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_user_stack_user_id" ON "user_stack" ("userId")
    `);
    await queryRunner.query(`
      ALTER TABLE "user_stack"
        ADD CONSTRAINT "FK_user_stack_user_id"
          FOREIGN KEY ("userId")
          REFERENCES "user"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "user_stack"
        ADD CONSTRAINT "FK_user_stack_stack_id"
          FOREIGN KEY ("stackId")
          REFERENCES "dataset_stack"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "user_hot_take" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" text NOT NULL,
        "emoji" text NOT NULL,
        "title" text NOT NULL,
        "subtitle" text,
        "position" integer NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_hot_take_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_user_hot_take_user_id" ON "user_hot_take" ("userId")
    `);
    await queryRunner.query(`
      ALTER TABLE "user_hot_take"
        ADD CONSTRAINT "FK_user_hot_take_user_id"
          FOREIGN KEY ("userId")
          REFERENCES "user"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "user_workspace_photo" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" text NOT NULL,
        "image" text NOT NULL,
        "position" integer NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_workspace_photo_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_user_workspace_photo_user_id"
        ON "user_workspace_photo" ("userId")
    `);
    await queryRunner.query(`
      ALTER TABLE "user_workspace_photo"
        ADD CONSTRAINT "FK_user_workspace_photo_user_id"
          FOREIGN KEY ("userId")
          REFERENCES "user"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "user_gear" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" text NOT NULL,
        "gearId" uuid NOT NULL,
        "position" integer NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_gear_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_user_gear_user_id" ON "user_gear" ("userId")
    `);
    await queryRunner.query(`
      ALTER TABLE "user_gear"
        ADD CONSTRAINT "FK_user_gear_user_id"
          FOREIGN KEY ("userId")
          REFERENCES "user"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "user_gear"
        ADD CONSTRAINT "FK_user_gear_gear_id"
          FOREIGN KEY ("gearId")
          REFERENCES "dataset_gear"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "user_tool" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" text NOT NULL,
        "toolId" uuid NOT NULL,
        "category" text NOT NULL,
        "position" integer NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_tool_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_user_tool_user_id" ON "user_tool" ("userId")
    `);
    await queryRunner.query(`
      ALTER TABLE "user_tool"
        ADD CONSTRAINT "FK_user_tool_user_id"
          FOREIGN KEY ("userId")
          REFERENCES "user"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "user_tool"
        ADD CONSTRAINT "FK_user_tool_tool_id"
          FOREIGN KEY ("toolId")
          REFERENCES "dataset_tool"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop user tables (in reverse order due to foreign keys)
    await queryRunner.query(
      `ALTER TABLE "user_tool" DROP CONSTRAINT "FK_user_tool_tool_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_tool" DROP CONSTRAINT "FK_user_tool_user_id"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_user_tool_user_id"`);
    await queryRunner.query(`DROP TABLE "user_tool"`);

    await queryRunner.query(
      `ALTER TABLE "user_gear" DROP CONSTRAINT "FK_user_gear_gear_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_gear" DROP CONSTRAINT "FK_user_gear_user_id"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_user_gear_user_id"`);
    await queryRunner.query(`DROP TABLE "user_gear"`);

    await queryRunner.query(
      `ALTER TABLE "user_workspace_photo" DROP CONSTRAINT "FK_user_workspace_photo_user_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_user_workspace_photo_user_id"`,
    );
    await queryRunner.query(`DROP TABLE "user_workspace_photo"`);

    await queryRunner.query(
      `ALTER TABLE "user_hot_take" DROP CONSTRAINT "FK_user_hot_take_user_id"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_user_hot_take_user_id"`);
    await queryRunner.query(`DROP TABLE "user_hot_take"`);

    await queryRunner.query(
      `ALTER TABLE "user_stack" DROP CONSTRAINT "FK_user_stack_stack_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_stack" DROP CONSTRAINT "FK_user_stack_user_id"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_user_stack_user_id"`);
    await queryRunner.query(`DROP TABLE "user_stack"`);

    // Drop dataset tables
    await queryRunner.query(
      `DROP INDEX "public"."IDX_dataset_tool_title_normalized_unique"`,
    );
    await queryRunner.query(`DROP TABLE "dataset_tool"`);

    await queryRunner.query(
      `DROP INDEX "public"."IDX_dataset_gear_name_normalized_unique"`,
    );
    await queryRunner.query(`DROP TABLE "dataset_gear"`);

    await queryRunner.query(
      `DROP INDEX "public"."IDX_dataset_stack_title_normalized_unique"`,
    );
    await queryRunner.query(`DROP TABLE "dataset_stack"`);
  }
}
