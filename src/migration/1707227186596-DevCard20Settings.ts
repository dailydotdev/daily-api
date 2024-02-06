import { MigrationInterface, QueryRunner } from 'typeorm';

export class DevCard20Settings1707227186596 implements MigrationInterface {
  name = 'DevCard20Settings1707227186596';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."dev_card_theme_enum" AS ENUM('default', 'iron', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'legendary')`,
    );
    await queryRunner.query(
      `ALTER TABLE "dev_card" ADD "theme" "public"."dev_card_theme_enum" NOT NULL DEFAULT 'default'`,
    );
    await queryRunner.query(
      `ALTER TABLE "dev_card" ADD "isProfileCover" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "dev_card" ADD "showBorder" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "dev_card" DROP COLUMN "showBorder"`);
    await queryRunner.query(
      `ALTER TABLE "dev_card" DROP COLUMN "isProfileCover"`,
    );
    await queryRunner.query(`ALTER TABLE "dev_card" DROP COLUMN "theme"`);
    await queryRunner.query(`DROP TYPE "public"."dev_card_theme_enum"`);
  }
}
