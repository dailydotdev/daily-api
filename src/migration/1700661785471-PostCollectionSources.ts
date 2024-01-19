import { MigrationInterface, QueryRunner } from "typeorm";

export class PostCollectionSources1700661785471 implements MigrationInterface {
    name = 'PostCollectionSources1700661785471'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "post" ADD "collectionSources" text array DEFAULT '{}'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "collectionSources"`);
    }

}
