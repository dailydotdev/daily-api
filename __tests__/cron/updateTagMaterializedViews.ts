import cron from '../../src/cron/updateTagMaterializedViews';
import { expectSuccessfulCron, saveFixtures } from '../helpers';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import {
  ArticlePost,
  Keyword,
  PostKeyword,
  Source,
  User,
} from '../../src/entity';
import { postKeywordsFixture, postsFixture } from '../fixture/post';
import { sourcesFixture } from '../fixture/source';
import { postRecommendedKeywordsFixture } from '../fixture/keywords';
import { usersFixture } from '../fixture/user';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

describe('updateTagMaterializedViews cron', () => {
  beforeEach(async () => {
    jest.resetAllMocks();

    await saveFixtures(con, Source, sourcesFixture);
    await saveFixtures(con, User, usersFixture);
    await saveFixtures(
      con,
      ArticlePost,
      postsFixture.map((post) => {
        switch (post.id) {
          case 'p1':
            return { ...post, authorId: '1', upvotes: 2 };
          case 'p4':
            return { ...post, authorId: '1', upvotes: 3 };
          case 'p5':
            return { ...post, authorId: '2', upvotes: 10 };
          default:
            return post;
        }
      }),
    );
    await saveFixtures(
      con,
      Keyword,
      postRecommendedKeywordsFixture.map((item) => ({
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

  it('should refresh tag recommendations and the source/user tag similarity views', async () => {
    await expectSuccessfulCron(cron);

    expect(
      await con.query(
        `SELECT count FROM source_tag_view WHERE "sourceId" = 'a' AND tag = 'javascript'`,
      ),
    ).toEqual([{ count: '5' }]);
    expect(
      await con.query(
        `SELECT count FROM user_tag_view WHERE "userId" = '1' AND tag = 'javascript'`,
      ),
    ).toEqual([{ count: '5' }]);
    expect(
      await con.query(
        `SELECT "similarSourceId", count FROM source_similarity_view WHERE "sourceId" = 'a'`,
      ),
    ).toEqual([{ similarSourceId: 'b', count: '1' }]);
    expect(
      await con.query(
        `SELECT "similarUserId", count FROM user_similarity_view WHERE "userId" = '1'`,
      ),
    ).toEqual([{ similarUserId: '2', count: '1' }]);
    expect(
      await con.query(`SELECT count(*)::int FROM tag_recommendation`),
    ).toEqual([{ count: 10 }]);
  });
});
