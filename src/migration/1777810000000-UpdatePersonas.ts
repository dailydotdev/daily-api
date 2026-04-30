import type { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdatePersonas1777810000000 implements MigrationInterface {
  name = 'UpdatePersonas1777810000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DELETE FROM "persona"
      WHERE "id" IN ('ai-ml', 'data')
    `);

    await queryRunner.query(
      /* sql */ `
        INSERT INTO "persona" ("id", "title", "emoji", "tags", "sortOrder")
        VALUES
          ($1, 'Frontend Developer', '🌐',
           ARRAY['webdev','javascript','react','css','typescript','html','nextjs','tailwind-css','vuejs','angular','frontend','ui-design']::text[], 1),
          ($2, 'Backend Developer', '⚙️',
           ARRAY['python','java','golang','database','architecture','microservices','rest-api','graphql','docker','postgresql','redis','kafka']::text[], 2),
          ($3, 'AI Engineer', '🤖',
           ARRAY['ai','genai','llm','ai-agents','ai-coding','openai','chatgpt','bots','context-engineering','ai-inference','ai-gateway']::text[], 3),
          ($4, 'ML / Data Science', '🧠',
           ARRAY['machine-learning','deep-learning','data-science','nlp','computer-vision','neural-networks','pytorch','algorithms','math','data-analysis','data-visualization']::text[], 4),
          ($5, 'Data Engineering', '🛢️',
           ARRAY['data-engineering','database','big-data','sql','kafka','postgresql','mongodb','redis','mysql','apache','observability','logging']::text[], 5),
          ($6, 'DevOps / Cloud', '☁️',
           ARRAY['devops','cloud','aws','docker','kubernetes','cicd','terraform','linux','containers','infrastructure','monitoring','serverless','github-actions']::text[], 6),
          ($7, 'Mobile Developer', '📱',
           ARRAY['mobile','react-native','swift','android','ios','flutter','kotlin','iphone','firebase','app-store']::text[], 7),
          ($8, 'Security / Cyber', '🔒',
           ARRAY['security','cyber','data-privacy','encryption','malware','phishing','ransomware','vulnerability','compliance','appsec','cryptography']::text[], 8),
          ($9, 'Game Developer', '🎮',
           ARRAY['gaming','game-development','unity','unreal-engine','game-design','3d','blender','c++','vr','c#']::text[], 9),
          ($10, 'Tech Lead / Startup', '🚀',
           ARRAY['startup','tech-news','leadership','architecture','open-source','career','agile','product-management','venture-capital','business','tools']::text[], 10),
          ($11, 'Systems Programmer', '🦀',
           ARRAY['rust','c','c++','linux','golang','performance','hardware','computing','webassembly','algorithms']::text[], 11)
        ON CONFLICT ("id") DO UPDATE
        SET
          "title" = EXCLUDED."title",
          "emoji" = EXCLUDED."emoji",
          "tags" = EXCLUDED."tags",
          "sortOrder" = EXCLUDED."sortOrder",
          "updatedAt" = now()
      `,
      [
        'frontend',
        'backend',
        'ai',
        'ml-ds',
        'data-eng',
        'devops',
        'mobile',
        'security',
        'gamedev',
        'lead',
        'systems',
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DELETE FROM "persona"
      WHERE "id" IN ('ai', 'ml-ds', 'data-eng')
    `);

    await queryRunner.query(
      /* sql */ `
        INSERT INTO "persona" ("id", "title", "emoji", "tags", "sortOrder")
        VALUES
          ($1, 'Frontend Developer', '🌐',
           ARRAY['webdev','javascript','react','css','typescript','html','nextjs','tailwind-css','vuejs','angular','frontend','ui-design']::text[], 1),
          ($2, 'Backend Developer', '⚙️',
           ARRAY['python','java','golang','database','architecture','microservices','rest-api','graphql','docker','postgresql','redis','kafka']::text[], 2),
          ($3, 'AI/ML Engineer', '🤖',
           ARRAY['ai','machine-learning','python','data-science','deep-learning','nlp','pytorch','genai','llm','computer-vision','neural-networks','ai-agents']::text[], 3),
          ($4, 'DevOps / Cloud', '☁️',
           ARRAY['devops','cloud','aws','docker','kubernetes','cicd','terraform','linux','containers','infrastructure','monitoring','serverless','github-actions']::text[], 4),
          ($5, 'Mobile Developer', '📱',
           ARRAY['mobile','react-native','swift','android','ios','flutter','kotlin','iphone','firebase','app-store']::text[], 5),
          ($6, 'Security / Cyber', '🔒',
           ARRAY['security','cyber','data-privacy','encryption','malware','phishing','ransomware','vulnerability','compliance','appsec','cryptography']::text[], 6),
          ($7, 'Game Developer', '🎮',
           ARRAY['gaming','game-development','unity','unreal-engine','game-design','3d','blender','c++','vr','c#']::text[], 7),
          ($8, 'Data Engineer', '📊',
           ARRAY['data-science','python','data-analysis','data-visualization','big-data','database','data-engineering','machine-learning','algorithms','math','pytorch']::text[], 8),
          ($9, 'Tech Lead / Startup', '🚀',
           ARRAY['startup','tech-news','leadership','architecture','open-source','career','agile','product-management','venture-capital','business','tools']::text[], 9),
          ($10, 'Systems Programmer', '🦀',
           ARRAY['rust','c','c++','linux','golang','performance','hardware','computing','webassembly','algorithms']::text[], 10)
        ON CONFLICT ("id") DO UPDATE
        SET
          "title" = EXCLUDED."title",
          "emoji" = EXCLUDED."emoji",
          "tags" = EXCLUDED."tags",
          "sortOrder" = EXCLUDED."sortOrder",
          "updatedAt" = now()
      `,
      [
        'frontend',
        'backend',
        'ai-ml',
        'devops',
        'mobile',
        'security',
        'gamedev',
        'data',
        'lead',
        'systems',
      ],
    );
  }
}
