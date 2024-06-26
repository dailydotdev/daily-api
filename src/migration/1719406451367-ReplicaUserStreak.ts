import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReplicaUserStreak1719406451367 implements MigrationInterface {
  name = 'ReplicaUserStreak1719406451367';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."user_streak" REPLICA IDENTITY FULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."user_streak" REPLICA IDENTITY DEFAULT`,
    );
  }
}
