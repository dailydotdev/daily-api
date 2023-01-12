import { MigrationInterface, QueryRunner } from 'typeorm';

export class SourceMemberCDC1671874590903 implements MigrationInterface {
  name = 'SourceMemberCDC1671874590903';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."source_member" REPLICA IDENTITY FULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."source_member" REPLICA IDENTITY DEFAULT`,
    );
  }
}
