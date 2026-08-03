import { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import { ChannelDigest } from '../../../src/entity/ChannelDigest';
import { PostType } from '../../../src/entity/posts/Post';
import {
  COLLECTIONS_SOURCE,
  TRENDS_SOURCE,
  excludedInterestPostTypes,
  getExcludedInterestSourceIds,
} from '../../../src/common/interest/exclusions';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  await con.getRepository(ChannelDigest).clear();
});

describe('interest agent exclusions', () => {
  it('excludes aggregation post types', () => {
    expect(excludedInterestPostTypes).toEqual([
      PostType.Collection,
      PostType.Digest,
      PostType.Brief,
    ]);
    expect(excludedInterestPostTypes).not.toContain(PostType.Article);
  });

  it('always excludes the collection-style and generated-summary sources', async () => {
    const excluded = await getExcludedInterestSourceIds({ con });
    expect(excluded).toEqual(
      expect.arrayContaining([
        COLLECTIONS_SOURCE,
        TRENDS_SOURCE,
        'x-trends',
        'digest',
        'briefing',
        'agents_digest',
      ]),
    );
  });

  it('includes enabled channel digest sources and skips disabled ones', async () => {
    await con.getRepository(ChannelDigest).save([
      {
        key: 'ai-daily',
        sourceId: 'ai-digest-source',
        channel: 'ai',
        targetAudience: 'devs',
        frequency: 'daily',
        enabled: true,
      },
      {
        key: 'web-weekly',
        sourceId: 'web-digest-source',
        channel: 'web',
        targetAudience: 'devs',
        frequency: 'weekly',
        enabled: false,
      },
    ]);

    const excluded = await getExcludedInterestSourceIds({ con });
    expect(excluded).toContain('ai-digest-source');
    expect(excluded).not.toContain('web-digest-source');
  });

  it('does not repeat a source that is both static and channel-configured', async () => {
    await con.getRepository(ChannelDigest).save({
      key: 'dupe',
      sourceId: COLLECTIONS_SOURCE,
      channel: 'dupe',
      targetAudience: 'devs',
      frequency: 'daily',
      enabled: true,
    });

    const excluded = await getExcludedInterestSourceIds({ con });
    expect(excluded.filter((id) => id === COLLECTIONS_SOURCE)).toHaveLength(1);
  });
});
