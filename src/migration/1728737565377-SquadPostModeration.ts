import { MigrationInterface, QueryRunner } from 'typeorm';

export class SquadPostModeration1728737565377 implements MigrationInterface {
  name = 'SquadPostModeration1728737565377';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."squad_post_moderation_status_enum" AS ENUM('approved', 'rejected', 'pending')`,
    );
    await queryRunner.query(
      `CREATE TABLE "squad_post_moderation" ("id" text NOT NULL, "sourceId" text NOT NULL, "status" "public"."squad_post_moderation_status_enum" NOT NULL DEFAULT 'pending', "createdById" text NOT NULL, "moderatedById" text, "moderatorMessage" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "postId" text, "type" text NOT NULL, "title" text, "titleHtml" text, "content" text, "contentHtml" text, "image" text, "sharedPostId" text, CONSTRAINT "PK_89a3c63bb8f2df10763ce5afe1a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "squad_post_moderation" ADD CONSTRAINT "FK_d64cff015719ebb155cd3e5da3c" FOREIGN KEY ("sourceId") REFERENCES "source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "squad_post_moderation" ADD CONSTRAINT "FK_43327654840dfa62997a419d337" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "squad_post_moderation" DROP CONSTRAINT "FK_43327654840dfa62997a419d337"`,
    );
    await queryRunner.query(
      `ALTER TABLE "squad_post_moderation" DROP CONSTRAINT "FK_d64cff015719ebb155cd3e5da3c"`,
    );
    await queryRunner.query(`DROP TABLE "squad_post_moderation"`);
    await queryRunner.query(
      `DROP TYPE "public"."squad_post_moderation_status_enum"`,
    );
  }
}
