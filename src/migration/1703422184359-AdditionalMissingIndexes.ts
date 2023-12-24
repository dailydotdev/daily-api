import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdditionalMissingIndexes1703422184359
  implements MigrationInterface
{
  name = 'AdditionalMissingIndexes1703422184359';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_source_member_userId_role" ON "source_member" ("userId", "role") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_source_type_id" ON "source" ("type", "id") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_source_type_id"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_source_member_userId_role"`,
    );
  }
}
