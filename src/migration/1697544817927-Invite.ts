import { MigrationInterface, QueryRunner } from 'typeorm';

export class Invite1697544817927 implements MigrationInterface {
  name = 'Invite1697544817927';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "invite" ("token" text NOT NULL, "campaign" text NOT NULL, "userId" character varying(36) NOT NULL, "limit" integer NOT NULL DEFAULT '5', "count" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_83dbe83cb33c3e8468c8045ea7c" PRIMARY KEY ("token"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_e31046d3d8b9d04432ccdaaf09" ON "invite" ("userId", "campaign") `,
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
      `DROP INDEX "public"."IDX_e31046d3d8b9d04432ccdaaf09"`,
    );
    await queryRunner.query(`DROP TABLE "invite"`);
  }
}
