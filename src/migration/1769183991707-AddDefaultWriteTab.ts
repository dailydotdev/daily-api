import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDefaultWriteTab1769183991707 implements MigrationInterface {
  name = 'AddDefaultWriteTab1769183991707';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "settings" ADD "defaultWriteTab" text NOT NULL DEFAULT 'share'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "settings" DROP COLUMN "defaultWriteTab"`,
    );
  }
}
