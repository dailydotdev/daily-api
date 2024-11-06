import { MigrationInterface, QueryRunner } from "typeorm";

export class UserStatsTopReader1730717128269 implements MigrationInterface {
    name = 'UserStatsTopReader1730717128269'

    public async up(queryRunner: QueryRunner): Promise<void> {
      // Create the new view as a temporary view
      await queryRunner.query(`CREATE MATERIALIZED VIEW "user_stats_tmp" AS SELECT u."id", (SELECT COALESCE(COUNT(*), 0)
          FROM "user"
          WHERE "referralId" = u."id"
        ) AS "referrals", (SELECT COALESCE(SUM(p."views"), 0)
          FROM "post" p
          WHERE (p."authorId" = u."id" OR p."scoutId" = u."id")
            AND p."visible" = TRUE
            AND p."deleted" = FALSE
        ) AS "views", (SELECT COALESCE(SUM(p."upvotes"), 0)
          FROM "post" p
          WHERE (p."authorId" = u."id" OR p."scoutId" = u."id")
            AND p."visible" = TRUE
            AND p."deleted" = FALSE
        ) AS "postUpvotes", (SELECT COALESCE(SUM(c."upvotes"), 0)
          FROM "comment" c
          WHERE c."userId" = u."id"
        ) AS "commentUpvotes", (SELECT COALESCE(COUNT(*), 0)
          FROM "user_top_reader" utp
          WHERE utp."userId" = u."id"
        ) AS "topReaderBadges" FROM "public"."user" "u" WHERE "u"."infoConfirmed" = TRUE AND "u"."id" != '404'`);

      // Rename the current view to the old view
      await queryRunner.query(`ALTER TABLE "public"."user_stats" RENAME TO "user_stats_old"`);
      // Rename the temporary view to the current view
      await queryRunner.query(`ALTER TABLE "public"."user_stats_tmp" RENAME TO "user_stats"`);
      // Drop the old view
      await queryRunner.query(`DROP MATERIALIZED VIEW "user_stats_old"`);

      // Metadata
      await queryRunner.query(`DELETE FROM "public"."typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`, ["MATERIALIZED_VIEW","user_stats","public"]);
      await queryRunner.query(`INSERT INTO "public"."typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`, ["public","MATERIALIZED_VIEW","user_stats","SELECT u.\"id\", (SELECT COALESCE(COUNT(*), 0)\n          FROM \"user\"\n          WHERE \"referralId\" = u.\"id\"\n        ) AS \"referrals\", (SELECT COALESCE(SUM(p.\"views\"), 0)\n          FROM \"post\" p\n          WHERE (p.\"authorId\" = u.\"id\" OR p.\"scoutId\" = u.\"id\")\n            AND p.\"visible\" = TRUE\n            AND p.\"deleted\" = FALSE\n        ) AS \"views\", (SELECT COALESCE(SUM(p.\"upvotes\"), 0)\n          FROM \"post\" p\n          WHERE (p.\"authorId\" = u.\"id\" OR p.\"scoutId\" = u.\"id\")\n            AND p.\"visible\" = TRUE\n            AND p.\"deleted\" = FALSE\n        ) AS \"postUpvotes\", (SELECT COALESCE(SUM(c.\"upvotes\"), 0)\n          FROM \"comment\" c\n          WHERE c.\"userId\" = u.\"id\"\n        ) AS \"commentUpvotes\", (SELECT COALESCE(COUNT(*), 0)\n          FROM \"user_top_reader\" utp\n          WHERE utp.\"userId\" = u.\"id\"\n        ) AS \"topReaderBadges\" FROM \"public\".\"user\" \"u\" WHERE \"u\".\"infoConfirmed\" = TRUE AND \"u\".\"id\" != '404'"]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
      // Create the new view as a temporary view
      await queryRunner.query(`CREATE MATERIALIZED VIEW "user_stats_tmp" AS SELECT u."id", (SELECT COALESCE(COUNT(*), 0)
          FROM "user"
          WHERE "referralId" = u."id"
        ) AS "referrals", (SELECT COALESCE(SUM(p."views"), 0)
          FROM "post" p
          WHERE (p."authorId" = u."id" OR p."scoutId" = u."id")
            AND p."visible" = TRUE
            AND p."deleted" = FALSE
        ) AS "views", (SELECT COALESCE(SUM(p."upvotes"), 0)
          FROM "post" p
          WHERE (p."authorId" = u."id" OR p."scoutId" = u."id")
            AND p."visible" = TRUE
            AND p."deleted" = FALSE
        ) AS "postUpvotes", (SELECT COALESCE(SUM(c."upvotes"), 0)
          FROM "comment" c
          WHERE c."userId" = u."id"
        ) AS "commentUpvotes" FROM "public"."user" "u" WHERE "u"."infoConfirmed" = TRUE AND "u"."id" != '404'`);
      // Rename the current view to the old view
      await queryRunner.query(`ALTER TABLE "public"."user_stats" RENAME TO "user_stats_old"`);
      // Rename the temporary view to the current view
      await queryRunner.query(`ALTER TABLE "public"."user_stats_tmp" RENAME TO "user_stats"`);
      // Drop the old view
      await queryRunner.query(`DROP MATERIALIZED VIEW "user_stats_old"`);

      // Metadata
      await queryRunner.query(`DELETE FROM "public"."typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`, ["MATERIALIZED_VIEW","user_stats","public"]);
      await queryRunner.query(`INSERT INTO "public"."typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`, ["public","MATERIALIZED_VIEW","user_stats","SELECT u.\"id\", (SELECT COALESCE(COUNT(*), 0)\n          FROM \"user\"\n          WHERE \"referralId\" = u.\"id\"\n        ) AS \"referrals\", (SELECT COALESCE(SUM(p.\"views\"), 0)\n          FROM \"post\" p\n          WHERE (p.\"authorId\" = u.\"id\" OR p.\"scoutId\" = u.\"id\")\n            AND p.\"visible\" = TRUE\n            AND p.\"deleted\" = FALSE\n        ) AS \"views\", (SELECT COALESCE(SUM(p.\"upvotes\"), 0)\n          FROM \"post\" p\n          WHERE (p.\"authorId\" = u.\"id\" OR p.\"scoutId\" = u.\"id\")\n            AND p.\"visible\" = TRUE\n            AND p.\"deleted\" = FALSE\n        ) AS \"postUpvotes\", (SELECT COALESCE(SUM(c.\"upvotes\"), 0)\n          FROM \"comment\" c\n          WHERE c.\"userId\" = u.\"id\"\n        ) AS \"commentUpvotes\" FROM \"public\".\"user\" \"u\" WHERE \"u\".\"infoConfirmed\" = TRUE AND \"u\".\"id\" != '404'"]);
    }

}
