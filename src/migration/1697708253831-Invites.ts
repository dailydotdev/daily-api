import { MigrationInterface, QueryRunner } from 'typeorm';

export class Invites1697708253831 implements MigrationInterface {
  name = 'Invites1697708253831';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "invite" ("token" uuid NOT NULL DEFAULT uuid_generate_v4(), "campaign" text NOT NULL, "userId" character varying(36) NOT NULL, "limit" integer NOT NULL DEFAULT '5', "count" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_83dbe83cb33c3e8468c8045ea7c" PRIMARY KEY ("token"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_invite_userId_campaign" ON "invite" ("userId", "campaign") `,
    );
    await queryRunner.query(
      `ALTER TABLE "feature" ADD "invitedById" character varying(36)`,
    );
    await queryRunner.query(
      `ALTER TABLE "feature" ADD CONSTRAINT "FK_a49f9325cc4a61812fa7da5449e" FOREIGN KEY ("invitedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invite" ADD CONSTRAINT "FK_91bfeec7a9574f458e5b592472d" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "invite" DROP CONSTRAINT "FK_91bfeec7a9574f458e5b592472d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "feature" DROP CONSTRAINT "FK_a49f9325cc4a61812fa7da5449e"`,
    );
    await queryRunner.query(`ALTER TABLE "feature" DROP COLUMN "invitedById"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_invite_userId_campaign"`);
    await queryRunner.query(`DROP TABLE "invite"`);
  }
}
