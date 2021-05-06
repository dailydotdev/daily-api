import { MigrationInterface, QueryRunner } from 'typeorm';

export class CommentLastUpdate1620311370218 implements MigrationInterface {
  name = 'CommentLastUpdate1620311370218';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."comment" ADD "lastUpdatedAt" TIMESTAMP`,
      undefined,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."comment" DROP COLUMN "lastUpdatedAt"`,
      undefined,
    );
  }
}
