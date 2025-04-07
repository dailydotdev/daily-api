import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserNotificationReplica1744015053751
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."user_transaction" REPLICA IDENTITY FULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."user_transaction" REPLICA IDENTITY DEFAULT`,
    );
  }
}
