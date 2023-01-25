import { MigrationInterface, QueryRunner } from 'typeorm';

export class Feature1674543814613 implements MigrationInterface {
  name = 'Feature1674543814613';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "feature" ("feature" text NOT NULL, "userId" character varying(36) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c56b7756a6f5c8d6ee384c610b2" PRIMARY KEY ("feature", "userId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_feature_userId" ON "feature" ("userId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "feature" ADD CONSTRAINT "FK_502d51183cb036c2b2f39270648" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`ALTER TABLE "feature" REPLICA IDENTITY FULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "feature" REPLICA IDENTITY DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "feature" DROP CONSTRAINT "FK_502d51183cb036c2b2f39270648"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_feature_userId"`);
    await queryRunner.query(`DROP TABLE "feature"`);
  }
}
