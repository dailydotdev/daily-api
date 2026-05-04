import type { MigrationInterface, QueryRunner } from 'typeorm';

export class LiveRoomLobby1778100000000 implements MigrationInterface {
  name = 'LiveRoomLobby1778100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      ALTER TABLE "live_room"
        ADD "description" text,
        ADD "descriptionHtml" text,
        ADD "scheduledStart" TIMESTAMPTZ
    `);

    await queryRunner.query(/* sql */ `
      CREATE TABLE "live_room_subscription" (
        "roomId" uuid NOT NULL,
        "userId" text NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_live_room_subscription"
          PRIMARY KEY ("roomId", "userId"),
        CONSTRAINT "FK_live_room_subscription_room"
          FOREIGN KEY ("roomId")
          REFERENCES "live_room"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION,
        CONSTRAINT "FK_live_room_subscription_user"
          FOREIGN KEY ("userId")
          REFERENCES "user"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_live_room_subscription_user_created"
        ON "live_room_subscription" ("userId", "createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DROP TABLE "live_room_subscription"
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "live_room"
        DROP COLUMN "scheduledStart",
        DROP COLUMN "descriptionHtml",
        DROP COLUMN "description"
    `);
  }
}
