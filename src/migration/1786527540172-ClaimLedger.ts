import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClaimLedger1786527540172 implements MigrationInterface {
  name = 'ClaimLedger1786527540172';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      /* sql */ `CREATE TABLE IF NOT EXISTS "ledger_entity" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "canonicalName" text NOT NULL, "kind" text NOT NULL, "aliases" text array NOT NULL DEFAULT '{}', "keywordValue" text, "parentId" uuid, CONSTRAINT "PK_ledger_entity_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      /* sql */ `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_ledger_entity_canonical_name_lower" ON "ledger_entity" (lower("canonicalName"))`,
    );
    await queryRunner.query(
      /* sql */ `CREATE INDEX IF NOT EXISTS "IDX_ledger_entity_aliases" ON "ledger_entity" USING GIN ("aliases")`,
    );
    await queryRunner.query(
      /* sql */ `CREATE INDEX IF NOT EXISTS "IDX_ledger_entity_parentId" ON "ledger_entity" ("parentId")`,
    );
    await queryRunner.query(
      /* sql */ `ALTER TABLE "ledger_entity" ADD CONSTRAINT "FK_ledger_entity_parent_id" FOREIGN KEY ("parentId") REFERENCES "ledger_entity"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      /* sql */ `CREATE TABLE IF NOT EXISTS "claim" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "entityId" uuid NOT NULL, "changeType" text NOT NULL, "statement" text NOT NULL, "versionScope" text, "effectiveDate" date, "sunsetDate" date, "supersededByEntityId" uuid, "status" text NOT NULL DEFAULT 'candidate', CONSTRAINT "PK_claim_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      /* sql */ `CREATE INDEX IF NOT EXISTS "IDX_claim_entityId_effectiveDate" ON "claim" ("entityId", "effectiveDate")`,
    );
    await queryRunner.query(
      /* sql */ `ALTER TABLE "claim" ADD CONSTRAINT "FK_claim_entity_id" FOREIGN KEY ("entityId") REFERENCES "ledger_entity"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      /* sql */ `ALTER TABLE "claim" ADD CONSTRAINT "FK_claim_superseded_by_entity_id" FOREIGN KEY ("supersededByEntityId") REFERENCES "ledger_entity"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      /* sql */ `CREATE TABLE IF NOT EXISTS "claim_evidence" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "claimId" uuid NOT NULL, "postId" text, "url" text NOT NULL, "sourceClass" text NOT NULL, "publishedAt" TIMESTAMP, CONSTRAINT "PK_claim_evidence_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      /* sql */ `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_claim_evidence_claimId_url" ON "claim_evidence" ("claimId", "url")`,
    );
    await queryRunner.query(
      /* sql */ `ALTER TABLE "claim_evidence" ADD CONSTRAINT "FK_claim_evidence_claim_id" FOREIGN KEY ("claimId") REFERENCES "claim"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      /* sql */ `CREATE TABLE IF NOT EXISTS "claim_candidate" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "postId" text NOT NULL, "rawEntityName" text NOT NULL, "entityAliases" text array NOT NULL DEFAULT '{}', "entityKind" text NOT NULL, "changeType" text NOT NULL, "statement" text NOT NULL, "versionScope" text, "effectiveDate" date, "sunsetDate" date, "supersededBy" text, "directness" text NOT NULL, "evidence" text NOT NULL, "status" text NOT NULL DEFAULT 'pending', "claimId" uuid, CONSTRAINT "PK_claim_candidate_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      /* sql */ `CREATE INDEX IF NOT EXISTS "IDX_claim_candidate_status" ON "claim_candidate" ("status")`,
    );
    await queryRunner.query(
      /* sql */ `CREATE INDEX IF NOT EXISTS "IDX_claim_candidate_postId" ON "claim_candidate" ("postId")`,
    );
    await queryRunner.query(
      /* sql */ `ALTER TABLE "claim_candidate" ADD CONSTRAINT "FK_claim_candidate_claim_id" FOREIGN KEY ("claimId") REFERENCES "claim"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `DROP TABLE IF EXISTS "claim_candidate"`);
    await queryRunner.query(/* sql */ `DROP TABLE IF EXISTS "claim_evidence"`);
    await queryRunner.query(/* sql */ `DROP TABLE IF EXISTS "claim"`);
    await queryRunner.query(/* sql */ `DROP TABLE IF EXISTS "ledger_entity"`);
  }
}
