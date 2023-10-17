import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInvitedByIdToFeature1697545231300
  implements MigrationInterface
{
  name = 'AddInvitedByIdToFeature1697545231300';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "feature" ADD "invitedById" character varying(36)`,
    );
    await queryRunner.query(
      `ALTER TABLE "feature" ADD CONSTRAINT "FK_a49f9325cc4a61812fa7da5449e" FOREIGN KEY ("invitedById") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "feature" DROP CONSTRAINT "FK_a49f9325cc4a61812fa7da5449e"`,
    );
    await queryRunner.query(`ALTER TABLE "feature" DROP COLUMN "invitedById"`);
  }
}
