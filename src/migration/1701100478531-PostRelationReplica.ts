import { MigrationInterface, QueryRunner } from "typeorm";

export class PostRelationReplica1701100478531 implements MigrationInterface {
    name = 'PostRelationReplica1701100478531'

    public async up(queryRunner: QueryRunner): Promise<void> {
      await queryRunner.query(
        `ALTER TABLE "post_relation" REPLICA IDENTITY FULL`,
      );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
      await queryRunner.query(
        `ALTER TABLE "post_relation" REPLICA IDENTITY DEFAULT`,
      );
    }

}
