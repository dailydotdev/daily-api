import { MigrationInterface, QueryRunner } from "typeorm";

export class KeywordFlags1697546410147 implements MigrationInterface {
    name = 'KeywordFlags1697546410147'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "keyword" ADD "flags" jsonb NOT NULL DEFAULT '{}'`);
        await queryRunner.query(`CREATE INDEX "IDX_keyword_flags_onboarding" ON post USING HASH (((flags->'onboarding')::boolean))`);
        const keywords = [
          'ai',
          'machine-learning',
          'security',
          'cloud',
          'tech-news',
          'tools',
          'database',
          'open-source',
          'javascript',
          'python',
          'mobile',
          'testing',
          'crypto',
          'devops',
          'webdev',
          'architecture',
          'java',
          'golang',
          'rust',
          '.net',
          'ruby',
          'elixir',
          'gaming',
          'data-science'
        ];
        await queryRunner.query(`UPDATE "keyword" SET "flags" = flags || '{"onboarding": true}' WHERE "value" IN (${keywords.map((item) => `'${item}'`).join(', ')})`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_keyword_flags_onboarding"`);
        await queryRunner.query(`ALTER TABLE "keyword" DROP COLUMN "flags"`);
    }

}
