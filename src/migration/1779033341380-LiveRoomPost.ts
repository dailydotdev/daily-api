import type { MigrationInterface, QueryRunner } from 'typeorm';

export class LiveRoomPost1779033341380 implements MigrationInterface {
  name = 'LiveRoomPost1779033341380';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      ALTER TABLE "post"
        ADD "liveRoomId" uuid
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      ALTER TABLE "post"
        DROP COLUMN "liveRoomId"
    `);
  }
}
