import { MigrationInterface, QueryRunner } from 'typeorm';

export class ContentPreferenceUserStatusTypeIndex1730377577679
  implements MigrationInterface
{
  name = 'ContentPreferenceUserStatusTypeIndex1730377577679';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_669e1fba44617e2a2f3939deec" ON "content_preference" ("userId", "status", "type") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_669e1fba44617e2a2f3939deec"`,
    );
  }
}
