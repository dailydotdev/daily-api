import { MigrationInterface, QueryRunner } from 'typeorm';

export class UniqueSocialHandles1660640181400 implements MigrationInterface {
  name = 'UniqueSocialHandles1660640181400';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b67337b7f8aa8406e936c2ff75"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d7820fad49c99eb918d92519e2"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "users_username_unique" ON "user" ("username") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "users_twitter_unique" ON "user" ("twitter") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "users_github_unique" ON "user" ("github") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "users_hashnode_unique" ON "user" ("hashnode") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."users_hashnode_unique"`);
    await queryRunner.query(`DROP INDEX "public"."users_github_unique"`);
    await queryRunner.query(`DROP INDEX "public"."users_twitter_unique"`);
    await queryRunner.query(`DROP INDEX "public"."users_username_unique"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_d7820fad49c99eb918d92519e2" ON "user" ("twitter") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b67337b7f8aa8406e936c2ff75" ON "user" ("username") `,
    );
  }
}
