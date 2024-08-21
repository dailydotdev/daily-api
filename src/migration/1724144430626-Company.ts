import { MigrationInterface, QueryRunner } from 'typeorm';

export class Company1724144430626 implements MigrationInterface {
  name = 'Company1724144430626';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "company" ("id" text NOT NULL, "name" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "image" text, "domains" text array NOT NULL DEFAULT '{}', CONSTRAINT "PK_056f7854a7afdba7cbd6d45fc20" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_company" ("createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "verified" boolean NOT NULL DEFAULT false, "email" text NOT NULL, "code" text NOT NULL, "userId" character varying NOT NULL, "companyId" text, CONSTRAINT "PK_6576f99bbbc8080bb7ef40e5dbc" PRIMARY KEY ("email", "userId"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_313f10ed21d1916930351e3455" ON "user_company" ("email") `,
    );
    await queryRunner.query(
      `ALTER TABLE "user_company" ADD CONSTRAINT "FK_2f89aead53ebdaaf3dca910ed56" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_company" ADD CONSTRAINT "FK_9c279d6cf291c858efa8a6b143f" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_company" DROP CONSTRAINT "FK_9c279d6cf291c858efa8a6b143f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_company" DROP CONSTRAINT "FK_2f89aead53ebdaaf3dca910ed56"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_313f10ed21d1916930351e3455"`,
    );
    await queryRunner.query(`DROP TABLE "user_company"`);
    await queryRunner.query(`DROP TABLE "company"`);
  }
}
