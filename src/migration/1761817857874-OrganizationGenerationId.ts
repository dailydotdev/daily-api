import { MigrationInterface, QueryRunner } from 'typeorm';

export class OrganizationGenerationId1761817857874
  implements MigrationInterface
{
  name = 'OrganizationGenerationId.ts1761817857874';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "organization" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "organization" ALTER COLUMN "id" SET DEFAULT NULL`,
    );
  }
}
