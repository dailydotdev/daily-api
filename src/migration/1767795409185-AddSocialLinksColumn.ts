import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSocialLinksColumn1767795409185 implements MigrationInterface {
    name = 'AddSocialLinksColumn1767795409185'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "public"."typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`, ["MATERIALIZED_VIEW","user_stats","public"]);
        await queryRunner.query(`DROP MATERIALIZED VIEW "user_stats"`);
        await queryRunner.query(`DELETE FROM "public"."typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`, ["MATERIALIZED_VIEW","popular_video_source","public"]);
        await queryRunner.query(`DROP MATERIALIZED VIEW "popular_video_source"`);
        await queryRunner.query(`DELETE FROM "public"."typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`, ["MATERIALIZED_VIEW","source_tag_view","public"]);
        await queryRunner.query(`DROP MATERIALIZED VIEW "source_tag_view"`);
        await queryRunner.query(`ALTER TABLE "post" DROP CONSTRAINT "FK_a51326b93176f2b2ebf3eda9fef"`);
        await queryRunner.query(`ALTER TABLE "post" DROP CONSTRAINT "FK_f1bb0e9a2279673a76520d2adc5"`);
        await queryRunner.query(`ALTER TABLE "post" DROP CONSTRAINT "FK_83c8ae07417cd6de65b8b994587"`);
        await queryRunner.query(`ALTER TABLE "post_keyword" DROP CONSTRAINT "FK_88d97436b07e1462d5a7877dcb3"`);
        await queryRunner.query(`ALTER TABLE "content_preference" DROP CONSTRAINT "FK_a6977adf724e068f6faae2914da"`);
        await queryRunner.query(`ALTER TABLE "content_preference" DROP CONSTRAINT "FK_231b13306df1d5046ffa7c4568b"`);
        await queryRunner.query(`ALTER TABLE "comment" DROP CONSTRAINT "FK_cb2ce95b74f2ee583447362d508"`);
        await queryRunner.query(`ALTER TABLE "comment" DROP CONSTRAINT "FK_f1305337f54e8211d5a84da0cc5"`);
        await queryRunner.query(`ALTER TABLE "comment" DROP CONSTRAINT "FK_d82dbf00f15d651edf917c8167f"`);
        await queryRunner.query(`ALTER TABLE "user_transaction" DROP CONSTRAINT "FK_1422cc85c1642eed91e947cf877"`);
        await queryRunner.query(`ALTER TABLE "user_personalized_digest" DROP CONSTRAINT "FK_user_personalized_digest_user"`);
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_user_locationId"`);
        await queryRunner.query(`ALTER TABLE "alerts" DROP CONSTRAINT "FK_f2678f7b11e5128abbbc4511906"`);
        await queryRunner.query(`ALTER TABLE "bookmark" DROP CONSTRAINT "FK_b0df46b7939819e8bc14cf9f45c"`);
        await queryRunner.query(`ALTER TABLE "dev_card" DROP CONSTRAINT "FK_70a77f197a0f92324256c983fc6"`);
        await queryRunner.query(`ALTER TABLE "feed_advanced_settings" DROP CONSTRAINT "FK_c46745c935040ef6188c9cbf013"`);
        await queryRunner.query(`ALTER TABLE "feed_advanced_settings" DROP CONSTRAINT "FK_01d5bc49fc5802c4e067d7ba4c9"`);
        await queryRunner.query(`ALTER TABLE "feed_source" DROP CONSTRAINT "FK_a4ead2fdceb9998b4dc4d01935b"`);
        await queryRunner.query(`ALTER TABLE "feed_source" DROP CONSTRAINT "FK_b08384d9c394e68429a9eea4df7"`);
        await queryRunner.query(`ALTER TABLE "feed_tag" DROP CONSTRAINT "FK_8c6d05462bc68459e00f165d51c"`);
        await queryRunner.query(`ALTER TABLE "post_report" DROP CONSTRAINT "FK_d1d5a13218f895570f4d7ad5897"`);
        await queryRunner.query(`ALTER TABLE "post_tag" DROP CONSTRAINT "FK_f3c0b831daae119196482c99379"`);
        await queryRunner.query(`ALTER TABLE "settings" DROP CONSTRAINT "FK_9175e059b0a720536f7726a88c7"`);
        await queryRunner.query(`ALTER TABLE "source_display" DROP CONSTRAINT "FK_ad5e759962cd86ff322cb480d09"`);
        await queryRunner.query(`ALTER TABLE "source_feed" DROP CONSTRAINT "FK_4f708e773c1df9c288180fbb555"`);
        await queryRunner.query(`ALTER TABLE "view" DROP CONSTRAINT "FK_82db04e5b5686aec67abf4577e9"`);
        await queryRunner.query(`ALTER TABLE "user_company" DROP CONSTRAINT "FK_9c279d6cf291c858efa8a6b143f"`);
        await queryRunner.query(`ALTER TABLE "organization" DROP CONSTRAINT "FK_organization_dataset_location_locationId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_post_url"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_post_canonicalUrl"`);
        await queryRunner.query(`DROP INDEX "public"."idx_user_transaction_createdAt_desc"`);
        await queryRunner.query(`DROP INDEX "public"."idx_user_transaction_status_updated_at"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7e1d93d646c13a3a0a2c7e2d5a"`);
        await queryRunner.query(`DROP INDEX "public"."user_idx_lowerusername_username"`);
        await queryRunner.query(`DROP INDEX "public"."idx_user_gin_username"`);
        await queryRunner.query(`DROP INDEX "public"."idx_user_gin_name"`);
        await queryRunner.query(`DROP INDEX "public"."idx_user_reputation"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_user_cioRegistered"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b2e3f7568dafa9e86ae0391011"`);
        await queryRunner.query(`DROP INDEX "public"."idx_user_streak_currentstreak_userid"`);
        await queryRunner.query(`DROP INDEX "public"."idx_user_streak_totalstreak_userid"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_85dda8e9982027f27696273a20"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b0df46b7939819e8bc14cf9f45"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a56238722b511b0be1ce2ef260"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b08384d9c394e68429a9eea4df"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a4ead2fdceb9998b4dc4d01935"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f3c0b831daae119196482c9937"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cc6fec511089f9ea5017b15d77"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c41a183d0b219907f07efa3e11"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9caaea7864887299e2cb4ef355"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_82db04e5b5686aec67abf4577e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_339031b134e88d3096bfaf928c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9cb4aa5be0760354054764eefb"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e74e00c9de47272d1a9ea327ab"`);
        await queryRunner.query(`ALTER TABLE "user" ADD "socialLinks" jsonb NOT NULL DEFAULT '[]'`);
        await queryRunner.query(`ALTER TABLE "source" ALTER COLUMN "memberPostingRank" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "source" ALTER COLUMN "memberInviteRank" DROP NOT NULL`);
        await queryRunner.query(`DROP INDEX "public"."IDX_keyword_status_value_occurrences"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_status_value"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_keyword_status_occ_value"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_keyword_status"`);
        await queryRunner.query(`ALTER TABLE "keyword" DROP COLUMN "status"`);
        await queryRunner.query(`ALTER TABLE "keyword" ADD "status" text NOT NULL DEFAULT 'pending'`);
        await queryRunner.query(`DROP INDEX "public"."IDX_content_preference_reference_user_id"`);
        await queryRunner.query(`ALTER TABLE "content_preference" DROP COLUMN "referenceUserId"`);
        await queryRunner.query(`ALTER TABLE "content_preference" ADD "referenceUserId" character varying`);
        await queryRunner.query(`ALTER TABLE "comment" ALTER COLUMN "contentHtml" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user_integration" ALTER COLUMN "meta" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "feed" DROP CONSTRAINT "FK_70952a3f1b3717e7021a439edda"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_feed_id_user_id"`);
        await queryRunner.query(`ALTER TABLE "feed" DROP COLUMN "userId"`);
        await queryRunner.query(`ALTER TABLE "feed" ADD "userId" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_ff0f49b797aca629f81cef47610"`);
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "UQ_ff0f49b797aca629f81cef47610" UNIQUE ("defaultFeedId")`);
        await queryRunner.query(`ALTER TABLE "user_action" DROP CONSTRAINT "FK_c025478b45e60017ed10c77f99c"`);
        await queryRunner.query(`ALTER TABLE "user_action" DROP CONSTRAINT "PK_d2be31969535c36966ac5b76410"`);
        await queryRunner.query(`ALTER TABLE "user_action" ADD CONSTRAINT "PK_d2be31969535c36966ac5b76410" PRIMARY KEY ("type")`);
        await queryRunner.query(`ALTER TABLE "user_action" DROP COLUMN "userId"`);
        await queryRunner.query(`ALTER TABLE "user_action" ADD "userId" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user_action" DROP CONSTRAINT "PK_d2be31969535c36966ac5b76410"`);
        await queryRunner.query(`ALTER TABLE "user_action" ADD CONSTRAINT "PK_d2be31969535c36966ac5b76410" PRIMARY KEY ("type", "userId")`);
        await queryRunner.query(`ALTER TABLE "user_top_reader" ALTER COLUMN "id" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "user_top_reader" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4()`);
        await queryRunner.query(`ALTER TABLE "bookmark" DROP CONSTRAINT "FK_e389fc192c59bdce0847ef9ef8b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bookmark_userId_createdAt"`);
        await queryRunner.query(`ALTER TABLE "bookmark" DROP CONSTRAINT "PK_ffde759b87b2d3af9a6fae265ac"`);
        await queryRunner.query(`ALTER TABLE "bookmark" ADD CONSTRAINT "PK_ffde759b87b2d3af9a6fae265ac" PRIMARY KEY ("postId")`);
        await queryRunner.query(`ALTER TABLE "bookmark" DROP COLUMN "userId"`);
        await queryRunner.query(`ALTER TABLE "bookmark" ADD "userId" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "bookmark" DROP CONSTRAINT "PK_ffde759b87b2d3af9a6fae265ac"`);
        await queryRunner.query(`ALTER TABLE "bookmark" ADD CONSTRAINT "PK_ffde759b87b2d3af9a6fae265ac" PRIMARY KEY ("postId", "userId")`);
        await queryRunner.query(`ALTER TABLE "bookmark_list" DROP COLUMN "userId"`);
        await queryRunner.query(`ALTER TABLE "bookmark_list" ADD "userId" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "submission" ALTER COLUMN "reason" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "notification_preference" DROP CONSTRAINT "FK_c8721bd56ae600308745ad49744"`);
        await queryRunner.query(`ALTER TABLE "notification_preference" DROP CONSTRAINT "PK_de66bee12eefee879479c27f94f"`);
        await queryRunner.query(`ALTER TABLE "notification_preference" ADD CONSTRAINT "PK_de66bee12eefee879479c27f94f" PRIMARY KEY ("referenceId", "notificationType")`);
        await queryRunner.query(`ALTER TABLE "notification_preference" DROP COLUMN "userId"`);
        await queryRunner.query(`ALTER TABLE "notification_preference" ADD "userId" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "notification_preference" DROP CONSTRAINT "PK_de66bee12eefee879479c27f94f"`);
        await queryRunner.query(`ALTER TABLE "notification_preference" ADD CONSTRAINT "PK_de66bee12eefee879479c27f94f" PRIMARY KEY ("referenceId", "notificationType", "userId")`);
        await queryRunner.query(`ALTER TABLE "user_source_integration" ALTER COLUMN "channelIds" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user_candidate_preference" ALTER COLUMN "locationType" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "dataset_location" ADD CONSTRAINT "UQ_3d2d01d9c20653dd58e6741666c" UNIQUE ("externalId")`);
        await queryRunner.query(`CREATE INDEX "IDX_post_awards" ON "post" ("awards") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_2d4cb7f2ff3bcc12f0639d8f86" ON "post" ("url") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_02634e624fee03af415a7597ed" ON "post" ("canonicalUrl") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_2d4cb7f2ff3bcc12f0639d8f86" ON "post" ("url") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_02634e624fee03af415a7597ed" ON "post" ("canonicalUrl") `);
        await queryRunner.query(`CREATE INDEX "IDX_b499447822de3f24ad355e19b8" ON "post" ("type") `);
        await queryRunner.query(`CREATE INDEX "IDX_keyword_status" ON "keyword" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_keyword_status_value_occurrences" ON "keyword" ("status", "value", "occurrences") `);
        await queryRunner.query(`CREATE INDEX "IDX_status_value" ON "keyword" ("status", "value") `);
        await queryRunner.query(`CREATE INDEX "IDX_content_preference_reference_user_id" ON "content_preference" ("referenceUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_comment_awards" ON "comment" ("awards") `);
        await queryRunner.query(`CREATE INDEX "IDX_70952a3f1b3717e7021a439edd" ON "feed" ("userId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_feed_id_user_id" ON "feed" ("id", "userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c025478b45e60017ed10c77f99" ON "user_action" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f2678f7b11e5128abbbc451190" ON "alerts" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_ee4a9b84b65399f9a6581d9a9a" ON "bookmark" ("postId") `);
        await queryRunner.query(`CREATE INDEX "IDX_ff105847cfef10dd4af15b52a9" ON "bookmark_list" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a9b3d81d71cd6c2cd82249f689" ON "feed_source" ("feedId") `);
        await queryRunner.query(`CREATE INDEX "IDX_79143dac6de88d4ba0f0ecfa0d" ON "feed_source" ("sourceId") `);
        await queryRunner.query(`CREATE INDEX "IDX_444c1b4f6cd7b632277f557935" ON "post_tag" ("postId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a72fa6b0a0b9ea438fbef00cb3" ON "source_display" ("userId", "enabled") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_bf5818e5de16bc943005a50166" ON "source_display" ("sourceId", "userId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_f83844a38b17aa07772469cb08" ON "source_feed" ("sourceId", "feed") `);
        await queryRunner.query(`CREATE INDEX "IDX_6d32bd7a8976dac90c4e11b340" ON "tag_segment" ("segment") `);
        await queryRunner.query(`CREATE INDEX "IDX_19da087dd68a0bc5e5302ca9a5" ON "view" ("postId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c6af9853ff6a60d2e80dd8b3af" ON "view" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_10dff5dbc360f0d47cada787c7" ON "view" ("timestamp") `);
        await queryRunner.query(`CREATE INDEX "IDX_c63ec25b983985f2fee951afcc" ON "view" ("postId", "userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_65a9ca0600dbc72c6ff76501a6" ON "notification_preference" ("type") `);
        await queryRunner.query(`ALTER TABLE "post" ADD CONSTRAINT "FK_0b78981ffc8817ce54da9180a8d" FOREIGN KEY ("sourceId") REFERENCES "source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "post" ADD CONSTRAINT "FK_1609023c77409ed0c4388ec240e" FOREIGN KEY ("scoutId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "post" ADD CONSTRAINT "FK_c6fb082a3114f35d0cc27c518e0" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "post_keyword" ADD CONSTRAINT "FK_b96fa78416c5366186a32b9dd45" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "content_preference" ADD CONSTRAINT "FK_cea0cfe859c4cb4e35da879e111" FOREIGN KEY ("referenceUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comment" ADD CONSTRAINT "FK_94a85bb16d24033a2afdd5df060" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comment" ADD CONSTRAINT "FK_c0354a9a009d3bb45a08655ce3b" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comment" ADD CONSTRAINT "FK_e3aebe2bd1c53467a07109be596" FOREIGN KEY ("parentId") REFERENCES "comment"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_transaction" ADD CONSTRAINT "FK_bb9c8cc52dbf33107f613fb8302" FOREIGN KEY ("receiverId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "feed" ADD CONSTRAINT "FK_70952a3f1b3717e7021a439edda" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "FK_ff0f49b797aca629f81cef47610" FOREIGN KEY ("defaultFeedId") REFERENCES "feed"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "FK_user_locationId" FOREIGN KEY ("locationId") REFERENCES "dataset_location"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_action" ADD CONSTRAINT "FK_c025478b45e60017ed10c77f99c" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "bookmark" ADD CONSTRAINT "FK_ee4a9b84b65399f9a6581d9a9a5" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "bookmark" ADD CONSTRAINT "FK_e389fc192c59bdce0847ef9ef8b" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "bookmark_list" ADD CONSTRAINT "FK_ff105847cfef10dd4af15b52a9a" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dev_card" ADD CONSTRAINT "FK_338150b6c9b6d9b788d285d1c95" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "feed_advanced_settings" ADD CONSTRAINT "FK_eaa6a8fb25235695fb7f99af859" FOREIGN KEY ("feedId") REFERENCES "feed"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "feed_advanced_settings" ADD CONSTRAINT "FK_67f0b1889dd335ea2c196146f82" FOREIGN KEY ("advancedSettingsId") REFERENCES "advanced_settings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "feed_source" ADD CONSTRAINT "FK_a9b3d81d71cd6c2cd82249f6895" FOREIGN KEY ("feedId") REFERENCES "feed"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "feed_source" ADD CONSTRAINT "FK_79143dac6de88d4ba0f0ecfa0d9" FOREIGN KEY ("sourceId") REFERENCES "source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "feed_tag" ADD CONSTRAINT "FK_e875186f4a0f01b72cc3e79eaee" FOREIGN KEY ("feedId") REFERENCES "feed"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "post_report" ADD CONSTRAINT "FK_44b0e753044952524eb47ac6f40" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "post_tag" ADD CONSTRAINT "FK_444c1b4f6cd7b632277f5579354" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "source_display" ADD CONSTRAINT "FK_b65c592c197135747cab64e986a" FOREIGN KEY ("sourceId") REFERENCES "source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "source_feed" ADD CONSTRAINT "FK_725e606248d79f0f10d0fe730c0" FOREIGN KEY ("sourceId") REFERENCES "source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "view" ADD CONSTRAINT "FK_19da087dd68a0bc5e5302ca9a59" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "notification_preference" ADD CONSTRAINT "FK_c8721bd56ae600308745ad49744" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "organization" ADD CONSTRAINT "FK_organization_dataset_location_locationId" FOREIGN KEY ("locationId") REFERENCES "dataset_location"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "post_analytics_history" ADD CONSTRAINT "FK_6bb82232882b9a8bfa54a034c5f" FOREIGN KEY ("id") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "post_analytics" ADD CONSTRAINT "FK_421771f55c623cd4f6103828196" FOREIGN KEY ("id") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`CREATE MATERIALIZED VIEW "source_tag_view" AS SELECT "s"."id" as sourceId, "pk"."keyword" AS tag, count("pk"."keyword") AS count FROM "public"."source" "s" INNER JOIN "public"."post" "p" ON "p"."sourceId" = "s"."id" AND "p"."createdAt" > :time  INNER JOIN "public"."post_keyword" "pk" ON "pk"."postId" = "p"."id" AND "pk"."status" = :status WHERE ("s"."active" = :orm_param_0 AND "s"."private" = :orm_param_1) GROUP BY sourceId, tag`);
        await queryRunner.query(`INSERT INTO "public"."typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`, ["public","MATERIALIZED_VIEW","source_tag_view","SELECT \"s\".\"id\" as sourceId, \"pk\".\"keyword\" AS tag, count(\"pk\".\"keyword\") AS count FROM \"public\".\"source\" \"s\" INNER JOIN \"public\".\"post\" \"p\" ON \"p\".\"sourceId\" = \"s\".\"id\" AND \"p\".\"createdAt\" > :time  INNER JOIN \"public\".\"post_keyword\" \"pk\" ON \"pk\".\"postId\" = \"p\".\"id\" AND \"pk\".\"status\" = :status WHERE (\"s\".\"active\" = :orm_param_0 AND \"s\".\"private\" = :orm_param_1) GROUP BY sourceId, tag"]);
        await queryRunner.query(`CREATE MATERIALIZED VIEW "popular_video_source" AS SELECT "sourceId", avg(r) r, count(*) posts FROM "public"."popular_video_post" "base" GROUP BY "sourceId" HAVING count(*) > 5 ORDER BY r DESC`);
        await queryRunner.query(`INSERT INTO "public"."typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`, ["public","MATERIALIZED_VIEW","popular_video_source","SELECT \"sourceId\", avg(r) r, count(*) posts FROM \"public\".\"popular_video_post\" \"base\" GROUP BY \"sourceId\" HAVING count(*) > 5 ORDER BY r DESC"]);
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
        ) AS "commentUpvotes", (SELECT COALESCE(COUNT(*), 0)
          FROM "user_top_reader" utp
          WHERE utp."userId" = u."id"
        ) AS "topReaderBadges" FROM "public"."user" "u" WHERE "u"."infoConfirmed" = TRUE AND "u"."id" != :ghostId`);
        await queryRunner.query(`INSERT INTO "public"."typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`, ["public","MATERIALIZED_VIEW","user_stats","SELECT u.\"id\", (SELECT COALESCE(COUNT(*), 0)\n          FROM \"user\"\n          WHERE \"referralId\" = u.\"id\"\n        ) AS \"referrals\", (SELECT COALESCE(SUM(p.\"views\"), 0)\n          FROM \"post\" p\n          WHERE (p.\"authorId\" = u.\"id\" OR p.\"scoutId\" = u.\"id\")\n            AND p.\"visible\" = TRUE\n            AND p.\"deleted\" = FALSE\n        ) AS \"views\", (SELECT COALESCE(SUM(p.\"upvotes\"), 0)\n          FROM \"post\" p\n          WHERE (p.\"authorId\" = u.\"id\" OR p.\"scoutId\" = u.\"id\")\n            AND p.\"visible\" = TRUE\n            AND p.\"deleted\" = FALSE\n        ) AS \"postUpvotes\", (SELECT COALESCE(SUM(c.\"upvotes\"), 0)\n          FROM \"comment\" c\n          WHERE c.\"userId\" = u.\"id\"\n        ) AS \"commentUpvotes\", (SELECT COALESCE(COUNT(*), 0)\n          FROM \"user_top_reader\" utp\n          WHERE utp.\"userId\" = u.\"id\"\n        ) AS \"topReaderBadges\" FROM \"public\".\"user\" \"u\" WHERE \"u\".\"infoConfirmed\" = TRUE AND \"u\".\"id\" != :ghostId"]);
        await queryRunner.query(`CREATE INDEX "IDX_sourceTag_sourceId" ON "source_tag_view" ("sourceId") `);
        await queryRunner.query(`CREATE INDEX "IDX_sourceTag_tag" ON "source_tag_view" ("tag") `);
        await queryRunner.query(`CREATE INDEX "IDX_user_stats_id" ON "user_stats" ("id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_user_stats_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_sourceTag_tag"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_sourceTag_sourceId"`);
        await queryRunner.query(`DELETE FROM "public"."typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`, ["MATERIALIZED_VIEW","user_stats","public"]);
        await queryRunner.query(`DROP MATERIALIZED VIEW "user_stats"`);
        await queryRunner.query(`DELETE FROM "public"."typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`, ["MATERIALIZED_VIEW","popular_video_source","public"]);
        await queryRunner.query(`DROP MATERIALIZED VIEW "popular_video_source"`);
        await queryRunner.query(`DELETE FROM "public"."typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`, ["MATERIALIZED_VIEW","source_tag_view","public"]);
        await queryRunner.query(`DROP MATERIALIZED VIEW "source_tag_view"`);
        await queryRunner.query(`ALTER TABLE "post_analytics" DROP CONSTRAINT "FK_421771f55c623cd4f6103828196"`);
        await queryRunner.query(`ALTER TABLE "post_analytics_history" DROP CONSTRAINT "FK_6bb82232882b9a8bfa54a034c5f"`);
        await queryRunner.query(`ALTER TABLE "organization" DROP CONSTRAINT "FK_organization_dataset_location_locationId"`);
        await queryRunner.query(`ALTER TABLE "notification_preference" DROP CONSTRAINT "FK_c8721bd56ae600308745ad49744"`);
        await queryRunner.query(`ALTER TABLE "view" DROP CONSTRAINT "FK_19da087dd68a0bc5e5302ca9a59"`);
        await queryRunner.query(`ALTER TABLE "source_feed" DROP CONSTRAINT "FK_725e606248d79f0f10d0fe730c0"`);
        await queryRunner.query(`ALTER TABLE "source_display" DROP CONSTRAINT "FK_b65c592c197135747cab64e986a"`);
        await queryRunner.query(`ALTER TABLE "post_tag" DROP CONSTRAINT "FK_444c1b4f6cd7b632277f5579354"`);
        await queryRunner.query(`ALTER TABLE "post_report" DROP CONSTRAINT "FK_44b0e753044952524eb47ac6f40"`);
        await queryRunner.query(`ALTER TABLE "feed_tag" DROP CONSTRAINT "FK_e875186f4a0f01b72cc3e79eaee"`);
        await queryRunner.query(`ALTER TABLE "feed_source" DROP CONSTRAINT "FK_79143dac6de88d4ba0f0ecfa0d9"`);
        await queryRunner.query(`ALTER TABLE "feed_source" DROP CONSTRAINT "FK_a9b3d81d71cd6c2cd82249f6895"`);
        await queryRunner.query(`ALTER TABLE "feed_advanced_settings" DROP CONSTRAINT "FK_67f0b1889dd335ea2c196146f82"`);
        await queryRunner.query(`ALTER TABLE "feed_advanced_settings" DROP CONSTRAINT "FK_eaa6a8fb25235695fb7f99af859"`);
        await queryRunner.query(`ALTER TABLE "dev_card" DROP CONSTRAINT "FK_338150b6c9b6d9b788d285d1c95"`);
        await queryRunner.query(`ALTER TABLE "bookmark_list" DROP CONSTRAINT "FK_ff105847cfef10dd4af15b52a9a"`);
        await queryRunner.query(`ALTER TABLE "bookmark" DROP CONSTRAINT "FK_e389fc192c59bdce0847ef9ef8b"`);
        await queryRunner.query(`ALTER TABLE "bookmark" DROP CONSTRAINT "FK_ee4a9b84b65399f9a6581d9a9a5"`);
        await queryRunner.query(`ALTER TABLE "user_action" DROP CONSTRAINT "FK_c025478b45e60017ed10c77f99c"`);
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_user_locationId"`);
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_ff0f49b797aca629f81cef47610"`);
        await queryRunner.query(`ALTER TABLE "feed" DROP CONSTRAINT "FK_70952a3f1b3717e7021a439edda"`);
        await queryRunner.query(`ALTER TABLE "user_transaction" DROP CONSTRAINT "FK_bb9c8cc52dbf33107f613fb8302"`);
        await queryRunner.query(`ALTER TABLE "comment" DROP CONSTRAINT "FK_e3aebe2bd1c53467a07109be596"`);
        await queryRunner.query(`ALTER TABLE "comment" DROP CONSTRAINT "FK_c0354a9a009d3bb45a08655ce3b"`);
        await queryRunner.query(`ALTER TABLE "comment" DROP CONSTRAINT "FK_94a85bb16d24033a2afdd5df060"`);
        await queryRunner.query(`ALTER TABLE "content_preference" DROP CONSTRAINT "FK_cea0cfe859c4cb4e35da879e111"`);
        await queryRunner.query(`ALTER TABLE "post_keyword" DROP CONSTRAINT "FK_b96fa78416c5366186a32b9dd45"`);
        await queryRunner.query(`ALTER TABLE "post" DROP CONSTRAINT "FK_c6fb082a3114f35d0cc27c518e0"`);
        await queryRunner.query(`ALTER TABLE "post" DROP CONSTRAINT "FK_1609023c77409ed0c4388ec240e"`);
        await queryRunner.query(`ALTER TABLE "post" DROP CONSTRAINT "FK_0b78981ffc8817ce54da9180a8d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_65a9ca0600dbc72c6ff76501a6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c63ec25b983985f2fee951afcc"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_10dff5dbc360f0d47cada787c7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c6af9853ff6a60d2e80dd8b3af"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_19da087dd68a0bc5e5302ca9a5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6d32bd7a8976dac90c4e11b340"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f83844a38b17aa07772469cb08"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bf5818e5de16bc943005a50166"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a72fa6b0a0b9ea438fbef00cb3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_444c1b4f6cd7b632277f557935"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_79143dac6de88d4ba0f0ecfa0d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a9b3d81d71cd6c2cd82249f689"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ff105847cfef10dd4af15b52a9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ee4a9b84b65399f9a6581d9a9a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f2678f7b11e5128abbbc451190"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c025478b45e60017ed10c77f99"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_feed_id_user_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_70952a3f1b3717e7021a439edd"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_comment_awards"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_content_preference_reference_user_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_status_value"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_keyword_status_value_occurrences"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_keyword_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b499447822de3f24ad355e19b8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_02634e624fee03af415a7597ed"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2d4cb7f2ff3bcc12f0639d8f86"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_02634e624fee03af415a7597ed"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2d4cb7f2ff3bcc12f0639d8f86"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_post_awards"`);
        await queryRunner.query(`ALTER TABLE "dataset_location" DROP CONSTRAINT "UQ_3d2d01d9c20653dd58e6741666c"`);
        await queryRunner.query(`ALTER TABLE "user_candidate_preference" ALTER COLUMN "locationType" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user_source_integration" ALTER COLUMN "channelIds" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "notification_preference" DROP CONSTRAINT "PK_de66bee12eefee879479c27f94f"`);
        await queryRunner.query(`ALTER TABLE "notification_preference" ADD CONSTRAINT "PK_de66bee12eefee879479c27f94f" PRIMARY KEY ("referenceId", "notificationType")`);
        await queryRunner.query(`ALTER TABLE "notification_preference" DROP COLUMN "userId"`);
        await queryRunner.query(`ALTER TABLE "notification_preference" ADD "userId" text NOT NULL`);
        await queryRunner.query(`ALTER TABLE "notification_preference" DROP CONSTRAINT "PK_de66bee12eefee879479c27f94f"`);
        await queryRunner.query(`ALTER TABLE "notification_preference" ADD CONSTRAINT "PK_de66bee12eefee879479c27f94f" PRIMARY KEY ("referenceId", "userId", "notificationType")`);
        await queryRunner.query(`ALTER TABLE "notification_preference" ADD CONSTRAINT "FK_c8721bd56ae600308745ad49744" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "submission" ALTER COLUMN "reason" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "bookmark_list" DROP COLUMN "userId"`);
        await queryRunner.query(`ALTER TABLE "bookmark_list" ADD "userId" text NOT NULL`);
        await queryRunner.query(`ALTER TABLE "bookmark" DROP CONSTRAINT "PK_ffde759b87b2d3af9a6fae265ac"`);
        await queryRunner.query(`ALTER TABLE "bookmark" ADD CONSTRAINT "PK_ffde759b87b2d3af9a6fae265ac" PRIMARY KEY ("postId")`);
        await queryRunner.query(`ALTER TABLE "bookmark" DROP COLUMN "userId"`);
        await queryRunner.query(`ALTER TABLE "bookmark" ADD "userId" text NOT NULL`);
        await queryRunner.query(`ALTER TABLE "bookmark" DROP CONSTRAINT "PK_ffde759b87b2d3af9a6fae265ac"`);
        await queryRunner.query(`ALTER TABLE "bookmark" ADD CONSTRAINT "PK_ffde759b87b2d3af9a6fae265ac" PRIMARY KEY ("postId", "userId")`);
        await queryRunner.query(`CREATE INDEX "IDX_bookmark_userId_createdAt" ON "bookmark" ("createdAt", "userId") `);
        await queryRunner.query(`ALTER TABLE "bookmark" ADD CONSTRAINT "FK_e389fc192c59bdce0847ef9ef8b" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_top_reader" ALTER COLUMN "id" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "user_top_reader" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4()`);
        await queryRunner.query(`ALTER TABLE "user_action" DROP CONSTRAINT "PK_d2be31969535c36966ac5b76410"`);
        await queryRunner.query(`ALTER TABLE "user_action" ADD CONSTRAINT "PK_d2be31969535c36966ac5b76410" PRIMARY KEY ("type")`);
        await queryRunner.query(`ALTER TABLE "user_action" DROP COLUMN "userId"`);
        await queryRunner.query(`ALTER TABLE "user_action" ADD "userId" text NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user_action" DROP CONSTRAINT "PK_d2be31969535c36966ac5b76410"`);
        await queryRunner.query(`ALTER TABLE "user_action" ADD CONSTRAINT "PK_d2be31969535c36966ac5b76410" PRIMARY KEY ("userId", "type")`);
        await queryRunner.query(`ALTER TABLE "user_action" ADD CONSTRAINT "FK_c025478b45e60017ed10c77f99c" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "UQ_ff0f49b797aca629f81cef47610"`);
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "FK_ff0f49b797aca629f81cef47610" FOREIGN KEY ("defaultFeedId") REFERENCES "feed"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "feed" DROP COLUMN "userId"`);
        await queryRunner.query(`ALTER TABLE "feed" ADD "userId" text NOT NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_feed_id_user_id" ON "feed" ("id", "userId") `);
        await queryRunner.query(`ALTER TABLE "feed" ADD CONSTRAINT "FK_70952a3f1b3717e7021a439edda" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_integration" ALTER COLUMN "meta" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "comment" ALTER COLUMN "contentHtml" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "content_preference" DROP COLUMN "referenceUserId"`);
        await queryRunner.query(`ALTER TABLE "content_preference" ADD "referenceUserId" text`);
        await queryRunner.query(`CREATE INDEX "IDX_content_preference_reference_user_id" ON "content_preference" ("referenceUserId") `);
        await queryRunner.query(`ALTER TABLE "keyword" DROP COLUMN "status"`);
        await queryRunner.query(`ALTER TABLE "keyword" ADD "status" character varying NOT NULL DEFAULT 'pending'`);
        await queryRunner.query(`CREATE INDEX "IDX_keyword_status" ON "keyword" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_keyword_status_occ_value" ON "keyword" ("occurrences", "status", "value") `);
        await queryRunner.query(`CREATE INDEX "IDX_status_value" ON "keyword" ("status", "value") `);
        await queryRunner.query(`CREATE INDEX "IDX_keyword_status_value_occurrences" ON "keyword" ("occurrences", "status", "value") `);
        await queryRunner.query(`ALTER TABLE "source" ALTER COLUMN "memberInviteRank" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "source" ALTER COLUMN "memberPostingRank" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "socialLinks"`);
        await queryRunner.query(`CREATE INDEX "IDX_e74e00c9de47272d1a9ea327ab" ON "view" ("postId", "userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9cb4aa5be0760354054764eefb" ON "view" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_339031b134e88d3096bfaf928c" ON "view" ("timestamp") `);
        await queryRunner.query(`CREATE INDEX "IDX_82db04e5b5686aec67abf4577e" ON "view" ("postId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_9caaea7864887299e2cb4ef355" ON "source_feed" ("feed", "sourceId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_c41a183d0b219907f07efa3e11" ON "source_display" ("sourceId", "userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_cc6fec511089f9ea5017b15d77" ON "source_display" ("enabled", "userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f3c0b831daae119196482c9937" ON "post_tag" ("postId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a4ead2fdceb9998b4dc4d01935" ON "feed_source" ("sourceId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b08384d9c394e68429a9eea4df" ON "feed_source" ("feedId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a56238722b511b0be1ce2ef260" ON "bookmark" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b0df46b7939819e8bc14cf9f45" ON "bookmark" ("postId") `);
        await queryRunner.query(`CREATE INDEX "IDX_85dda8e9982027f27696273a20" ON "alerts" ("userId") `);
        await queryRunner.query(`CREATE INDEX "idx_user_streak_totalstreak_userid" ON "user_streak" ("totalStreak", "userId") `);
        await queryRunner.query(`CREATE INDEX "idx_user_streak_currentstreak_userid" ON "user_streak" ("currentStreak", "userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b2e3f7568dafa9e86ae0391011" ON "user_action" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_user_cioRegistered" ON "user" ("cioRegistered") `);
        await queryRunner.query(`CREATE INDEX "idx_user_reputation" ON "user" ("reputation") `);
        await queryRunner.query(`CREATE INDEX "idx_user_gin_name" ON "user" ("name") `);
        await queryRunner.query(`CREATE INDEX "idx_user_gin_username" ON "user" ("username") `);
        await queryRunner.query(`CREATE INDEX "user_idx_lowerusername_username" ON "user" ("username") `);
        await queryRunner.query(`CREATE INDEX "IDX_7e1d93d646c13a3a0a2c7e2d5a" ON "feed" ("userId") `);
        await queryRunner.query(`CREATE INDEX "idx_user_transaction_status_updated_at" ON "user_transaction" ("status", "updatedAt") `);
        await queryRunner.query(`CREATE INDEX "idx_user_transaction_createdAt_desc" ON "user_transaction" ("createdAt") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_post_canonicalUrl" ON "post" ("canonicalUrl") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_post_url" ON "post" ("url") `);
        await queryRunner.query(`ALTER TABLE "organization" ADD CONSTRAINT "FK_organization_dataset_location_locationId" FOREIGN KEY ("locationId") REFERENCES "dataset_location"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_company" ADD CONSTRAINT "FK_9c279d6cf291c858efa8a6b143f" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "view" ADD CONSTRAINT "FK_82db04e5b5686aec67abf4577e9" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "source_feed" ADD CONSTRAINT "FK_4f708e773c1df9c288180fbb555" FOREIGN KEY ("sourceId") REFERENCES "source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "source_display" ADD CONSTRAINT "FK_ad5e759962cd86ff322cb480d09" FOREIGN KEY ("sourceId") REFERENCES "source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "settings" ADD CONSTRAINT "FK_9175e059b0a720536f7726a88c7" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "post_tag" ADD CONSTRAINT "FK_f3c0b831daae119196482c99379" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "post_report" ADD CONSTRAINT "FK_d1d5a13218f895570f4d7ad5897" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "feed_tag" ADD CONSTRAINT "FK_8c6d05462bc68459e00f165d51c" FOREIGN KEY ("feedId") REFERENCES "feed"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "feed_source" ADD CONSTRAINT "FK_b08384d9c394e68429a9eea4df7" FOREIGN KEY ("feedId") REFERENCES "feed"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "feed_source" ADD CONSTRAINT "FK_a4ead2fdceb9998b4dc4d01935b" FOREIGN KEY ("sourceId") REFERENCES "source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "feed_advanced_settings" ADD CONSTRAINT "FK_01d5bc49fc5802c4e067d7ba4c9" FOREIGN KEY ("feedId") REFERENCES "feed"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "feed_advanced_settings" ADD CONSTRAINT "FK_c46745c935040ef6188c9cbf013" FOREIGN KEY ("advancedSettingsId") REFERENCES "advanced_settings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dev_card" ADD CONSTRAINT "FK_70a77f197a0f92324256c983fc6" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "bookmark" ADD CONSTRAINT "FK_b0df46b7939819e8bc14cf9f45c" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "alerts" ADD CONSTRAINT "FK_f2678f7b11e5128abbbc4511906" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "FK_user_locationId" FOREIGN KEY ("locationId") REFERENCES "dataset_location"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_personalized_digest" ADD CONSTRAINT "FK_user_personalized_digest_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_transaction" ADD CONSTRAINT "FK_1422cc85c1642eed91e947cf877" FOREIGN KEY ("receiverId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comment" ADD CONSTRAINT "FK_d82dbf00f15d651edf917c8167f" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comment" ADD CONSTRAINT "FK_f1305337f54e8211d5a84da0cc5" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comment" ADD CONSTRAINT "FK_cb2ce95b74f2ee583447362d508" FOREIGN KEY ("parentId") REFERENCES "comment"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "content_preference" ADD CONSTRAINT "FK_231b13306df1d5046ffa7c4568b" FOREIGN KEY ("referenceUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "content_preference" ADD CONSTRAINT "FK_a6977adf724e068f6faae2914da" FOREIGN KEY ("referenceUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "post_keyword" ADD CONSTRAINT "FK_88d97436b07e1462d5a7877dcb3" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "post" ADD CONSTRAINT "FK_83c8ae07417cd6de65b8b994587" FOREIGN KEY ("sourceId") REFERENCES "source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "post" ADD CONSTRAINT "FK_f1bb0e9a2279673a76520d2adc5" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "post" ADD CONSTRAINT "FK_a51326b93176f2b2ebf3eda9fef" FOREIGN KEY ("scoutId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`CREATE MATERIALIZED VIEW "source_tag_view" AS SELECT "s"."id" as "sourceId", "pk"."keyword" AS tag, count("pk"."keyword") AS count FROM "public"."source" "s" INNER JOIN "public"."post" "p" ON "p"."sourceId" = "s"."id" AND "p"."createdAt" > (current_timestamp - interval '90 day')::date  INNER JOIN "public"."post_keyword" "pk" ON "pk"."postId" = "p"."id" AND "pk"."status" = 'allow' WHERE ("s"."active" = true AND "s"."private" = false) GROUP BY "s"."id", tag`);
        await queryRunner.query(`INSERT INTO "public"."typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`, ["public","MATERIALIZED_VIEW","source_tag_view","SELECT \"s\".\"id\" as \"sourceId\", \"pk\".\"keyword\" AS tag, count(\"pk\".\"keyword\") AS count FROM \"public\".\"source\" \"s\" INNER JOIN \"public\".\"post\" \"p\" ON \"p\".\"sourceId\" = \"s\".\"id\" AND \"p\".\"createdAt\" > (current_timestamp - interval '90 day')::date  INNER JOIN \"public\".\"post_keyword\" \"pk\" ON \"pk\".\"postId\" = \"p\".\"id\" AND \"pk\".\"status\" = 'allow' WHERE (\"s\".\"active\" = true AND \"s\".\"private\" = false) GROUP BY \"s\".\"id\", tag"]);
        await queryRunner.query(`CREATE MATERIALIZED VIEW "popular_video_source" AS SELECT "sourceId", avg(r) r, count(*) posts FROM "public"."popular_video_source" "base" GROUP BY "sourceId" HAVING count(*) > 5 ORDER BY r DESC`);
        await queryRunner.query(`INSERT INTO "public"."typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`, ["public","MATERIALIZED_VIEW","popular_video_source","SELECT \"sourceId\", avg(r) r, count(*) posts FROM \"public\".\"popular_video_source\" \"base\" GROUP BY \"sourceId\" HAVING count(*) > 5 ORDER BY r DESC"]);
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
        ) AS "commentUpvotes", (SELECT COALESCE(COUNT(*), 0)
          FROM "user_top_reader" utp
          WHERE utp."userId" = u."id"
        ) AS "topReaderBadges" FROM "public"."user" "u" WHERE "u"."infoConfirmed" = TRUE AND "u"."id" != '404'`);
        await queryRunner.query(`INSERT INTO "public"."typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`, ["public","MATERIALIZED_VIEW","user_stats","SELECT u.\"id\", (SELECT COALESCE(COUNT(*), 0)\n          FROM \"user\"\n          WHERE \"referralId\" = u.\"id\"\n        ) AS \"referrals\", (SELECT COALESCE(SUM(p.\"views\"), 0)\n          FROM \"post\" p\n          WHERE (p.\"authorId\" = u.\"id\" OR p.\"scoutId\" = u.\"id\")\n            AND p.\"visible\" = TRUE\n            AND p.\"deleted\" = FALSE\n        ) AS \"views\", (SELECT COALESCE(SUM(p.\"upvotes\"), 0)\n          FROM \"post\" p\n          WHERE (p.\"authorId\" = u.\"id\" OR p.\"scoutId\" = u.\"id\")\n            AND p.\"visible\" = TRUE\n            AND p.\"deleted\" = FALSE\n        ) AS \"postUpvotes\", (SELECT COALESCE(SUM(c.\"upvotes\"), 0)\n          FROM \"comment\" c\n          WHERE c.\"userId\" = u.\"id\"\n        ) AS \"commentUpvotes\", (SELECT COALESCE(COUNT(*), 0)\n          FROM \"user_top_reader\" utp\n          WHERE utp.\"userId\" = u.\"id\"\n        ) AS \"topReaderBadges\" FROM \"public\".\"user\" \"u\" WHERE \"u\".\"infoConfirmed\" = TRUE AND \"u\".\"id\" != '404'"]);
    }

}
