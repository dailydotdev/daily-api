import { MigrationInterface, QueryRunner } from "typeorm";

export class AchievementSystem1770072115384 implements MigrationInterface {
  name = "AchievementSystem1770072115384";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      CREATE TABLE "achievement" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "name" text NOT NULL,
        "description" text NOT NULL,
        "image" text NOT NULL,
        "type" text NOT NULL,
        "eventType" text NOT NULL,
        "criteria" jsonb NOT NULL DEFAULT '{}',
        "points" smallint NOT NULL DEFAULT 5,
        CONSTRAINT "PK_achievement_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_achievement_name" UNIQUE ("name")
      )
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_achievement_eventType"
        ON "achievement" ("eventType")
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_achievement_type"
        ON "achievement" ("type")
    `);

    await queryRunner.query(/* sql */ `
      CREATE TABLE "user_achievement" (
        "achievementId" uuid NOT NULL,
        "userId" character varying(36) NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "progress" integer NOT NULL DEFAULT 0,
        "unlockedAt" TIMESTAMP,
        CONSTRAINT "PK_user_achievement" PRIMARY KEY ("achievementId", "userId")
      )
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_user_achievement_userId"
        ON "user_achievement" ("userId")
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_user_achievement_unlockedAt"
        ON "user_achievement" ("unlockedAt")
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_user_achievement_userId_unlockedAt"
        ON "user_achievement" ("userId", "unlockedAt")
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "user_achievement"
        ADD CONSTRAINT "FK_user_achievement_achievement_id"
          FOREIGN KEY ("achievementId")
          REFERENCES "achievement"("id")
          ON DELETE CASCADE
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "user_achievement"
        ADD CONSTRAINT "FK_user_achievement_user_id"
          FOREIGN KEY ("userId")
          REFERENCES "user"("id")
          ON DELETE CASCADE
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "user_achievement"
        REPLICA IDENTITY FULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DROP TABLE "user_achievement"
    `);

    await queryRunner.query(/* sql */ `
      DROP TABLE "achievement"
    `);

    await queryRunner.query(/* sql */ `
      DROP TYPE IF EXISTS "achievement_event_type_enum"
    `);

    await queryRunner.query(/* sql */ `
      DROP TYPE IF EXISTS "achievement_type_enum"
    `);
  }
}
