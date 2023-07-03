import { MigrationInterface, QueryRunner } from "typeorm";

export class PostFlagsSync1688029905946 implements MigrationInterface {
    name = 'PostFlagsSync1688029905946'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('UPDATE post SET flags = jsonb_set(flags, \'{sentAnalyticsReport}\', \'true\'::jsonb) WHERE "sentAnalyticsReport" = TRUE')
        await queryRunner.query('UPDATE post SET flags = jsonb_set(flags, \'{sentAnalyticsReport}\', \'false\'::jsonb) WHERE "sentAnalyticsReport" = FALSE')

        await queryRunner.query('UPDATE post SET flags = jsonb_set(flags, \'{banned}\', \'true\'::jsonb) WHERE "banned" = TRUE')
        await queryRunner.query('UPDATE post SET flags = jsonb_set(flags, \'{banned}\', \'false\'::jsonb) WHERE "banned" = FALSE')

        await queryRunner.query('UPDATE post SET flags = jsonb_set(flags, \'{deleted}\', \'true\'::jsonb) WHERE "deleted" = TRUE')
        await queryRunner.query('UPDATE post SET flags = jsonb_set(flags, \'{deleted}\', \'false\'::jsonb) WHERE "deleted" = FALSE')

        await queryRunner.query('UPDATE post SET flags = jsonb_set(flags, \'{private}\', \'true\'::jsonb) WHERE "private" = TRUE')
        await queryRunner.query('UPDATE post SET flags = jsonb_set(flags, \'{private}\', \'false\'::jsonb) WHERE "private" = FALSE')

        await queryRunner.query('UPDATE post SET flags = jsonb_set(flags, \'{visible}\', \'true\'::jsonb) WHERE "visible" = TRUE')
        await queryRunner.query('UPDATE post SET flags = jsonb_set(flags, \'{visible}\', \'false\'::jsonb) WHERE "visible" = FALSE')

        await queryRunner.query('UPDATE post SET flags = jsonb_set(flags, \'{showOnFeed}\', \'true\'::jsonb) WHERE "showOnFeed" = TRUE')
        await queryRunner.query('UPDATE post SET flags = jsonb_set(flags, \'{showOnFeed}\', \'false\'::jsonb) WHERE "showOnFeed" = FALSE')
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('UPDATE post SET flags = \'{}\'')
    }

}
