import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReplicaFull1628440848669 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."comment" REPLICA IDENTITY FULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "public"."comment_upvote" REPLICA IDENTITY FULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "public"."source_request" REPLICA IDENTITY FULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "public"."upvote" REPLICA IDENTITY FULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "public"."post" REPLICA IDENTITY FULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "public"."user" REPLICA IDENTITY FULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."comment" REPLICA IDENTITY DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "public"."comment_upvote" REPLICA IDENTITY DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "public"."source_request" REPLICA IDENTITY DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "public"."upvote" REPLICA IDENTITY DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "public"."post" REPLICA IDENTITY DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "public"."user" REPLICA IDENTITY DEFAULT`,
    );
  }
}
