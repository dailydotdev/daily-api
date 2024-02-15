import { MigrationInterface, QueryRunner } from 'typeorm';

export class BotUser1707921624847 implements MigrationInterface {
  name = 'BotUser1707921624847';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "bot_user" ("id" character varying(36) NOT NULL, "name" text, "email" text, "company" text, "title" text, "username" character varying(39), "bio" text, "portfolio" text, "timezone" text, "createdAt" TIMESTAMP NOT NULL, "readme" text, CONSTRAINT "PK_a3190460df612af6ab214b44a92" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "bot_user"`);
  }
}
