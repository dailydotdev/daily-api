import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserReferral1761123042645 implements MigrationInterface {
  name = 'UserReferral1761123042645';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      CREATE TABLE "user_referral" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" character varying NOT NULL,
        "externalUserId" character varying NOT NULL,
        "type" text NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "status" text NOT NULL DEFAULT 'pending',
        "visited" boolean NOT NULL DEFAULT false,
        "flags" jsonb NOT NULL DEFAULT '{}',
        CONSTRAINT "PK_user_referral_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_referral_user_userId"
          FOREIGN KEY ("userId")
          REFERENCES "user"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_user_referral_type"
        ON "user_referral" ("type")
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_user_referral_status"
        ON "user_referral" ("status")
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_user_referral_id_type_visited"
        ON "user_referral" ("id", "type", "visited")
    `);

    await queryRunner.query(/* sql */ `
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_user_referral_userId_externalUserId_unique"
        ON "user_referral" ("userId", "externalUserId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DROP TABLE "user_referral"
    `);
  }
}
