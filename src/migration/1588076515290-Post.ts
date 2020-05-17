import {MigrationInterface, QueryRunner} from "typeorm";

export class Post1588076515290 implements MigrationInterface {
    name = 'Post1588076515290'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."source_display" DROP CONSTRAINT "FK_ad5e759962cd86ff322cb480d09"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_feed" DROP CONSTRAINT "FK_4f708e773c1df9c288180fbb555"`, undefined);
        await queryRunner.query(`CREATE TABLE "public"."post_display" ("postId" text NOT NULL, "sourceId" text NOT NULL, "url" text NOT NULL, "title" text NOT NULL, "image" text, "ratio" double precision, "placeholder" text, "relation" text NOT NULL, "priority" integer NOT NULL, CONSTRAINT "PK_3103676a56ed9bd45cfd1c3c972" PRIMARY KEY ("postId", "sourceId"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_e10e8d8fb5e290f5fe402ec426" ON "public"."post_display" ("postId") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_96f088a19dec82e82b2551c43b" ON "public"."post_display" ("sourceId") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_c5ec512a453ede097338a63ee8" ON "public"."post_display" ("postId", "sourceId", "priority") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_4789f665e1bde8d05d1f57a3a1" ON "public"."post_display" ("postId", "priority") `, undefined);
        await queryRunner.query(`CREATE TABLE "public"."post" ("id" text NOT NULL, "publishedAt" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "tweeted" boolean NOT NULL DEFAULT false, "views" integer NOT NULL DEFAULT 0, "timeDecay" double precision NOT NULL, "score" double precision NOT NULL, "siteTwitter" text, "creatorTwitter" text, "readTime" integer, CONSTRAINT "PK_b8ef5e0e707b097e2ea177daacf" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_b1cf10c73203f7fea3a4061821" ON "public"."post" ("createdAt") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_8686c85be0e212f2fbb5e9a038" ON "public"."post" ("timeDecay") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_a7ae2c768835eb810e23bfe459" ON "public"."post" ("score") `, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_display" ADD CONSTRAINT "FK_ad5e759962cd86ff322cb480d09" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_feed" ADD CONSTRAINT "FK_4f708e773c1df9c288180fbb555" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post_display" ADD CONSTRAINT "FK_e10e8d8fb5e290f5fe402ec426c" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post_display" ADD CONSTRAINT "FK_96f088a19dec82e82b2551c43bd" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."post_display" DROP CONSTRAINT "FK_96f088a19dec82e82b2551c43bd"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post_display" DROP CONSTRAINT "FK_e10e8d8fb5e290f5fe402ec426c"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_feed" DROP CONSTRAINT "FK_4f708e773c1df9c288180fbb555"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_display" DROP CONSTRAINT "FK_ad5e759962cd86ff322cb480d09"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_a7ae2c768835eb810e23bfe459"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_8686c85be0e212f2fbb5e9a038"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_b1cf10c73203f7fea3a4061821"`, undefined);
        await queryRunner.query(`DROP TABLE "public"."post"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_4789f665e1bde8d05d1f57a3a1"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_c5ec512a453ede097338a63ee8"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_96f088a19dec82e82b2551c43b"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_e10e8d8fb5e290f5fe402ec426"`, undefined);
        await queryRunner.query(`DROP TABLE "public"."post_display"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_feed" ADD CONSTRAINT "FK_4f708e773c1df9c288180fbb555" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source_display" ADD CONSTRAINT "FK_ad5e759962cd86ff322cb480d09" FOREIGN KEY ("sourceId") REFERENCES "public"."source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
    }

}
