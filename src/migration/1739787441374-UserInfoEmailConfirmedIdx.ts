import { MigrationInterface, QueryRunner } from "typeorm";

export class UserInfoEmailConfirmedIdx1739787441374 implements MigrationInterface {
  name = 'UserInfoEmailConfirmedIdx1739787441374'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/*sql*/`CREATE INDEX IF NOT EXISTS "IDX_user_info_email_unconfirmed"
      ON "public"."user" ("infoConfirmed", "emailConfirmed")
      WHERE
        (
          "infoConfirmed" = FALSE
          OR "emailConfirmed" = FALSE
        );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/*sql*/`DROP INDEX IF EXISTS "IDX_user_info_email_unconfirmed";`);
  }
}
