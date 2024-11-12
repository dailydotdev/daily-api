import { MigrationInterface, QueryRunner } from 'typeorm';

export class ContentPreferencePKFml1731423979883 implements MigrationInterface {
  name = 'ContentPreferencePKFml1731423979883';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "content_preference" DROP CONSTRAINT "PK_846a533ad3da996c916074b773a"`,
    );

    await queryRunner.query(
      `ALTER TABLE "content_preference" ADD CONSTRAINT "PK_7ec8e467ae79953f96c11bf033a" PRIMARY KEY ("referenceId", "userId", "type", "feedId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "content_preference" DROP CONSTRAINT "PK_7ec8e467ae79953f96c11bf033a"`,
    );

    await queryRunner.query(
      `ALTER TABLE "content_preference" ADD CONSTRAINT "PK_846a533ad3da996c916074b773a" PRIMARY KEY ("referenceId", "userId", "type")`,
    );
  }
}
