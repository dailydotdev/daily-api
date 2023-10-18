import cron from '../../src/cron/updateTagRecommendations';
import { expectSuccessfulCron, saveFixtures } from '../helpers';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { ArticlePost, Keyword, PostKeyword, Source } from '../../src/entity';
import { postKeywordsFixture, postsFixture } from '../fixture/post';
import { TagRecommendation } from '../../src/entity/TagRecommendation';
import { sourcesFixture } from '../fixture/source';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

describe('updateTagRecommendations cron', () => {
  beforeEach(async () => {
    jest.resetAllMocks();

    const materializedViewName =
      con.getRepository(TagRecommendation).metadata.tableName;
    await con.query(`REFRESH MATERIALIZED VIEW ${materializedViewName}`);

    await saveFixtures(con, Source, sourcesFixture);
    await saveFixtures(con, ArticlePost, postsFixture);
    const keywordsInPostsFixture = postsFixture.reduce((acc, item) => {
      const keywordsInPost = item.tagsStr?.split(',') || [];

      keywordsInPost.forEach((keyword) => {
        const keywordItem = acc.find((item) => item.value === keyword);

        if (!keywordItem) {
          acc.push({
            value: keyword,
            occurrences: 1,
            status: 'allow',
            createdAt: new Date(),
            updatedAt: new Date(),
            flags: {},
          });
        } else {
          keywordItem.occurrences += 1;
        }
      });

      return acc;
    }, [] as Keyword[]);
    await saveFixtures(
      con,
      Keyword,
      keywordsInPostsFixture.map((item) => ({
        ...item,
        status: 'allow',
      })),
    );
    await saveFixtures(
      con,
      PostKeyword,
      postKeywordsFixture.map((item) => ({
        ...item,
        status: 'allow',
      })),
    );
  });

  it('should update tag recommendations', async () => {
    let recommendationsCount = await con
      .getRepository(TagRecommendation)
      .count();
    expect(recommendationsCount).toBe(0);

    await expectSuccessfulCron(cron);

    recommendationsCount = await con.getRepository(TagRecommendation).count();
    expect(recommendationsCount).toBe(10);
  });
});
