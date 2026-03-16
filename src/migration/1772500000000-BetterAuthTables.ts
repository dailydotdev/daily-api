import type { MigrationInterface, QueryRunner } from 'typeorm';

export class BetterAuthTables1772500000000 implements MigrationInterface {
  name = 'BetterAuthTables1772500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      CREATE TABLE IF NOT EXISTS "ba_session" (
        "id" text NOT NULL PRIMARY KEY,
        "expiresAt" timestamp NOT NULL,
        "token" text NOT NULL UNIQUE,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        "ipAddress" text,
        "userAgent" text,
        "userId" text NOT NULL
          REFERENCES "user" ("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(/* sql */ `
      CREATE TABLE IF NOT EXISTS "ba_account" (
        "id" text NOT NULL PRIMARY KEY,
        "accountId" text NOT NULL,
        "providerId" text NOT NULL,
        "userId" text NOT NULL
          REFERENCES "user" ("id") ON DELETE CASCADE,
        "accessToken" text,
        "refreshToken" text,
        "idToken" text,
        "accessTokenExpiresAt" timestamp,
        "refreshTokenExpiresAt" timestamp,
        "scope" text,
        "password" text,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(/* sql */ `
      CREATE TABLE IF NOT EXISTS "ba_verification" (
        "id" text NOT NULL PRIMARY KEY,
        "identifier" text NOT NULL,
        "value" text NOT NULL,
        "expiresAt" timestamp NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ba_verification"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ba_account"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ba_session"`);
  }
}
