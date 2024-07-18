import { MigrationInterface, QueryRunner } from 'typeorm';

export class BookmarkReplica1721316842386 implements MigrationInterface {
  name = 'BookmarkReplica1721316842386';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."bookmark" REPLICA IDENTITY FULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."bookmark" REPLICA IDENTITY DEFAULT`,
    );
  }
}
