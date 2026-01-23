import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserHotTakeUpvotes1769156534090 implements MigrationInterface {
  name = 'AddUserHotTakeUpvotes1769156534090';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        CREATE TABLE "user_hot_take_upvote" (
          "hotTakeId" uuid NOT NULL,
          "userId" character varying NOT NULL,
          "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "PK_0fb6851f42e1d3f4138e3e4b8ca" PRIMARY KEY ("hotTakeId", "userId")
        )
      `);
    await queryRunner.query(`
        CREATE INDEX "IDX_902a36de7917e47ab8839ae46f" ON "user_hot_take_upvote" ("hotTakeId", "createdAt")
      `);
    await queryRunner.query(`
        CREATE INDEX "IDX_cc451486cbf598411e27264102" ON "user_hot_take_upvote" ("userId", "createdAt")
      `);
    await queryRunner.query(`
        ALTER TABLE "user_hot_take" ADD "upvotes" integer NOT NULL DEFAULT 0
      `);
    await queryRunner.query(`
        ALTER TABLE "user_hot_take_upvote"
          ADD CONSTRAINT "FK_user_hot_take_upvote_hot_take_id"
            FOREIGN KEY ("hotTakeId")
            REFERENCES "user_hot_take"("id")
            ON DELETE CASCADE
            ON UPDATE NO ACTION
      `);
    await queryRunner.query(`
        ALTER TABLE "user_hot_take_upvote"
          ADD CONSTRAINT "FK_user_hot_take_upvote_user_id"
            FOREIGN KEY ("userId")
            REFERENCES "user"("id")
            ON DELETE CASCADE
            ON UPDATE NO ACTION
      `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE "user_hot_take_upvote" DROP CONSTRAINT "FK_user_hot_take_upvote_user_id"
      `);
    await queryRunner.query(`
        ALTER TABLE "user_hot_take_upvote" DROP CONSTRAINT "FK_user_hot_take_upvote_hot_take_id"
      `);
    await queryRunner.query(`
        ALTER TABLE "user_hot_take" DROP COLUMN "upvotes"
      `);
    await queryRunner.query(`
        DROP INDEX "public"."IDX_cc451486cbf598411e27264102"
      `);
    await queryRunner.query(`
        DROP INDEX "public"."IDX_902a36de7917e47ab8839ae46f"
      `);
    await queryRunner.query(`
        DROP TABLE "user_hot_take_upvote"
      `);
  }
}
