import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInterestAgent1783950631791 implements MigrationInterface {
  name = 'AddInterestAgent1783950631791';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      CREATE TABLE "user_interest" (
        "id" text NOT NULL,
        "userId" character varying NOT NULL,
        "query" text NOT NULL,
        "status" text NOT NULL DEFAULT 'active',
        "fomoThreshold" double precision NOT NULL DEFAULT '0.5',
        "sources" jsonb NOT NULL DEFAULT '{}',
        "outputModes" jsonb NOT NULL DEFAULT '{}',
        "feedId" text,
        "sourceId" text,
        "cadence" text,
        "lastRunAt" TIMESTAMP WITH TIME ZONE,
        "lastRunSummary" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "REL_17854acd7f3935067dda7ea947" UNIQUE ("feedId"),
        CONSTRAINT "REL_b34c160b6f1030a5bbdb21f4d8" UNIQUE ("sourceId"),
        CONSTRAINT "PK_1c6d5a60c9ab471340bbebae61a" PRIMARY KEY ("id"),
        CONSTRAINT "FK_e7a1ea10dbef14192f738ceccde"
          FOREIGN KEY ("userId")
          REFERENCES "user"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION,
        CONSTRAINT "FK_17854acd7f3935067dda7ea9475"
          FOREIGN KEY ("feedId")
          REFERENCES "feed"("id")
          ON DELETE SET NULL
          ON UPDATE NO ACTION,
        CONSTRAINT "FK_b34c160b6f1030a5bbdb21f4d8d"
          FOREIGN KEY ("sourceId")
          REFERENCES "source"("id")
          ON DELETE SET NULL
          ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_user_interest_user_id"
        ON "user_interest" ("userId")
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_user_interest_user_id_status"
        ON "user_interest" ("userId", "status")
    `);

    await queryRunner.query(/* sql */ `
      CREATE TABLE "interest_finding" (
        "id" text NOT NULL,
        "interestId" text NOT NULL,
        "postId" text NOT NULL,
        "score" double precision NOT NULL DEFAULT '0',
        "rationale" text,
        "status" text NOT NULL DEFAULT 'new',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_6d95e0da2ef17ad3038c6c5b43c" PRIMARY KEY ("id"),
        CONSTRAINT "FK_cb7ab2e2bd63bbf69971dedadc8"
          FOREIGN KEY ("interestId")
          REFERENCES "user_interest"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION,
        CONSTRAINT "FK_1384faadc2cd63aced0128e083b"
          FOREIGN KEY ("postId")
          REFERENCES "post"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_interest_finding_interest_id_score"
        ON "interest_finding" ("interestId", "score")
    `);

    await queryRunner.query(/* sql */ `
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_interest_finding_interest_id_post_id"
        ON "interest_finding" ("interestId", "postId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DROP TABLE "interest_finding"
    `);

    await queryRunner.query(/* sql */ `
      DROP TABLE "user_interest"
    `);
  }
}
