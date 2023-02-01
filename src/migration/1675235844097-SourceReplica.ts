import { MigrationInterface, QueryRunner } from 'typeorm';

export class SourceReplica1675235844097 implements MigrationInterface {
  name = 'SourceReplica1675235844097';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."source" REPLICA IDENTITY FULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."source" REPLICA IDENTITY DEFAULT`,
    );
  }
}
