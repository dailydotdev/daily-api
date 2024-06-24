import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdvancedSettingsCopy1719227161827 implements MigrationInterface {
  name = 'AdvancedSettingsCopy1719227161827';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `update "public"."advanced_settings" set "description" = 'Posts selected and submitted by daily.dev community members, featuring engaging content from across the web.' where "title" = 'Community picks'`,
    );
    await queryRunner.query(
      `update "public"."advanced_settings" set "description" = 'Posts that explore similarities and differences between entities like libraries or tools to help you make informed decisions.' where "title" = 'Comparisons'`,
    );
    await queryRunner.query(
      `update "public"."advanced_settings" set "description" = 'Posts in list format, compiling and describing various third-party elements to provide an overview of a specific theme.' where "title" = 'Listicles'`,
    );
    await queryRunner.query(
      `update "public"."advanced_settings" set "description" = 'Posts with funny images, videos, or phrases reflecting cultural trends, serving as digital communication and entertainment.' where "title" = 'Memes'`,
    );
    await queryRunner.query(
      `update "public"."advanced_settings" set "description" = 'Reports and updates on important events and breakthroughs in the tech industry, keeping you current with the latest developments.' where "title" = 'News'`,
    );
    await queryRunner.query(
      `update "public"."advanced_settings" set "description" = 'Posts expressing personal views, interpretations, or predictions on various topics, representing the author''s perspective.' where "title" = 'Opinions'`,
    );
    await queryRunner.query(
      `update "public"."advanced_settings" set "description" = 'Announcements or coverage of new versions or features of products, libraries, or tools, highlighting what''s new or improved.' where "title" = 'Release'`,
    );
    await queryRunner.query(
      `update "public"."advanced_settings" set "description" = 'Non-time-sensitive posts offering detailed insights and viewpoints on certain events or topics.' where "title" = 'Stories'`,
    );
    await queryRunner.query(
      `update "public"."advanced_settings" set "description" = 'Step-by-step guides focusing on specific skills or topics, designed to educate and help you replicate processes or techniques.' where "title" = 'Tutorials'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `update "public"."advanced_settings" set "description" = 'Posts specifically selected and submitted by daily.dev community members. These encompass a variety of content from across the web that has engaged our community.' where "title" = 'Community picks'`,
    );
    await queryRunner.query(
      `update "public"."advanced_settings" set "description" = 'Posts that discuss the similarities and differences between two or more entities such as libraries or tools. These comparisons aim to clarify and help you make informed decisions or gain a better understanding of the entities involved.' where "title" = 'Comparisons'`,
    );
    await queryRunner.query(
      `update "public"."advanced_settings" set "description" = 'Posts formatted as lists. These posts normally compile and describe different third-party elements, including people, objects, links or events. Each piece is curated to provide an overview of a specific theme or topic.' where "title" = 'Listicles'`,
    );
    await queryRunner.query(
      `update "public"."advanced_settings" set "description" = 'Posts consisting of funny images, videos, or phrases that capture societal moments. These usually reflect cultural trends and ideas, evolving through user-generated modifications. Memes serve as a form of digital communication and entertainment.' where "title" = 'Memes'`,
    );
    await queryRunner.query(
      `update "public"."advanced_settings" set "description" = 'Immediate reports and updates on important events, progress, and breakthroughs in the tech industry. This category helps you stay current with the latest in the developer world.' where "title" = 'News'`,
    );
    await queryRunner.query(
      `update "public"."advanced_settings" set "description" = 'Posts expressing personal views, interpretations, or predictions on various topics. These posts represent the author''s perspective and can span a wide range of subjects and viewpoints.' where "title" = 'Opinions'`,
    );
    await queryRunner.query(
      `update "public"."advanced_settings" set "description" = 'Announcements or coverage of new versions or features of a product, library, or tool. These posts offer an overview of what''s new or what''s improved in a specific product.' where "title" = 'Release'`,
    );
    await queryRunner.query(
      `update "public"."advanced_settings" set "description" = 'Non-time sensitive posts providing information about certain events. These pieces delve into a topic or event, offering a point of view rather than just reporting the latest news.' where "title" = 'Stories'`,
    );
    await queryRunner.query(
      `update "public"."advanced_settings" set "description" = 'Guides that present step-by-step instructions focusing on a specific skill or topic. These posts aim to educate and guide you through a process or technique, ensuring you understand and can replicate it.' where "title" = 'Tutorials'`,
    );
  }
}
