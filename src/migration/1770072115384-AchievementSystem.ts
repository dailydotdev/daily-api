import { MigrationInterface, QueryRunner } from 'typeorm';

export class AchievementSystem1770072115384 implements MigrationInterface {
  name = 'AchievementSystem1770072115384';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create achievement table
    await queryRunner.query(`
      CREATE TABLE "achievement" (
        "id"          uuid DEFAULT uuid_generate_v4() NOT NULL,
        "createdAt"   TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMP NOT NULL DEFAULT now(),
        "name"        text NOT NULL,
        "description" text NOT NULL,
        "image"       text NOT NULL,
        "type"        text NOT NULL,
        "eventType"   text NOT NULL,
        "criteria"    jsonb NOT NULL DEFAULT '{}',
        "points"      smallint NOT NULL DEFAULT 5,
        CONSTRAINT "PK_achievement_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_achievement_name" UNIQUE ("name")
      )
    `);

    // Create indexes on achievement table
    await queryRunner.query(`CREATE INDEX "IDX_achievement_eventType" ON "achievement" ("eventType")`);
    await queryRunner.query(`CREATE INDEX "IDX_achievement_type" ON "achievement" ("type")`);

    // Create user_achievement table
    await queryRunner.query(`
      CREATE TABLE "user_achievement" (
        "achievementId" uuid NOT NULL,
        "userId"        character varying(36) NOT NULL,
        "createdAt"     TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"     TIMESTAMP NOT NULL DEFAULT now(),
        "progress"      integer NOT NULL DEFAULT 0,
        "unlockedAt"    TIMESTAMP,
        CONSTRAINT "PK_user_achievement" PRIMARY KEY ("achievementId", "userId")
      )
    `);

    // Create indexes on user_achievement table
    await queryRunner.query(`CREATE INDEX "IDX_user_achievement_userId" ON "user_achievement" ("userId")`);
    await queryRunner.query(`CREATE INDEX "IDX_user_achievement_unlockedAt" ON "user_achievement" ("unlockedAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_user_achievement_userId_unlockedAt" ON "user_achievement" ("userId", "unlockedAt")`);

    // Add foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "user_achievement"
        ADD CONSTRAINT "FK_user_achievement_achievement_id"
        FOREIGN KEY ("achievementId")
        REFERENCES "achievement"("id")
        ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "user_achievement"
        ADD CONSTRAINT "FK_user_achievement_user_id"
        FOREIGN KEY ("userId")
        REFERENCES "user"("id")
        ON DELETE CASCADE
    `);

    // Set REPLICA IDENTITY FULL for CDC support
    await queryRunner.query(`ALTER TABLE "user_achievement" REPLICA IDENTITY FULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints
    await queryRunner.query(`ALTER TABLE "user_achievement" DROP CONSTRAINT "FK_user_achievement_user_id"`);
    await queryRunner.query(`ALTER TABLE "user_achievement" DROP CONSTRAINT "FK_user_achievement_achievement_id"`);

    // Drop indexes
    await queryRunner.query(`DROP INDEX "IDX_user_achievement_userId_unlockedAt"`);
    await queryRunner.query(`DROP INDEX "IDX_user_achievement_unlockedAt"`);
    await queryRunner.query(`DROP INDEX "IDX_user_achievement_userId"`);
    await queryRunner.query(`DROP INDEX "IDX_achievement_type"`);
    await queryRunner.query(`DROP INDEX "IDX_achievement_eventType"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE "user_achievement"`);
    await queryRunner.query(`DROP TABLE "achievement"`);

    // Drop enums
    await queryRunner.query(`DROP TYPE "achievement_event_type_enum"`);
    await queryRunner.query(`DROP TYPE "achievement_type_enum"`);
  }
}
