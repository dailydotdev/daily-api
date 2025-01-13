import { MigrationInterface, QueryRunner } from "typeorm";

export class UserReportReplica1736761342821 implements MigrationInterface {
  name = 'UserReportReplica1736761342821'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."user_report" REPLICA IDENTITY FULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."user_report" REPLICA IDENTITY DEFAULT`,
    );
  }

}
