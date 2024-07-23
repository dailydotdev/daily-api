import { MigrationInterface, QueryRunner } from "typeorm";

export class NewSocialHandles1721403018310 implements MigrationInterface {
    name = 'NewSocialHandles1721403018310'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ADD "roadmap" character varying(39)`);
        await queryRunner.query(`ALTER TABLE "user" ADD "threads" character varying(39)`);
        await queryRunner.query(`ALTER TABLE "user" ADD "codepen" character varying(39)`);
        await queryRunner.query(`ALTER TABLE "user" ADD "reddit" character varying(39)`);
        await queryRunner.query(`ALTER TABLE "user" ADD "stackoverflow" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "user" ADD "youtube" character varying(39)`);
        await queryRunner.query(`ALTER TABLE "user" ADD "linkedin" character varying(39)`);
        await queryRunner.query(`ALTER TABLE "user" ADD "mastodon" character varying(100)`);

        await queryRunner.query(`CREATE UNIQUE INDEX "users_roadmap_unique" ON "user" ("roadmap") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "users_threads_unique" ON "user" ("threads") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "users_codepen_unique" ON "user" ("codepen") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "users_reddit_unique" ON "user" ("reddit") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "users_stackoverflow_unique" ON "user" ("stackoverflow") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "users_youtube_unique" ON "user" ("youtube") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "users_linkedin_unique" ON "user" ("linkedin") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "users_mastodon_unique" ON "user" ("mastodon") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."users_mastodon_unique"`);
        await queryRunner.query(`DROP INDEX "public"."users_linkedin_unique"`);
        await queryRunner.query(`DROP INDEX "public"."users_youtube_unique"`);
        await queryRunner.query(`DROP INDEX "public"."users_stackoverflow_unique"`);
        await queryRunner.query(`DROP INDEX "public"."users_reddit_unique"`);
        await queryRunner.query(`DROP INDEX "public"."users_codepen_unique"`);
        await queryRunner.query(`DROP INDEX "public"."users_threads_unique"`);
        await queryRunner.query(`DROP INDEX "public"."users_roadmap_unique"`);

        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "mastodon"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "linkedin"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "youtube"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "stackoverflow"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "reddit"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "codepen"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "threads"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "roadmap"`);
    }

}
