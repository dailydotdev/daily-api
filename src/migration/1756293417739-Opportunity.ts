import { MigrationInterface, QueryRunner } from "typeorm";

export class Opportunity1756293417739 implements MigrationInterface {
  name = 'Opportunity1756293417739'

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
        CONSTRAINT "PK_Opportunity_Id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_opportunity_organization_id"
          FOREIGN KEY ("organizationId")
          REFERENCES "organization"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(/* sql */`
      CREATE INDEX IF NOT EXISTS "IDX_opportunity_type" ON "opportunity" ("type")
    `);
    await queryRunner.query(/* sql */`
      CREATE INDEX IF NOT EXISTS "IDX_opportunity_organization_id" ON "opportunity" ("organizationId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      DROP TABLE "opportunity"
    `);
  }
}
