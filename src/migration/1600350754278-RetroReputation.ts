import {MigrationInterface, QueryRunner} from "typeorm";

export class RetroReputation1600350754278 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
      await queryRunner.query(`update "user" u set reputation = res.reputation from (select (sum(c.upvotes) + sum(c.featured::int) * 2) reputation, c."userId" from "comment" c where c.upvotes > 0 group by c."userId") res where u.id = res."userId";`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
      await queryRunner.query(`UPDATE "public"."user" SET "reputation" = 0`, undefined);
    }

}
