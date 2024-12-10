import { MigrationInterface, QueryRunner } from 'typeorm';

export class SourcePostModeration1730890313095 implements MigrationInterface {
  name = 'SourcePostModeration1730890313095';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "source_post_moderation" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "sourceId" text NOT NULL, "status" text NOT NULL, "createdById" character varying NOT NULL, "moderatedById" character varying, "moderatorMessage" text, "rejectionReason" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "postId" text, "type" text NOT NULL, "title" text, "titleHtml" text, "content" text, "contentHtml" text, "image" text, "sharedPostId" text, "externalLink" text, CONSTRAINT "PK_5198be0eb3f1ebe81e75ee07865" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "source_post_moderation" ADD CONSTRAINT "FK_532c94738c6b1334e4bc27c41cf" FOREIGN KEY ("sourceId") REFERENCES "source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "source_post_moderation" ADD CONSTRAINT "FK_db149e671aa7c677101676d2331" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "source_post_moderation" ADD CONSTRAINT "FK_87628fa2c15a77f4f29726ed8ae" FOREIGN KEY ("moderatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "source_post_moderation" ADD CONSTRAINT "FK_3d96addd8ef4ca68fab5d3bdd37" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "source_post_moderation" ADD CONSTRAINT "FK_4f7beb468ea0b38eb944b2234ab" FOREIGN KEY ("sharedPostId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "source_post_moderation" DROP CONSTRAINT "FK_4f7beb468ea0b38eb944b2234ab"`,
    );
    await queryRunner.query(
      `ALTER TABLE "source_post_moderation" DROP CONSTRAINT "FK_3d96addd8ef4ca68fab5d3bdd37"`,
    );
    await queryRunner.query(
      `ALTER TABLE "source_post_moderation" DROP CONSTRAINT "FK_87628fa2c15a77f4f29726ed8ae"`,
    );
    await queryRunner.query(
      `ALTER TABLE "source_post_moderation" DROP CONSTRAINT "FK_db149e671aa7c677101676d2331"`,
    );
    await queryRunner.query(
      `ALTER TABLE "source_post_moderation" DROP CONSTRAINT "FK_532c94738c6b1334e4bc27c41cf"`,
    );
    await queryRunner.query(`DROP TABLE "source_post_moderation"`);
  }
}
