import { MigrationInterface, QueryRunner } from 'typeorm';

export class ContentPreferencePKType1731044639557
  implements MigrationInterface
{
  name = 'ContentPreferencePKType1731044639557';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "content_preference" DROP CONSTRAINT "PK_3f50987656b7555fa8195d6f05b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "content_preference" ADD CONSTRAINT "PK_846a533ad3da996c916074b773a" PRIMARY KEY ("referenceId", "userId", "type")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "content_preference" DROP CONSTRAINT "PK_846a533ad3da996c916074b773a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "content_preference" ADD CONSTRAINT "PK_3f50987656b7555fa8195d6f05b" PRIMARY KEY ("referenceId", "userId")`,
    );
  }
}
