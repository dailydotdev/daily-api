import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChannelHighlightColor1781779473720 implements MigrationInterface {
  name = 'AddChannelHighlightColor1781779473720';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "channel_highlight_definition" ADD "color" text NOT NULL DEFAULT 'text-text-tertiary'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "channel_highlight_definition" DROP COLUMN "color"`,
    );
  }
}
