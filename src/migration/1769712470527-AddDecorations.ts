import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDecorations1769712470527 implements MigrationInterface {
  name = 'AddDecorations1769712470527';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "decoration" (
        "id" text NOT NULL,
        "name" text NOT NULL,
        "media" text NOT NULL,
        "decorationGroup" text NOT NULL DEFAULT 'subscriber',
        "unlockCriteria" text,
        "groupOrder" integer NOT NULL DEFAULT 0,
        "active" boolean NOT NULL DEFAULT true,
        "price" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_decoration_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "user_decoration" (
        "userId" text NOT NULL,
        "decorationId" text NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_decoration" PRIMARY KEY ("userId", "decorationId")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "user"
      ADD "activeDecorationId" text
    `);

    await queryRunner.query(`
      ALTER TABLE "user_decoration"
      ADD CONSTRAINT "FK_user_decoration_userId"
      FOREIGN KEY ("userId") REFERENCES "user"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "user_decoration"
      ADD CONSTRAINT "FK_user_decoration_decorationId"
      FOREIGN KEY ("decorationId") REFERENCES "decoration"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "user"
      ADD CONSTRAINT "FK_user_activeDecorationId"
      FOREIGN KEY ("activeDecorationId") REFERENCES "decoration"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    // Seed initial decorations
    await queryRunner.query(`
      INSERT INTO "decoration" ("id", "name", "media", "decorationGroup", "unlockCriteria", "groupOrder", "active")
      VALUES
        ('activesubscriber', 'Active Subscriber', 'https://i.imgur.com/WBkvjLy.png', 'subscriber', 'You have an active daily.dev subscription', 0, true),
        ('threemonth', 'Three Month', 'https://i.imgur.com/Q0YJE6i.png', 'subscriber', 'You have been subscribed for 3 months in a row', 1, true),
        ('sixmonth', 'Six Month', 'https://i.imgur.com/jdd7OIW.jpeg', 'subscriber', 'You have been subscribed for 6 months in a row', 2, true),
        ('oneyear', 'One Year', 'https://i.imgur.com/ArSyAor.jpeg', 'subscriber', 'You have been subscribed for a whole year', 3, true),
        ('twoyears', 'Two Years', 'https://i.imgur.com/cPecdk4.jpeg', 'subscriber', 'You have been subscribed for two years', 4, true)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" DROP CONSTRAINT "FK_user_activeDecorationId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_decoration" DROP CONSTRAINT "FK_user_decoration_decorationId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_decoration" DROP CONSTRAINT "FK_user_decoration_userId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN "activeDecorationId"`,
    );
    await queryRunner.query(`DROP TABLE "user_decoration"`);
    await queryRunner.query(`DROP TABLE "decoration"`);
  }
}
