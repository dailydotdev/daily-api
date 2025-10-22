import { MigrationInterface, QueryRunner } from "typeorm";

export class UserReferral1761123042645 implements MigrationInterface {
  name = "UserReferral1761123042645";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      CREATE TABLE "user_referral" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" character varying NOT NULL,
        "type" text NOT NULL,
        "visited" boolean NOT NULL DEFAULT false,
        "threadId" text,
        CONSTRAINT "UQ_08b88b78b36e9f4e670250aff46" UNIQUE ("threadId"),
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
      CREATE INDEX IF NOT EXISTS "IDX_user_referral_id_type_visited"
        ON "user_referral" ("id", "type", "visited")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DROP TABLE "user_referral"
    `);
  }
}
