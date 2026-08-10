import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserWorldPlate1785900000000 implements MigrationInterface {
  name = 'UserWorldPlate1785900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // The bare render the share card is composed around, plus what it was a
    // picture of. Both nullable: a world that has never been visited by its
    // owner since this shipped has no plate, and the share card falls back to
    // the profile image rather than inventing one.
    await queryRunner.query(/* sql */ `
      ALTER TABLE "user_world_settings"
        ADD COLUMN IF NOT EXISTS "plateUrl" text,
        ADD COLUMN IF NOT EXISTS "plateVersion" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      ALTER TABLE "user_world_settings"
        DROP COLUMN IF EXISTS "plateUrl",
        DROP COLUMN IF EXISTS "plateVersion"
    `);
  }
}
