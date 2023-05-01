import { MigrationInterface, QueryRunner } from 'typeorm';

export class OwnerToAdmin1681297594048 implements MigrationInterface {
  name = 'OwnerToAdmin1681297594048';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "public"."source_member" SET "role" = 'admin' WHERE "role" = 'owner'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "public"."source_member" SET "role" = 'owner' WHERE "role" = 'admin'`,
    );
  }
}
