import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserWorldSettings1785800000000 implements MigrationInterface {
  name = 'UserWorldSettings1785800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // One row per user, created lazily on first customisation — no row means the
    // panel was never opened and the serving layer answers with suggestions
    // derived from the reading instead. Every customisation column is therefore
    // nullable: a default here would freeze whatever the world happened to look
    // like on the day the row appeared.
    await queryRunner.query(/* sql */ `
      CREATE TABLE "user_world_settings" (
        "userId" text NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        "name" text,
        "sky" jsonb,
        "crest" jsonb,
        "look" jsonb,
        "private" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_user_world_settings" PRIMARY KEY ("userId"),
        CONSTRAINT "FK_user_world_settings_userId"
          FOREIGN KEY ("userId")
          REFERENCES "user"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DROP TABLE "user_world_settings"
    `);
  }
}
