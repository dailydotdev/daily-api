import { MigrationInterface, QueryRunner } from 'typeorm';

export class Squad1671547534880 implements MigrationInterface {
  name = 'Squad1671547534880';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "source_member"
                             (
                               "sourceId"      text                  NOT NULL,
                               "userId"        character varying(36) NOT NULL,
                               "createdAt"     TIMESTAMP             NOT NULL DEFAULT now(),
                               "role"          text                  NOT NULL,
                               "referralToken" uuid                  NOT NULL,
                               CONSTRAINT "PK_36c6a465e683d68b4a09b71de72" PRIMARY KEY ("sourceId", "userId")
                             )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_source_member_sourceId" ON "source_member" ("sourceId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_source_member_userId" ON "source_member" ("userId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_source_member_referralToken" ON "source_member" ("referralToken") `,
    );
    await queryRunner.query(`ALTER TABLE "source_member"
      ADD CONSTRAINT "FK_b557c5ebed1e6df65d7271807df" FOREIGN KEY ("sourceId") REFERENCES "source" ("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "source_member"
      ADD CONSTRAINT "FK_9b77a6c894823e05648bbb964e0" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "source"
      ADD "handle" character varying(36)`);
    await queryRunner.query(`ALTER TABLE "source"
      ADD "description" text`);
    await queryRunner.query(`ALTER TABLE "source"
      ADD "type" character varying NOT NULL DEFAULT 'machine'`);
    await queryRunner.query(`ALTER TABLE "source"
      ALTER COLUMN "rankBoost" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "source"
      ALTER COLUMN "advancedSettings" DROP NOT NULL`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_source_handle" ON "source" ("handle") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c531f31e06cfbdf6d42d5eb30b" ON "source" ("type") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c531f31e06cfbdf6d42d5eb30b"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_source_handle"`);
    await queryRunner.query(`ALTER TABLE "source"
      ALTER COLUMN "advancedSettings" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "source"
      ALTER COLUMN "rankBoost" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "source" DROP COLUMN "type"`);
    await queryRunner.query(`ALTER TABLE "source" DROP COLUMN "description"`);
    await queryRunner.query(`ALTER TABLE "source" DROP COLUMN "handle"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_source_member_referralToken"`,
    );
    await queryRunner.query(
      `ALTER TABLE "source_member" DROP CONSTRAINT "FK_9b77a6c894823e05648bbb964e0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "source_member" DROP CONSTRAINT "FK_b557c5ebed1e6df65d7271807df"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_source_member_userId"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_source_member_sourceId"`);
    await queryRunner.query(`DROP TABLE "source_member"`);
  }
}
