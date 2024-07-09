import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdvancedSettingsCopy1720104393427 implements MigrationInterface {
  name = 'AdvancedSettingsCopy1720104393427';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `update "public"."advanced_settings" set "description" = 'Posts submitted by daily.dev community members from across the web.' where "title" = 'Community picks'`,
    );
    await queryRunner.query(
      `update "public"."advanced_settings" set "description" = 'Posts comparing libraries or tools to help you make decisions.' where "title" = 'Comparisons'`,
    );
    await queryRunner.query(
      `update "public"."advanced_settings" set "description" = 'Posts in list format compiling third-party elements for theme overviews.' where "title" = 'Listicles'`,
    );
    await queryRunner.query(
      `update "public"."advanced_settings" set "description" = 'Funny images, videos, or phrases reflecting cultural trends and entertainment.' where "title" = 'Memes'`,
    );
    await queryRunner.query(
      `update "public"."advanced_settings" set "description" = 'Reports on tech industry events and breakthroughs, keeping you updated.' where "title" = 'News'`,
    );
    await queryRunner.query(
      `update "public"."advanced_settings" set "description" = 'Posts expressing personal views or predictions on various topics.' where "title" = 'Opinions'`,
    );
    await queryRunner.query(
      `update "public"."advanced_settings" set "description" = 'Announcements of new versions or features of products or tools.', "title" = 'Releases' where "title" = 'Release'`,
    );
    await queryRunner.query(
      `update "public"."advanced_settings" set "description" = 'Evergreen posts offering detailed insights and viewpoints on various topics.' where "title" = 'Stories'`,
    );
    await queryRunner.query(
      `update "public"."advanced_settings" set "description" = 'Step-by-step guides to learn and teach specific skills or topics.' where "title" = 'Tutorials'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
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
}
