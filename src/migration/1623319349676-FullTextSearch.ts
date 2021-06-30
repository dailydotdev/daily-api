import { MigrationInterface, QueryRunner } from 'typeorm';

export class FullTextSearch1623319349676 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "public"."post" ADD "tsv" TSVECTOR`);
    await queryRunner.query(
      `CREATE INDEX IDX_post_tsv ON "public"."post" USING GIST (tsv)`,
    );
    await queryRunner.query(
      `CREATE OR REPLACE FUNCTION process_text(query text) RETURNS text AS $$
begin
  return (select replace(regexp_replace(COALESCE(query, ''), '\\.|,', '', 'g'), '-', ' '));
end
$$ LANGUAGE plpgsql;`,
    );
    await queryRunner.query(
      `CREATE OR REPLACE FUNCTION post_tsv_trigger() RETURNS trigger AS $$
begin
  new.tsv := to_tsvector('english', process_text(new.title));
  return new;
end
$$ LANGUAGE plpgsql;`,
    );
    await queryRunner.query(
      `CREATE TRIGGER post_tsvector BEFORE INSERT OR UPDATE ON "public"."post" FOR EACH ROW EXECUTE PROCEDURE post_tsv_trigger()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER post_tsvector ON "public"."post"`);
    await queryRunner.query(`DROP FUNCTION post_tsv_trigger`);
    await queryRunner.query(`DROP FUNCTION process_text`);
    await queryRunner.query(`DROP INDEX IDX_post_tsv`);
    await queryRunner.query(`ALTER TABLE "public"."post" DROP COLUMN "tsv"`);
  }
}
