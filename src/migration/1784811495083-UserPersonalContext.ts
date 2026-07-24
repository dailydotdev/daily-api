import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserPersonalContext1784811495083 implements MigrationInterface {
  name = 'UserPersonalContext1784811495083';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "user_personal_context" ("userId" character varying(36) NOT NULL, "source" text NOT NULL, "sourceValue" text NOT NULL, "verified" boolean NOT NULL DEFAULT false, "status" text NOT NULL DEFAULT 'pending', "profileText" text, "context" jsonb, "error" text, "correlationId" text, "requestedAt" TIMESTAMP WITH TIME ZONE, "generatedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_359a238fc279d413ede7eb473ee" PRIMARY KEY ("userId", "source"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_personal_context" ADD CONSTRAINT "FK_8d89fb7a971d70503156013ba08" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "user_personal_context" DROP CONSTRAINT IF EXISTS "FK_8d89fb7a971d70503156013ba08"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "user_personal_context"`);
  }
}
