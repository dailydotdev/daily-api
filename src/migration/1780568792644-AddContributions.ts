import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddContributions1780568792644 implements MigrationInterface {
  name = 'AddContributions1780568792644';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      CREATE TABLE "contribution_action" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        "categoryId" uuid,
        "title" text NOT NULL,
        "description" text,
        "points" integer NOT NULL,
        "evidence" jsonb NOT NULL DEFAULT '{}',
        "cooldownSeconds" integer,
        "maxPerUser" integer,
        "active" boolean NOT NULL DEFAULT true,
        "sortOrder" integer NOT NULL DEFAULT '0',
        CONSTRAINT "PK_contribution_action_id"
          PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_contribution_action_categoryId"
        ON "contribution_action" ("categoryId")
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_contribution_action_active_sort"
        ON "contribution_action" ("active", "sortOrder", "createdAt")
    `);

    await queryRunner.query(/* sql */ `
      CREATE TABLE "contribution_action_category" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        "title" text NOT NULL,
        "active" boolean NOT NULL DEFAULT true,
        "sortOrder" integer NOT NULL DEFAULT '0',
        CONSTRAINT "PK_contribution_action_category_id"
          PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_contribution_action_category_active_sort"
        ON "contribution_action_category" ("active", "sortOrder", "createdAt")
    `);

    await queryRunner.query(/* sql */ `
      CREATE TABLE "contribution_blocked_user" (
        "userId" character varying(36) NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "reason" text,
        CONSTRAINT "PK_contribution_blocked_user"
          PRIMARY KEY ("userId")
      )
    `);

    await queryRunner.query(/* sql */ `
      CREATE TABLE "contribution_cause" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        "title" text NOT NULL,
        "url" text,
        "active" boolean NOT NULL DEFAULT true,
        "sortOrder" integer NOT NULL DEFAULT '0',
        CONSTRAINT "PK_contribution_cause_id"
          PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_contribution_cause_active_sort"
        ON "contribution_cause" ("active", "sortOrder", "createdAt")
    `);

    await queryRunner.query(/* sql */ `
      CREATE TABLE "contribution_payment" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        "status" text NOT NULL DEFAULT 'draft',
        "totalPoints" integer NOT NULL DEFAULT '0',
        "amountCents" integer NOT NULL DEFAULT '0',
        "createdBy" character varying(36),
        "finalizedAt" timestamp,
        CONSTRAINT "PK_contribution_payment_id"
          PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(/* sql */ `
      CREATE TABLE "contribution_payment_allocation" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "paymentId" uuid NOT NULL,
        "causeId" uuid NOT NULL,
        "userId" character varying(36) NOT NULL,
        "points" integer NOT NULL,
        "amountCents" integer NOT NULL,
        CONSTRAINT "PK_contribution_payment_allocation_id"
          PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_contribution_payment_allocation_paymentId"
        ON "contribution_payment_allocation" ("paymentId")
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_contribution_payment_allocation_causeId"
        ON "contribution_payment_allocation" ("causeId")
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_contribution_payment_allocation_userId"
        ON "contribution_payment_allocation" ("userId")
    `);

    await queryRunner.query(/* sql */ `
      CREATE TABLE "contribution_reward_tier" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        "title" text NOT NULL,
        "description" text,
        "thresholdPoints" integer NOT NULL,
        "rewardType" text NOT NULL,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "active" boolean NOT NULL DEFAULT true,
        "sortOrder" integer NOT NULL DEFAULT '0',
        CONSTRAINT "PK_contribution_reward_tier_id"
          PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_contribution_reward_tier_active_sort"
        ON "contribution_reward_tier" ("active", "sortOrder", "createdAt")
    `);

    await queryRunner.query(/* sql */ `
      CREATE TABLE "contribution_submission" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        "userId" character varying(36) NOT NULL,
        "actionId" uuid NOT NULL,
        "paymentId" uuid,
        "evidence" jsonb NOT NULL DEFAULT '{}',
        "status" text NOT NULL DEFAULT 'approved',
        "awardedPoints" integer NOT NULL,
        "flags" jsonb NOT NULL DEFAULT '{}',
        "reviewedAt" timestamp,
        "reviewedBy" character varying(36),
        CONSTRAINT "PK_contribution_submission_id"
          PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_contribution_submission_userId_status"
        ON "contribution_submission" ("userId", "status")
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_contribution_submission_status_paymentId"
        ON "contribution_submission" ("status", "paymentId")
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_contribution_submission_userId_actionId"
        ON "contribution_submission" ("userId", "actionId")
    `);

    await queryRunner.query(/* sql */ `
      CREATE TABLE "user_contribution_cause_preference" (
        "userId" character varying(36) NOT NULL,
        "causeId" uuid NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_contribution_cause_preference"
          PRIMARY KEY ("userId", "causeId")
      )
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_user_contribution_cause_preference_causeId"
        ON "user_contribution_cause_preference" ("causeId")
    `);

    await queryRunner.query(/* sql */ `
      CREATE TABLE "user_contribution_reward" (
        "tierId" uuid NOT NULL,
        "userId" character varying(36) NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        "status" text NOT NULL DEFAULT 'claimed',
        "claimedAt" timestamp,
        "fulfilledAt" timestamp,
        CONSTRAINT "PK_user_contribution_reward"
          PRIMARY KEY ("tierId", "userId")
      )
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_user_contribution_reward_userId_status"
        ON "user_contribution_reward" ("userId", "status")
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "contribution_action"
        ADD CONSTRAINT "FK_contribution_action_category_id"
        FOREIGN KEY ("categoryId")
        REFERENCES "contribution_action_category"("id")
        ON DELETE SET NULL
        ON UPDATE NO ACTION
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "contribution_blocked_user"
        ADD CONSTRAINT "FK_contribution_blocked_user_user_id"
        FOREIGN KEY ("userId")
        REFERENCES "user"("id")
        ON DELETE CASCADE
        ON UPDATE NO ACTION
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "contribution_payment_allocation"
        ADD CONSTRAINT "FK_contribution_payment_allocation_payment_id"
        FOREIGN KEY ("paymentId")
        REFERENCES "contribution_payment"("id")
        ON DELETE CASCADE
        ON UPDATE NO ACTION
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "contribution_payment_allocation"
        ADD CONSTRAINT "FK_contribution_payment_allocation_cause_id"
        FOREIGN KEY ("causeId")
        REFERENCES "contribution_cause"("id")
        ON DELETE CASCADE
        ON UPDATE NO ACTION
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "contribution_payment_allocation"
        ADD CONSTRAINT "FK_contribution_payment_allocation_user_id"
        FOREIGN KEY ("userId")
        REFERENCES "user"("id")
        ON DELETE CASCADE
        ON UPDATE NO ACTION
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "contribution_submission"
        ADD CONSTRAINT "FK_contribution_submission_action_id"
        FOREIGN KEY ("actionId")
        REFERENCES "contribution_action"("id")
        ON DELETE CASCADE
        ON UPDATE NO ACTION
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "contribution_submission"
        ADD CONSTRAINT "FK_contribution_submission_payment_id"
        FOREIGN KEY ("paymentId")
        REFERENCES "contribution_payment"("id")
        ON DELETE SET NULL
        ON UPDATE NO ACTION
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "contribution_submission"
        ADD CONSTRAINT "FK_contribution_submission_user_id"
        FOREIGN KEY ("userId")
        REFERENCES "user"("id")
        ON DELETE CASCADE
        ON UPDATE NO ACTION
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "user_contribution_cause_preference"
        ADD CONSTRAINT "FK_user_contribution_cause_preference_cause_id"
        FOREIGN KEY ("causeId")
        REFERENCES "contribution_cause"("id")
        ON DELETE CASCADE
        ON UPDATE NO ACTION
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "user_contribution_cause_preference"
        ADD CONSTRAINT "FK_user_contribution_cause_preference_user_id"
        FOREIGN KEY ("userId")
        REFERENCES "user"("id")
        ON DELETE CASCADE
        ON UPDATE NO ACTION
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "user_contribution_reward"
        ADD CONSTRAINT "FK_user_contribution_reward_tier_id"
        FOREIGN KEY ("tierId")
        REFERENCES "contribution_reward_tier"("id")
        ON DELETE CASCADE
        ON UPDATE NO ACTION
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "user_contribution_reward"
        ADD CONSTRAINT "FK_user_contribution_reward_user_id"
        FOREIGN KEY ("userId")
        REFERENCES "user"("id")
        ON DELETE CASCADE
        ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      ALTER TABLE "user_contribution_reward"
        DROP CONSTRAINT "FK_user_contribution_reward_user_id"
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "user_contribution_reward"
        DROP CONSTRAINT "FK_user_contribution_reward_tier_id"
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "user_contribution_cause_preference"
        DROP CONSTRAINT "FK_user_contribution_cause_preference_user_id"
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "user_contribution_cause_preference"
        DROP CONSTRAINT "FK_user_contribution_cause_preference_cause_id"
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "contribution_submission"
        DROP CONSTRAINT "FK_contribution_submission_user_id"
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "contribution_submission"
        DROP CONSTRAINT "FK_contribution_submission_payment_id"
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "contribution_submission"
        DROP CONSTRAINT "FK_contribution_submission_action_id"
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "contribution_payment_allocation"
        DROP CONSTRAINT "FK_contribution_payment_allocation_user_id"
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "contribution_payment_allocation"
        DROP CONSTRAINT "FK_contribution_payment_allocation_cause_id"
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "contribution_payment_allocation"
        DROP CONSTRAINT "FK_contribution_payment_allocation_payment_id"
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "contribution_blocked_user"
        DROP CONSTRAINT "FK_contribution_blocked_user_user_id"
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "contribution_action"
        DROP CONSTRAINT "FK_contribution_action_category_id"
    `);

    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "IDX_user_contribution_reward_userId_status"
    `);

    await queryRunner.query(/* sql */ `
      DROP TABLE "user_contribution_reward"
    `);

    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "IDX_user_contribution_cause_preference_causeId"
    `);

    await queryRunner.query(/* sql */ `
      DROP TABLE "user_contribution_cause_preference"
    `);

    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "IDX_contribution_submission_userId_actionId"
    `);

    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "IDX_contribution_submission_status_paymentId"
    `);

    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "IDX_contribution_submission_userId_status"
    `);

    await queryRunner.query(/* sql */ `
      DROP TABLE "contribution_submission"
    `);

    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "IDX_contribution_reward_tier_active_sort"
    `);

    await queryRunner.query(/* sql */ `
      DROP TABLE "contribution_reward_tier"
    `);

    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "IDX_contribution_payment_allocation_userId"
    `);

    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "IDX_contribution_payment_allocation_causeId"
    `);

    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "IDX_contribution_payment_allocation_paymentId"
    `);

    await queryRunner.query(/* sql */ `
      DROP TABLE "contribution_payment_allocation"
    `);

    await queryRunner.query(/* sql */ `
      DROP TABLE "contribution_payment"
    `);

    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "IDX_contribution_cause_active_sort"
    `);

    await queryRunner.query(/* sql */ `
      DROP TABLE "contribution_cause"
    `);

    await queryRunner.query(/* sql */ `
      DROP TABLE "contribution_blocked_user"
    `);

    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "IDX_contribution_action_category_active_sort"
    `);

    await queryRunner.query(/* sql */ `
      DROP TABLE "contribution_action_category"
    `);

    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "IDX_contribution_action_active_sort"
    `);

    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "IDX_contribution_action_categoryId"
    `);

    await queryRunner.query(/* sql */ `
      DROP TABLE "contribution_action"
    `);
  }
}
