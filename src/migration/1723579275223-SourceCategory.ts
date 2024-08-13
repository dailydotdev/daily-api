import { MigrationInterface, QueryRunner } from 'typeorm';

export class SourceCategory1723579275223 implements MigrationInterface {
  name = 'SourceCategory1723579275223';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "source_category" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" text NOT NULL, "enabled" boolean NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_66d6dccf282b8104ef9c44c0fb5" UNIQUE ("title"), CONSTRAINT "PK_21e4d5359f2a23fd10053f516e9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`ALTER TABLE "source" ADD "categoryId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "source" ADD CONSTRAINT "FK_02e1cbb6e33fa90e68dd56de2a9" FOREIGN KEY ("categoryId") REFERENCES "source_category"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`
      INSERT INTO "source_category"
      (title, enabled)
      VALUES
      ('General', true),
      ('Web', true),
      ('Mobile', true),
      ('Games', true),
      ('DevOps', true),
      ('Cloud', true),
      ('Career', true),
      ('Data', true),
      ('Fun', true),
      ('DevTools', true)
      ON CONFLICT DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`TRUNCATE "source_category"`);
    await queryRunner.query(
      `ALTER TABLE "source" DROP CONSTRAINT "FK_02e1cbb6e33fa90e68dd56de2a9"`,
    );
    await queryRunner.query(`ALTER TABLE "source" DROP COLUMN "categoryId"`);
    await queryRunner.query(`DROP TABLE "source_category"`);
  }
}
