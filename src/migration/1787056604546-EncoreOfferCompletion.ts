import { MigrationInterface, QueryRunner } from 'typeorm';

export class EncoreOfferCompletion1787056604546 implements MigrationInterface {
  name = 'EncoreOfferCompletion1787056604546';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      CREATE TABLE IF NOT EXISTS "encore_offer_completion" (
        "transactionId" uuid NOT NULL,
        "userId" text NOT NULL,
        "campaignName" text NOT NULL,
        "payout" double precision,
        "completedAt" timestamp with time zone NOT NULL,
        "receivedAt" timestamp with time zone NOT NULL DEFAULT now(),
        CONSTRAINT "PK_439307e9a85965b3f92790e6f65" PRIMARY KEY ("transactionId")
      )
    `);
    await queryRunner.query(
      /* sql */ `CREATE INDEX IF NOT EXISTS "IDX_encore_offer_completion_user_id" ON "encore_offer_completion" ("userId")`,
    );
    await queryRunner.query(
      /* sql */ `CREATE INDEX IF NOT EXISTS "IDX_encore_offer_completion_completed_at" ON "encore_offer_completion" ("completedAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      /* sql */ `DROP INDEX IF EXISTS "IDX_encore_offer_completion_completed_at"`,
    );
    await queryRunner.query(
      /* sql */ `DROP INDEX IF EXISTS "IDX_encore_offer_completion_user_id"`,
    );
    await queryRunner.query(
      /* sql */ `DROP TABLE IF EXISTS "encore_offer_completion"`,
    );
  }
}
