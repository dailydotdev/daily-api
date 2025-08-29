import { MigrationInterface, QueryRunner } from "typeorm";

export class Opportunity1756461014954 implements MigrationInterface {
  name = 'Opportunity1756461014954'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      CREATE TABLE "opportunity"(
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "type" text NOT NULL,
        "state" text NOT NULL,
        "title" text NOT NULL,
        "tldr" text NOT NULL,
        "content" jsonb NOT NULL DEFAULT '{}',
        "meta" jsonb NOT NULL DEFAULT '{}',
        "organizationId" text,
        "location" jsonb DEFAULT '[]',
        CONSTRAINT "PK_Opportunity_Id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_opportunity_organization_id"
          FOREIGN KEY ("organizationId")
          REFERENCES "organization"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "public"."opportunity" REPLICA IDENTITY FULL
    `);
    await queryRunner.query(/* sql */`
      CREATE INDEX IF NOT EXISTS "IDX_opportunity_type" ON "opportunity" ("type")
    `);
    await queryRunner.query(/* sql */`
      CREATE INDEX IF NOT EXISTS "IDX_opportunity_organization_id" ON "opportunity" ("organizationId")
    `);

    await queryRunner.query(/* sql */`
      CREATE TABLE "opportunity_user"(
        "opportunityId" uuid NOT NULL,
        "userId" character varying NOT NULL,
        "type" text NOT NULL,
        CONSTRAINT "PK_opportunity_user" PRIMARY KEY ("opportunityId", "userId"),
        CONSTRAINT "FK_opportunity_user_opportunity_id"
          FOREIGN KEY ("opportunityId")
          REFERENCES "opportunity"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION,
        CONSTRAINT "FK_opportunity_user_user_id"
          FOREIGN KEY ("userId")
          REFERENCES "user"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(/* sql */`
      CREATE INDEX IF NOT EXISTS "IDX_opportunity_user_user_id" ON "opportunity_user" ("userId")
    `);

    await queryRunner.query(/* sql */`
      CREATE INDEX IF NOT EXISTS "IDX_opportunity_user_type" ON "opportunity_user" ("type")
    `);

    await queryRunner.query(/* sql */`
      CREATE TABLE "opportunity_keyword"(
        "opportunityId" uuid NOT NULL,
        "keyword" text NOT NULL,
        CONSTRAINT "PK_opportunity_keyword_opportunity_id_keyword" PRIMARY KEY ("opportunityId", "keyword"),
        CONSTRAINT "FK_opportunity_keyword_opportunity_id"
          FOREIGN KEY ("opportunityId")
          REFERENCES "opportunity"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(/* sql */`
      CREATE TABLE "opportunity_match"(
        "opportunityId" uuid NOT NULL,
        "userId" character varying NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "status" text NOT NULL DEFAULT 'pending',
        "description" jsonb NOT NULL DEFAULT '{}',
        "screening" jsonb NOT NULL DEFAULT '[]',
        "applicationRank" jsonb NOT NULL DEFAULT '{}',
        CONSTRAINT "PK_opportunity_match_opportunity_id_user_id" PRIMARY KEY ("opportunityId", "userId"),
        CONSTRAINT "FK_opportunity_match_opportunity_id"
          FOREIGN KEY ("opportunityId")
          REFERENCES "opportunity"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION,
        CONSTRAINT "FK_opportunity_match_user_id"
          FOREIGN KEY ("userId")
          REFERENCES "user"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(/* sql */`
      CREATE INDEX IF NOT EXISTS "IDX_opportunity_match_user_id" ON "opportunity_match" ("userId")
    `);

    await queryRunner.query(/* sql */`
      ALTER TABLE "organization" ADD "links" jsonb NOT NULL DEFAULT '[]'
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "organization" ADD "website" text
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "organization" ADD "description" text
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "organization" ADD "perks" text array
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "organization" ADD "founded" numeric
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "organization" ADD "location" text
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "organization" ADD "size" text
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "organization" ADD "category" text
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "organization" ADD "stage" text
    `);

    await queryRunner.query(/* sql */`
      CREATE TABLE "user_candidate_preference"(
        "userId" character varying NOT NULL,
        "status" text NOT NULL DEFAULT 'disabled',
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "cv" jsonb NOT NULL DEFAULT '{}',
        "cvParsed" jsonb NOT NULL DEFAULT '{}',
        "role" text,
        "roleType" double precision NOT NULL DEFAULT '0.5',
        "employmentType" text array,
        "salaryExpectation" jsonb NOT NULL DEFAULT '{}',
        "location" jsonb NOT NULL DEFAULT '[]',
        "locationType" jsonb NOT NULL DEFAULT '{}',
        "companyStage" text array,
        "companySize" text array,
        CONSTRAINT "PK_user_candidate_preference_user_id" PRIMARY KEY ("userId"),
        CONSTRAINT "FK_user_candidate_preference_user_id"
          FOREIGN KEY ("userId")
          REFERENCES "user"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(/* sql */`
      CREATE TABLE "user_candidate_keyword"(
        "userId" character varying NOT NULL,
        "keyword" text NOT NULL,
        CONSTRAINT "PK_user_candidate_keyword_user_id_keyword" PRIMARY KEY ("userId", "keyword"),
        CONSTRAINT "FK_user_candidate_keywork_user_id"
          FOREIGN KEY ("userId")
          REFERENCES "user"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(/* sql */`
      CREATE TABLE "question"(
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "type" text NOT NULL,
        "title" text NOT NULL,
        "placeholder" text,
        "opportunityId" uuid,
        CONSTRAINT "PK_question_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_question_screening_opportunity_id"
          FOREIGN KEY ("opportunityId")
          REFERENCES "opportunity"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(/* sql */`
      CREATE INDEX IF NOT EXISTS "IDX_question_type" ON "question" ("type")
    `);

    await queryRunner.query(/* sql */`
      CREATE TABLE "user_candidate_answer"(
        "userId" character varying NOT NULL,
        "questionId" uuid NOT NULL,
        "answer" text NOT NULL,
        CONSTRAINT "PK_user_candidate_answer_user_id_question_id" PRIMARY KEY ("userId", "questionId"),
        CONSTRAINT "FK_user_candidate_answer_user_id"
          FOREIGN KEY ("userId")
          REFERENCES "user"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION,
        CONSTRAINT "FK_user_candidate_answer_question_id"
          FOREIGN KEY ("questionId")
          REFERENCES "question"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(/* sql */`
      CREATE INDEX IF NOT EXISTS "IDX_user_candidate_answer_question_id" ON "user_candidate_answer" ("questionId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      DROP TABLE "user_candidate_answer"
    `);

    await queryRunner.query(/* sql */`
      DROP TABLE "question"
    `);

    await queryRunner.query(/* sql */`
      DROP TABLE "user_candidate_keyword"
    `);

    await queryRunner.query(/* sql */`
      DROP TABLE "user_candidate_preference"
    `);

    await queryRunner.query(/* sql */`
      ALTER TABLE "organization" DROP COLUMN "stage"
    `);

    await queryRunner.query(/* sql */`
      ALTER TABLE "organization" DROP COLUMN "category"
    `);

    await queryRunner.query(/* sql */`
      ALTER TABLE "organization" DROP COLUMN "size"
    `);

    await queryRunner.query(/* sql */`
      ALTER TABLE "organization" DROP COLUMN "location"
    `);

    await queryRunner.query(/* sql */`
      ALTER TABLE "organization" DROP COLUMN "founded"
    `);

    await queryRunner.query(/* sql */`
      ALTER TABLE "organization" DROP COLUMN "perks"
    `);

    await queryRunner.query(/* sql */`
      ALTER TABLE "organization" DROP COLUMN "description"
    `);

    await queryRunner.query(/* sql */`
      ALTER TABLE "organization" DROP COLUMN "website"
    `);

    await queryRunner.query(/* sql */`
      ALTER TABLE "organization" DROP COLUMN "links"
    `);

    await queryRunner.query(/* sql */`
      DROP TABLE "opportunity_match"
    `);

    await queryRunner.query(/* sql */`
      DROP TABLE "opportunity_keyword"
    `);

    await queryRunner.query(/* sql */`
      DROP TABLE "opportunity_user"
    `);

    await queryRunner.query(/* sql */`
      DROP TABLE "opportunity"
    `);
  }
}
