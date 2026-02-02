import { MigrationInterface, QueryRunner } from 'typeorm';

export class PersonalAccessToken1769959137948 implements MigrationInterface {
  name = 'PersonalAccessToken1769959137948';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "personal_access_token" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" text NOT NULL,
        "name" text NOT NULL,
        "tokenHash" text NOT NULL,
        "tokenPrefix" text NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "expiresAt" TIMESTAMP,
        "lastUsedAt" TIMESTAMP,
        "revokedAt" TIMESTAMP,
        CONSTRAINT "PK_personal_access_token_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_pat_userId" ON "personal_access_token" ("userId")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_pat_tokenHash" ON "personal_access_token" ("tokenHash")
    `);

    await queryRunner.query(`
      ALTER TABLE "personal_access_token"
      ADD CONSTRAINT "FK_personal_access_token_userId"
      FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "personal_access_token" DROP CONSTRAINT "FK_personal_access_token_userId"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_pat_tokenHash"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_pat_userId"
    `);

    await queryRunner.query(`
      DROP TABLE "personal_access_token"
    `);
  }
}
