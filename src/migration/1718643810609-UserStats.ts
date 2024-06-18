import { MigrationInterface, QueryRunner } from "typeorm";

export class UserStats1718643810609 implements MigrationInterface {
    name = 'UserStats1718643810609'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE MATERIALIZED VIEW "user_stats" AS SELECT u."id", (SELECT COALESCE(COUNT(*), 0)
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
        await queryRunner.query(`INSERT INTO "public"."typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`, ["public","MATERIALIZED_VIEW","user_stats","SELECT u.\"id\", (SELECT COALESCE(COUNT(*), 0)\n          FROM \"user\"\n          WHERE \"referralId\" = u.\"id\"\n        ) AS \"referrals\", (SELECT COALESCE(SUM(p.\"views\"), 0)\n          FROM \"post\" p\n          WHERE (p.\"authorId\" = u.\"id\" OR p.\"scoutId\" = u.\"id\")\n            AND p.\"visible\" = TRUE\n            AND p.\"deleted\" = FALSE\n        ) AS \"views\", (SELECT COALESCE(SUM(p.\"upvotes\"), 0)\n          FROM \"post\" p\n          WHERE (p.\"authorId\" = u.\"id\" OR p.\"scoutId\" = u.\"id\")\n            AND p.\"visible\" = TRUE\n            AND p.\"deleted\" = FALSE\n        ) AS \"postUpvotes\", (SELECT COALESCE(SUM(c.\"upvotes\"), 0)\n          FROM \"comment\" c\n          WHERE c.\"userId\" = u.\"id\"\n        ) AS \"commentUpvotes\" FROM \"public\".\"user\" \"u\" WHERE \"u\".\"infoConfirmed\" = TRUE AND \"u\".\"id\" != '404'"]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "public"."typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`, ["MATERIALIZED_VIEW","user_stats","public"]);
        await queryRunner.query(`DROP MATERIALIZED VIEW "user_stats"`);
    }

}
