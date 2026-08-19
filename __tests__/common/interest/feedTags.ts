import { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import { saveFixtures } from '../../helpers';
import { User } from '../../../src/entity';
import { Feed } from '../../../src/entity/Feed';
import { FeedTag } from '../../../src/entity/FeedTag';
import { replaceFeedTags } from '../../../src/common/interest/feedTags';
import { usersFixture } from '../../fixture/user';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  await saveFixtures(con, User, usersFixture);
  await con.getRepository(Feed).save({ id: 'feed-1', userId: '1', flags: {} });
});

describe('feedTags helpers', () => {
  it('replaceFeedTags replaces the set and caps it', async () => {
    await con.getRepository(FeedTag).save([
      { feedId: 'feed-1', tag: 'zig' },
      { feedId: 'feed-1', tag: 'rust' },
    ]);

    await replaceFeedTags({
      con,
      feedId: 'feed-1',
      tags: ['go', 'python', 'ml'],
      maxTags: 2,
    });

    const tags = await con.getRepository(FeedTag).findBy({ feedId: 'feed-1' });
    const values = tags.map((tag) => tag.tag).sort();
    expect(values).toEqual(['go', 'python']);
  });
});
