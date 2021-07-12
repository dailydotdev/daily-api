import { MigrationInterface, QueryRunner } from 'typeorm';

export class PostKeywordStatus1626085244394 implements MigrationInterface {
  name = 'PostKeywordStatus1626085244394';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."post_keyword" ADD "status" text`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_post_keyword_postId_status" ON "public"."post_keyword" ("postId", "status") `,
    );
    await queryRunner.query(
      `CREATE OR REPLACE FUNCTION keyword_trigger() RETURNS trigger AS $$
begin
  if ((TG_OP = 'UPDATE' and new."status" <> old."status") or TG_OP = 'INSERT') then
    update "public"."post_keyword" SET "status" = new.status WHERE "keyword" = new."value";
  elsif (TG_OP = 'DELETE') then
    update "public"."post_keyword" SET "status" = null WHERE "keyword" = old."value";
  end if;
  return new;
end
$$ LANGUAGE plpgsql;`,
    );
    await queryRunner.query(
      `CREATE TRIGGER keyword_trigger AFTER INSERT OR UPDATE OR DELETE ON "public"."keyword" FOR EACH ROW EXECUTE PROCEDURE keyword_trigger()`,
    );
    await queryRunner.query(
      `CREATE OR REPLACE FUNCTION post_keyword_trigger() RETURNS trigger AS $$
begin
  select status into new.status from keyword where new.keyword = keyword.value;
  return new;
end
$$ LANGUAGE plpgsql;`,
    );
    await queryRunner.query(
      `CREATE TRIGGER post_keyword_trigger BEFORE INSERT ON "public"."post_keyword" FOR EACH ROW EXECUTE PROCEDURE post_keyword_trigger()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER post_keyword_trigger ON "public"."post_keyword"`,
    );
    await queryRunner.query(`DROP FUNCTION post_keyword_trigger`);
    await queryRunner.query(
      `DROP TRIGGER keyword_trigger ON "public"."keyword"`,
    );
    await queryRunner.query(`DROP FUNCTION keyword_trigger`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_post_keyword_postId_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "public"."post_keyword" DROP COLUMN "status"`,
    );
  }
}
