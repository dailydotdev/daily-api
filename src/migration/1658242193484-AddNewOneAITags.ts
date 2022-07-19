import {MigrationInterface, QueryRunner} from "typeorm";

export class AddNewOneAITags1658242193484 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('application', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('company', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('app', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('system', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('api', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('work', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('development', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('software', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('services', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('product', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('case', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('post', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('apps', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('network', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('website', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('error', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('design', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('image', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('dataset', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('test', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('programming', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('images', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('developer', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('language', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('free', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('experience', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('resources', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('change', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('node', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('training', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('environment', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('market', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('customer', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('learning', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('questions', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('methods', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('video', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('production', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('organization', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('devices', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('management', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('space', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('latest', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('framework', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('index', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('search', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('variables', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('news', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('control', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('implementation', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('json', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('job', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('cluster', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('game', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('success', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('operations', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('life', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('libraries', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('unsplash', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('analysis', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('-1', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('update', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('template', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('digital', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('self', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('games', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('documentation', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('updates', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('home', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('online', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('dependencies', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('employees', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('help', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('metrics', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('techcrunch', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('internet', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('analytics', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('software-development', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('working', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('stack', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('money', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('launch', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('risk', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('students', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('coding', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('phone', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('vector', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('guide', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('remote', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('install', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('integration', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('feedback', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('pipeline', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('commands', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('create-react-app', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('connection', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('block', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('jobs', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('programming-languages', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('youtube', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('modules', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('clients', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('servers', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('query', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('knowledge', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('animation', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('graph', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('colors', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('workflow', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('plugins', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('terminal', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('videos', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('distribution', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('engineering', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('health', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('extension', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('pandemic', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('government', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('logic', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('virtual', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('articles', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('live', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('traffic', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('token', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('edge', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('podcast', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('industry', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('stream', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('impact', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('validation', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('flow', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('cache', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('music', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('audio', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('ceo', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('matrix', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('media', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('challenge', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('paper', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('logrocket', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('consumer', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('processing', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('communication', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('manager', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('art', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('speed', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('grid', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('focus', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('forms', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('login', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('ideas', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('dashboard', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('social', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('designer', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('dev', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('loop', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('concept', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('office', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('property', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('desktop', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('founders', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('async', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('predictions', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('partners', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('books', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('setup', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('patterns', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('deal', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('commit', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('streaming', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('navigation', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('review', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('tips', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('chat', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('quality', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('arrays', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('ip', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('bugs', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('stories', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('beta', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('building', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('credit', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('identity', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('newsletter', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('subscription', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('queue', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('covid-19', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('tweet', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('export', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('https', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('financial', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('artist', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('sdk', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('source-code', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('router', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('tokens', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('food', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('eu', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('women', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('practice', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('culture', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('board', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('migration', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('complexity', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('maps', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('optimization', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('progress', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('metadata', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('failure', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('education', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('medium', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('payments', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('university', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('operators', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('mind', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('download', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('releases', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('regression', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('cloud-storage', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('installation', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('best-practices', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('error-handling', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('collaboration', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('copy', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('passwords', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('portfolio', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('policy', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('notifications', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('charts', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('cookies', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('interactive', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('lists', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('cities', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('modeling', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('coronavirus', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('usestate', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('use-cases', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('photos', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('venture', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('exchange', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('notes', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('keyboard', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('asynchronous', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('visualization', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('experiment', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('saas', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('infoq', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('fix', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('writing', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('software-engineering', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('creators', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('interfaces', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('repositories', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('themes', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('financial-services', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('attention', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('brain', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('app-development', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('threads', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('threatpost', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('engineer', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('excel', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('switch', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('vision', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('messaging', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('trends', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('study', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('secrets', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('pdf', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('retail', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('deploy', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('intelligence', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('csv', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('filters', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('sec', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('purpose', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('movies', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('notebook', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('competition', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('earth', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('tracking', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('authors', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('bank', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('debugging', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('canvas', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('trees', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('xml', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('upgrade', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('ecosystem', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('transformation', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('beginner', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('fonts', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('water', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('cnn', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('routing', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('computers', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('simulation', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('basics', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('medical', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('reddit', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('whatsapp', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('meta', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('backup', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('speakers', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('variance', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('domains', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('professional', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('history', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('energy', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('blogger', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('middleware', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('europe', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('clustering', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('beginners', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('graphics', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('search-engines', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('relationships', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('proxy', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('partnership', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('hard-work', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('s3-bucket', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('state-management', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('prototype', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('travel', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('fraud', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('recommendations', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('top-10', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('delivery', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('yaml', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('weather', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('translation', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('shopping', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('ec2-instance', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('trump', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('kids', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('laptop', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('airbnb', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('reading', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('mapping', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('running', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('codepen', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('hosting', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('webinar', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('planning', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('benchmark', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('kaggle', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('insurance', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('improvement', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('adoption', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('protection', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('writer', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('safety', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('college', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('certification', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('data-center', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('coffee', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('ipad', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('equity', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('app-developer', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('family', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('apple-watch', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('workshop', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('film', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('tls', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('promises', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('efficiency', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('income', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('diversity', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('vpc', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('full-stack', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('mistakes', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('cameras', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('love', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('useeffect', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('reporting', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('fetch', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('connectivity', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('kdnuggets', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('comparison', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('lifecycle', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('learn', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('rich', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('concurrency', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('annotations', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('logo', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('budget', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('javascript-frameworks', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('allscripts', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('product-owner', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('corporate', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('software-engineer', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('freecodecamp', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('pandas-dataframe', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('truth', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('os', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('ios-13', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('iam', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('product-development', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('dark-mode', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('solid', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('theory', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('followers', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('first-post', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('mock', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('programmer', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('sleep', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('workplace', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('trade', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('virus', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('thoughts', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('release-notes', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('profit', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('conversations', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('teams', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('sass', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('wikipedia', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('cloud-migration', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('race', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('sms', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('carbon', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('gui', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('climate-change', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('expo', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('governance', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('regex', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('editing', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('make-money', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('mvc', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('rewards', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('abstract', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('universe', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('case-study', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('for-loop', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('flexbox', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('sorting', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('ssl', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('forecasting', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('wallet', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('restful-api', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('perspective', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('decision-making', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('product-management', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('graphic-design', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('observation', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('battery', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('currency', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('restaurant', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('html-css', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('shortcuts', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('verification', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('java™', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('microsoft-teams', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('entrepreneur', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('auth', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('listing', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('object-oriented', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('extra-crunch', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('transportation', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('nature', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('earnings', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('python-developers', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('un', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('death', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('public-health', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('fire', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('evolution', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('contracts', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('compose', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('tc', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('enterprise-software', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('ford', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('banks', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('inheritance', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('defense', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('wireless', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('summary', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('compression', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('war', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('transitions', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('credit-cards', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('fitness', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('publishing', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('gmail', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('arm', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('schools', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('pos', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('sports', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('tricks', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('closure', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('hello-world', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('android-developers', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('webpage', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('stress', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('inspiration', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('enum', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('stack-overflow', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('discount', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('construction', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('video-conferencing', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('crisis', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('emissions', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('pop', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('quotes', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('scrum-master', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('creativity', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('real-estate', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('email-marketing', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('fear', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('mvp', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('risk-management', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('ios-apps', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('google-sheets', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('emoji', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('scalability', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('pro', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('http-request', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('refactoring', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('metal', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('recipe', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('choices', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('pain', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('salary', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('mars', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('stocks', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('google-maps', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('the-new-stack', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('commission', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('hospital', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('scaling', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('word', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('entertainment', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('the-app-store', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('tnw', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('offers', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('application-development', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('filesystem', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('teachers', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('customer-experience', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('scheduling', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('walmart', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('publication', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('web-server', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('freedom', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('accelerator', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('cancer', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('decimal', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('opinion', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('bug-bounty', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('mobile-phone', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('fbi', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('surveillance', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('software-developer', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('puzzle', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('climate', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('techcrunch+', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('caching', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('front-end-developer', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('cats', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('m1', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('boss', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('hashnode', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('discovery', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('blogging', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('visa', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('habits', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('advantages', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('data-driven', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('messenger', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('minimum-viable-product', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('logistics', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('scripting', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('anonymous', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('gm', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('passion', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('cto', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('headphones', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('pair-programming', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('pixabay', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('macbook-pro', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('covid', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('epic', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('ea', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('dataframes', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('misinformation', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('cisa', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('content-marketing', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('reuters', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('makers', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('hotel', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('product-design', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('dogs', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('onboarding', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('animals', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('configuration-management', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('fashion', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('solarwinds', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('tips-and-tricks', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('frontend-development', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('trading', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('3d-printing', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('drones', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('ajax', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('crud', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('swap', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('canonical', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('coroutine', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('shipping', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('forecast', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('gold', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('economy', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('scam', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('next', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('codecanyon', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('doctors', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('pc', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('disney+', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('emotions', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('cover', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('office-365', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('ge', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('oop', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('polygon', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('scopes', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('android-app-development', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('automotive', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('ios-app-development', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('anchor', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('pexels', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('gartner', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('prototyping', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('labor', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('responsive-web-design', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('labs', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('dropbox', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('clubhouse', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('hashing', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('dash', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('congress', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('electricity', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('smashing', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('lambda-function', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('ui', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('3d', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('ab-testing', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('accessibility', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('acquisition', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('active-directory', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('apache-activemq', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('adobe', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('adonisjs', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('advertising', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('agile', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('ai', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('aiops', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('apache-airflow', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('akka', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('alexa', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('algolia', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('algorithms', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('alibaba', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('alibaba-cloud', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('alpinejs', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('amazon', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('aws-s3', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('aws', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('amd', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('android', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('android-studio', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('angular', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('ansible', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('apache', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('apache-camel', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('apache-cassandra', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('apache-flink', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('apache-hadoop', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('apache-kafka', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('apache-spark', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('api-gateway', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('apollo', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('app-store', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('apple', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('appsec', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('appwrite', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('ar', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('arangodb', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('architecture', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('aspnet', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('atlassian', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('audit', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('aurora', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('auth0', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('authentication', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('authorization', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('automation', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('testing', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('automl', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('aws-ec2', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('aws-iam', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('aws-lambda', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('axios', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('azure', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('azure-devops', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('azure-functions', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('babel', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('backend', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('ballerina', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('banking', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('bash', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('bazel', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('bert', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('big-data', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('big-tech', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('google-bigquery', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('binary-search', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('binary-tree', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('bitbucket', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('bitcoin', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('blazor', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('blender', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('blockchain', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('bluetooth', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('bootcamp', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('bootstrap', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('bots', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('browsers', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('bi', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('c', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('career', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('chef', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('google-chrome', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('chromium', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('cicd', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('circleci', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('cisco', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('classification', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('cli', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('clickhouse', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('clojure', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('cloud', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('gcp-cloud-functions', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('security', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('cloudflare', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('aws-cloudformation', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('aws-cloudwatch', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('cms', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('cncf', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('cockroachdb', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('code-review', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('coinbase', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('community', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('compliance', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('computer-science', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('computer-vision', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('computing', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('conference', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('confluent', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('confluent-cloud', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('containers', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('couchbase', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('course', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('c++', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('crawling', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('crm', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('crypto', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('cryptography', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('c#', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('css', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('cuda', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('customer-service', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('cyber', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('cypress', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('dailydev', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('dart', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('data-analysis', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('data-breach', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('data-engineering', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('data-lake', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('data-management', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('data-processing', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('data-protection', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('data-quality', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('data-science', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('data-structures', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('data-visualization', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('data-warehouse', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('database', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('databricks', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('debezium', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('decentralized', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('decision-tree', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('deep-learning', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('defi', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('deno', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('dependency-injection', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('design-patterns', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('design-systems', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('devrel', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('devops', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('devsecops', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('devtools', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('digital-transformation', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('digitalocean', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('discord', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('disney', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('django', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('dns', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('docker', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('docker-compose', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('docker-swarm', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('dom', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('.net', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('.net-core', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('dynamic-programming', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('aws-dynamodb', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('ecommerce', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('edge-computing', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('edtech', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('elk', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('electron', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('elixir', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('elm', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('embedded', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('emberjs', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('encryption', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('enterprise', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('entrepreneurship', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('envoy', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('erlang', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('erp', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('javascript', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('ethereum', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('ethics', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('etl', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('exploratory-data-analysis', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('express', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('facebook', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('facial-recognition', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('fastapi', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('fastify', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('faunadb', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('feature-engineering', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('figma', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('finance', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('fintech', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('firebase', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('firefox', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('firestore', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('flask', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('flutter', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('flux', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('fraud-detection', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('freedos', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('frontend', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('functional-programming', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('venture-capital', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('future', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('future-of-work', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('game-development', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('gaming', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('gatsby', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('gcp', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('gdpr', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('gem', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('gis', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('git', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('github', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('github-actions', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('github-pages', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('gitlab', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('gitlab-ci', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('gitops', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('gke', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('golang', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('godot', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('google', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('google-analytics', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('google-assistant', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('google-drive', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('google-play', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('gpu', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('gradient-descent', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('gradle', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('grafana', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('graphql', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('grpc', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('hackathon', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('hacktoberfest', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('hardware', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('harperdb', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('hashicorp', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('haskell', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('healthcare', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('helm', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('heroku', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('hive', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('react-hooks', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('hotwire', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('hr', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('html', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('huawei', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('hybrid-cloud', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('ibm', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('ibm-cloud', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('image-processing', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('influxdb', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('infrastructure', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('iac', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('instagram', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('intel', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('iot', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('internship', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('interview', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('interview-questions', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('investing', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('ionic', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('ios', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('iphone', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('ipo', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('istio', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('jamstack', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('java', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('jdk', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('jenkins', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('jest', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('jetbrains', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('jetpack-compose', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('jira', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('jquery', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('jsx', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('julia', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('jupyter', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('jvm', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('jwt', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('unsupervised-learning', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('kubernetes', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('kafka', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('kaspersky', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('keras', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('kerberos', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('kotlin', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('ktor', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('laravel', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('law', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('leadership', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('legal', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('lightbend', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('lighthouse', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('linear-regression', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('linkedin', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('linux', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('lisp', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('load-testing', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('localization', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('logging', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('logistic-regression', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('nocode', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('lstm', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('lua', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('lyft', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('mac', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('machine-learning', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('malware', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('manufacturing', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('markdown', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('marketing', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('math', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('matplotlib', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('maven', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('mental-health', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('metaverse', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('microservices', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('microsoft', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('microsoft-edge', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('mit', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('mlops', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('mnist', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('mobile', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('mobility', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('mongodb', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('mongoose', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('monitoring', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('monolith', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('mozilla', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('mulesoft', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('multi-cloud', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('mysql', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('nasa', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('nativescript', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('nlp', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('neo4j', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('nestjs', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('netflix', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('netlify', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('networking', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('neural-networks', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('nextjs', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('nft', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('nginx', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('nintendo', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('nodejs', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('nosql', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('notion', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('npm', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('nuget', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('numpy', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('nvidia', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('oauth', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('object-detection', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('observability', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('okta', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('open-api', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('open-source', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('openai', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('openapi', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('opencv', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('openshift', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('oracle', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('orchestration', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('overfitting', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('pandas', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('paypal', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('performance', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('perl', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('phishing', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('photoshop', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('php', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('physics', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('pinterest', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('pip', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('plotly', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('postgresql', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('postman', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('powershell', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('preact', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('predictive-analytics', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('prisma', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('privacy', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('statistics', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('startup', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('productivity', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('project-management', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('prometheus', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('public-cloud', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('pulumi', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('puppet', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('pwa', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('pyspark', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('python', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('pytorch', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('qa', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('quantum-computing', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('quarkus', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('r', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('rabbitmq', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('rails', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('random-forest', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('ransomware', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('raspberry-pi', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('ravendb', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('aws-rds', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('react', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('react-native', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('react-query', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('react-router', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('reactive-programming', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('recursion', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('red-hat', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('redis', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('redshift', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('redux', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('regulation', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('reinforcement-learning', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('remote-work', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('ui-design', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('rest-api', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('revenue', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('robotics', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('rstudio', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('ruby', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('rust', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('rxjs', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('safari', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('aws-sagemaker', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('sales', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('salesforce', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('samsung', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('sap', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('scala', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('science', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('scikit', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('scrum', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('segmentation', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('selenium', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('autonomous-cars', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('sensors', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('sentiment-analysis', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('seo', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('serverless', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('service-mesh', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('sharepoint', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('shell', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('shopify', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('sinatra', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('sklearn', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('slack', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('smart-contracts', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('snap', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('snowflake', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('social-media', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('softbank', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('sony', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('spacex', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('spark', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('speech-recognition', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('spotify', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('spring', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('spring-boot', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('spring-security', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('sql', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('microsoft-sql-server', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('sqlite', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('sre', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('ssh', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('steam', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('storage', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('storybook', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('stripe', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('styled-components', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('supabase', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('supply-chain', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('sustainability', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('svelte', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('svg', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('swift', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('swiftui', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('symfony', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('tableau', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('tailwind-css', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('tdd', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('tech', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('technical-debt', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('telegram', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('tensorflow', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('terraform', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('tesla', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('tiktok', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('time-complexity', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('time-series-forecasting', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('tools', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('transfer-learning', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('transformers', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('tutorial', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('twilio', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('twitch', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('twitter', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('typescript', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('uber', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('ubuntu', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('unity', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('unix', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('unreal-engine', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('ux', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('v8', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('vb', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('vercel', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('version-control', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('vim', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('virtual-machine', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('vr', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('visual-studio', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('vscode', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('vite', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('vmware', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('vpn', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('vuejs', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('vuex', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('vulnerability', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('web-components', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('webdev', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('web3', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('webassembly', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('webpack', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('webrtc', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('websocket', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('windows', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('winui', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('woocommerce', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('wordpress', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('work-life-balance', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('xamarin', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('xbox', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('xcode', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('xgboost', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('yarn', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('zoom', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('firmware', 'pending') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );

        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('a-b-testing','synonym', 'ab-testing') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('activemq','synonym', 'apache-activemq') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('agile-development','synonym', 'agile') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('airflow','synonym', 'apache-airflow') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('alpine','synonym', 'alpinejs') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('amazon-s3','synonym', 'aws-s3') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('amazon-web-services','synonym', 'aws') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('android-apps','synonym', 'android') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('angularjs','synonym', 'angular') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('apollo-client','synonym', 'apollo') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('application-security','synonym', 'appsec') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('artificial-intelligence','synonym', 'ai') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('asp.net','synonym', 'aspnet') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('augmented-reality','synonym', 'ar') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('automation-testing','synonym', 'testing') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('azure-active-directory','synonym', 'active-directory') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('bigquery','synonym', 'google-bigquery') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('bot','synonym', 'bots') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('business-intelligence','synonym', 'bi') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('careers','synonym', 'career') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('cassandra','synonym', 'apache-cassandra') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('chatbot','synonym', 'bots') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('chatbots','synonym', 'bots') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('chrome','synonym', 'google-chrome') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('ci-cd-pipeline','synonym', 'cicd') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('classification-models','synonym', 'classification') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('clean-architecture','synonym', 'architecture') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('cloud-computing','synonym', 'cloud') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('cloud-functions','synonym', 'gcp-cloud-functions') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('cloud-native','synonym', 'cloud') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('cloud-security','synonym', 'security') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('cloud-services','synonym', 'cloud') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('cloudformation','synonym', 'aws-cloudformation') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('cloudwatch','synonym', 'aws-cloudwatch') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('command-line','synonym', 'cli') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('confluent','synonym', 'confluent-cloud') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('continuous-delivery','synonym', 'cicd') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('continuous-deployment','synonym', 'cicd') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('continuous-integration','synonym', 'cicd') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('conversational-ai','synonym', 'ai') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('cpp','synonym', 'c++') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('cpu','synonym', 'computing') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('cryptocurrency','synonym', 'crypto') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('cryptocurrency-exchange','synonym', 'crypto') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('csharp','synonym', 'c#') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('cybersecurity','synonym', 'cyber') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('daily.dev','synonym', 'dailydev') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('data-analytics','synonym', 'data-analysis') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('data-scientist','synonym', 'data-science') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('deployment','synonym', 'cicd') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('developer-relations','synonym', 'devrel') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('docker-image','synonym', 'docker') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('dotnet','synonym', '.net') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('dotnet-5','synonym', '.net') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('dotnet-6','synonym', '.net') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('dotnet-core','synonym', '.net-core') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('dynamodb','synonym', 'aws-dynamodb') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('ec2','synonym', 'aws-ec2') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('elastic','synonym', 'elk') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('elasticsearch','synonym', 'elk') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('embedded-systems','synonym', 'embedded') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('ember','synonym', 'emberjs') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('es6','synonym', 'javascript') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('event-driven-architecture','synonym', 'architecture') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('fauna','synonym', 'faunadb') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('flink','synonym', 'apache-flink') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('front-end-development','synonym', 'frontend') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('funding','synonym', 'venture-capital') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('fundraising','synonym', 'venture-capital') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('go','synonym', 'golang') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('google-cloud','synonym', 'gcp') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('google-cloud-platform','synonym', 'gcp') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('hacker','synonym', 'security') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('hacking','synonym', 'security') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('hadoop','synonym', 'apache-hadoop') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('hooks','synonym', 'react-hooks') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('html5','synonym', 'html') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('image-classification','synonym', 'computer-vision') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('image-recognition','synonym', 'computer-vision') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('influxdb-enterprise','synonym', 'influxdb') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('infrastructure-as-code','synonym', 'iac') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('internet-of-things','synonym', 'iot') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('investment','synonym', 'venture-capital') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('investors','synonym', 'venture-capital') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('js','synonym', 'javascript') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('jupyter-notebook','synonym', 'jupyter') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('k-means-clustering','synonym', 'unsupervised-learning') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('k8s','synonym', 'kubernetes') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('kibana','synonym', 'elk') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('kubernetes-cluster','synonym', 'kubernetes') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('lambda','synonym', 'aws-lambda') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('low-code','synonym', 'nocode') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('macos','synonym', 'mac') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('mathematics','synonym', 'math') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('microsoft-azure','synonym', 'azure') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('ml','synonym', 'machine-learning') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('mobile-app','synonym', 'mobile') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('mobile-app-development','synonym', 'mobile') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('mobile-apps','synonym', 'mobile') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('mobile-development','synonym', 'mobile') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('natural-language','synonym', 'nlp') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('nfts','synonym', 'nft') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('no-code','synonym', 'nocode') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('nosql-database','synonym', 'nosql') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('open-source-software','synonym', 'open-source') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('postgres','synonym', 'postgresql') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('prisma client','synonym', 'prisma') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('probability','synonym', 'statistics') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('product-market-fit','synonym', 'startup') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('python-programming','synonym', 'python') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('python3','synonym', 'python') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('quantum','synonym', 'quantum-computing') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('rds','synonym', 'aws-rds') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('react-hook','synonym', 'react-hooks') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('reactjs','synonym', 'react') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('redux-thunk','synonym', 'redux') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('remote-working','synonym', 'remote-work') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('responsive-design','synonym', 'ui-design') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('rest','synonym', 'rest-api') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('resume','synonym', 'career') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('robots','synonym', 'robotics') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('ruby-on-rails','synonym', 'rails') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('s3','synonym', 'aws-s3') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('sagemaker','synonym', 'aws-sagemaker') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('scikit-learn','synonym', 'scikit') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('selenium-webdriver','synonym', 'selenium') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('self-driving-cars','synonym', 'autonomous-cars') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('silicon-valley','synonym', 'startup') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('snapchat','synonym', 'snap') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('software-architecture','synonym', 'architecture') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('software-testing','synonym', 'testing') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('spac','synonym', 'ipo') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('sql-server','synonym', 'microsoft-sql-server') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('startups','synonym', 'startup') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('stock-market','synonym', 'investing') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('swagger','synonym', 'openapi') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('tailwind','synonym', 'tailwind-css') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('technical-interview','synonym', 'interview-questions') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('test-automation','synonym', 'testing') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('test-driven-development','synonym', 'tdd') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('the-pulumi-service','synonym', 'pulumi') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('two-factor-authentication','synonym', 'authentication') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('ubuntu-20-04','synonym', 'ubuntu') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('unit-testing','synonym', 'testing') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('user-experience','synonym', 'ux') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('ux-design','synonym', 'ux') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('vba','synonym', 'vb') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('vc','synonym', 'venture-capital') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('virtual-reality','synonym', 'vr') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('visual-basic','synonym', 'vb') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('visual-design','synonym', 'ui-design') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('visual-studio-2019','synonym', 'visual-studio') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('visual-studio-2022','synonym', 'visual-studio') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('visual-studio-code','synonym', 'vscode') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('vs-code','synonym', 'vscode') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('vue','synonym', 'vuejs') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('vue-3','synonym', 'vuejs') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('web-design','synonym', 'ui-design') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('web-developer','synonym', 'webdev') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('web-development','synonym', 'webdev') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('web-scraping','synonym', 'crawling') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('windows-10','synonym', 'windows') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('windows-11','synonym', 'windows') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('wordpress-plugins','synonym', 'wordpress') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('wordpress-themes','synonym', 'wordpress') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('wordpress-website','synonym', 'wordpress') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('work-from-home','synonym', 'remote-work') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synomym") VALUES ('working-from-home','synonym', 'remote-work') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}
