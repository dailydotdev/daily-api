import nock from 'nock';
import type { DataSource } from 'typeorm';
import { PubSub } from '@google-cloud/pubsub';
import {
  ONE_DAY_IN_SECONDS,
  ONE_WEEK_IN_SECONDS,
} from '../../src/common/constants';
import createOrGetConnection from '../../src/db';
import { ChannelDigest } from '../../src/entity/ChannelDigest';
import { AGENTS_DIGEST_SOURCE, Source } from '../../src/entity/Source';
import { FreeformPost } from '../../src/entity/posts/FreeformPost';
import {
  checkRedisObjectExists,
  deleteKeysByPattern,
  getRedisObjectExpiry,
  setRedisObjectIfNotExistsWithExpiry,
  setRedisObjectWithExpiry,
} from '../../src/redis';
import { typedWorkers } from '../../src/workers/index';
import worker from '../../src/workers/generateChannelDigest';
import { createMockLogger, expectSuccessfulTypedBackground } from '../helpers';
import { createSource } from '../fixture/source';

const yggdrasilOrigin = process.env.YGGDRASIL_SENTIMENT_ORIGIN;

if (!yggdrasilOrigin) {
  throw new Error('Missing YGGDRASIL_SENTIMENT_ORIGIN');
}

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

const saveDefinition = async ({
  key = 'agentic',
  sourceId = AGENTS_DIGEST_SOURCE,
  channel = 'vibes',
  targetAudience = 'audience',
  frequency = 'daily',
  includeSentiment = false,
  minHighlightScore = null,
  sentimentGroupIds = [],
}: Partial<ChannelDigest> = {}): Promise<ChannelDigest> =>
  con.getRepository(ChannelDigest).save({
    key,
    sourceId,
    channel,
    targetAudience,
    frequency,
    includeSentiment,
    minHighlightScore,
    sentimentGroupIds,
    enabled: true,
  });

const savePost = async ({
  id,
  sourceId = 'content-source',
  title,
  content,
  createdAt,
  channel,
}: {
  id: string;
  sourceId?: string;
  title: string;
  content: string;
  createdAt: Date;
  channel: string;
}) =>
  con.getRepository(FreeformPost).save({
    id,
    shortId: id,
    sourceId,
    title,
    content,
    contentHtml: `<p>${content}</p>`,
    createdAt,
    contentMeta: {
      channels: [channel],
    },
  });

const getDoneKey = (digestKey: string, scheduledAt: string) =>
  `channel-digest:done:${digestKey}:${scheduledAt}`;

const getLockKey = (digestKey: string, scheduledAt: string) =>
  `channel-digest:lock:${digestKey}:${scheduledAt}`;

describe('generateChannelDigest worker', () => {
  afterEach(async () => {
    jest.restoreAllMocks();
    nock.cleanAll();
    await deleteKeysByPattern('channel-digest:*');
    await con.getRepository(ChannelDigest).clear();
    await con
      .createQueryBuilder()
      .delete()
      .from('post')
      .where('"sourceId" IN (:...sourceIds)', {
        sourceIds: ['content-source', AGENTS_DIGEST_SOURCE, 'weekly-source'],
      })
      .execute();
    await con
      .getRepository(Source)
      .delete(['content-source', AGENTS_DIGEST_SOURCE, 'weekly-source']);
  });

  it('should be registered', () => {
    const registeredWorker = typedWorkers.find(
      (item) => item.subscription === worker.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should log and skip unknown digests', async () => {
    const logger = createMockLogger();

    await worker.handler(
      {
        messageId: '1',
        data: {
          digestKey: 'missing',
          scheduledAt: '2026-03-03T10:00:00.000Z',
        },
      },
      con,
      logger,
      new PubSub(),
    );

    expect(logger.error).toHaveBeenCalledWith(
      {
        digestKey: 'missing',
        scheduledAt: '2026-03-03T10:00:00.000Z',
        messageId: '1',
      },
      'Channel digest definition not found',
    );
  });

  it('should log and skip invalid scheduledAt values', async () => {
    const logger = createMockLogger();
    await saveDefinition();

    await worker.handler(
      {
        messageId: '1',
        data: {
          digestKey: 'agentic',
          scheduledAt: 'not-a-date',
        },
      },
      con,
      logger,
      new PubSub(),
    );

    expect(logger.error).toHaveBeenCalledWith(
      {
        digestKey: 'agentic',
        scheduledAt: 'not-a-date',
        messageId: '1',
      },
      'Channel digest scheduledAt is invalid',
    );
  });

  it('should skip when the digest run is already marked done', async () => {
    const scheduledAt = '2026-03-03T10:00:00.000Z';
    await saveDefinition();
    await setRedisObjectWithExpiry(getDoneKey('agentic', scheduledAt), '1', 60);

    await expectSuccessfulTypedBackground<'api.v1.generate-channel-digest'>(
      worker,
      {
        digestKey: 'agentic',
        scheduledAt,
      },
    );

    const posts = await con.getRepository(FreeformPost).findBy({
      sourceId: AGENTS_DIGEST_SOURCE,
    });
    expect(posts).toHaveLength(0);
  });

  it('should skip when the digest lock cannot be acquired', async () => {
    const scheduledAt = '2026-03-03T10:00:00.000Z';
    await saveDefinition();
    await setRedisObjectIfNotExistsWithExpiry(
      getLockKey('agentic', scheduledAt),
      'lock-holder',
      60,
    );

    await expectSuccessfulTypedBackground<'api.v1.generate-channel-digest'>(
      worker,
      {
        digestKey: 'agentic',
        scheduledAt,
      },
    );

    const posts = await con.getRepository(FreeformPost).findBy({
      sourceId: AGENTS_DIGEST_SOURCE,
    });
    expect(posts).toHaveLength(0);
  });

  it('should generate the digest and mark the run done', async () => {
    const scheduledAt = '2026-03-03T10:00:00.000Z';
    await con
      .getRepository(Source)
      .save([
        createSource(
          'content-source',
          'Content',
          'https://daily.dev/content.png',
        ),
        createSource(
          AGENTS_DIGEST_SOURCE,
          'Agents Digest',
          'https://daily.dev/agents.png',
        ),
      ]);
    await saveDefinition({
      key: 'agentic',
      sourceId: AGENTS_DIGEST_SOURCE,
      channel: 'vibes',
      targetAudience:
        'software engineers and engineering leaders who care about AI tooling, agentic engineering, models, and vibe coding. They range from vibe coders to seasoned engineers tracking how AI is reshaping their craft.',
      frequency: 'daily',
      includeSentiment: true,
      minHighlightScore: 0.65,
      sentimentGroupIds: ['group-1', 'group-2'],
    });
    await savePost({
      id: 'post-1',
      title: 'Agentic post',
      content: 'Agentic content',
      createdAt: new Date('2026-03-03T09:00:00.000Z'),
      channel: 'vibes',
    });

    nock(yggdrasilOrigin)
      .get('/api/sentiment/highlights')
      .query(true)
      .times(2)
      .reply(200, {
        items: [],
        cursor: null,
      });

    await expectSuccessfulTypedBackground<'api.v1.generate-channel-digest'>(
      worker,
      {
        digestKey: 'agentic',
        scheduledAt,
      },
    );

    const digest = await con.getRepository(FreeformPost).findOneBy({
      sourceId: AGENTS_DIGEST_SOURCE,
      title: 'Mock sentiment digest',
    });
    expect(digest).toMatchObject({
      sourceId: AGENTS_DIGEST_SOURCE,
      title: 'Mock sentiment digest',
      content: 'Mock digest content',
    });
    expect(
      await checkRedisObjectExists(getDoneKey('agentic', scheduledAt)),
    ).toBe(1);
    expect(
      await checkRedisObjectExists(getLockKey('agentic', scheduledAt)),
    ).toBe(0);
    expect(
      await getRedisObjectExpiry(getDoneKey('agentic', scheduledAt)),
    ).toBeGreaterThan(ONE_DAY_IN_SECONDS);
  });

  it('should ignore posts from all channel digest sources when generating digests', async () => {
    const scheduledAt = '2026-03-03T10:00:00.000Z';
    await con
      .getRepository(Source)
      .save([
        createSource(
          AGENTS_DIGEST_SOURCE,
          'Agents Digest',
          'https://daily.dev/agents.png',
        ),
        createSource(
          'weekly-source',
          'Weekly Digest',
          'https://daily.dev/weekly.png',
        ),
      ]);
    await saveDefinition({
      key: 'agentic',
      sourceId: AGENTS_DIGEST_SOURCE,
      channel: 'vibes',
    });
    await saveDefinition({
      key: 'weekly-test',
      sourceId: 'weekly-source',
      channel: 'weekly',
      frequency: 'weekly',
    });
    await savePost({
      id: 'agents-post',
      sourceId: AGENTS_DIGEST_SOURCE,
      title: 'Agents digest post',
      content: 'Agents digest body',
      createdAt: new Date('2026-03-03T09:10:00.000Z'),
      channel: 'vibes',
    });
    await savePost({
      id: 'weekly-post',
      sourceId: 'weekly-source',
      title: 'Weekly digest post',
      content: 'Weekly digest body',
      createdAt: new Date('2026-03-03T09:20:00.000Z'),
      channel: 'vibes',
    });
    const digestCountBefore = await con.getRepository(FreeformPost).countBy({
      sourceId: AGENTS_DIGEST_SOURCE,
    });

    await expectSuccessfulTypedBackground<'api.v1.generate-channel-digest'>(
      worker,
      {
        digestKey: 'agentic',
        scheduledAt,
      },
    );

    const digests = await con.getRepository(FreeformPost).findBy({
      sourceId: AGENTS_DIGEST_SOURCE,
    });
    expect(digests).toHaveLength(digestCountBefore);
    expect(
      digests.find((digest) => digest.title === 'Mock sentiment digest'),
    ).toBeUndefined();
  });

  it('should use a weekly done ttl for weekly digests', async () => {
    const scheduledAt = '2026-03-02T10:00:00.000Z';
    await con
      .getRepository(Source)
      .save([
        createSource(
          'content-source',
          'Content',
          'https://daily.dev/content.png',
        ),
        createSource('weekly-source', 'Weekly', 'https://daily.dev/weekly.png'),
      ]);
    await saveDefinition({
      key: 'weekly-test',
      sourceId: 'weekly-source',
      channel: 'weekly',
      frequency: 'weekly',
    });
    await savePost({
      id: 'weekly-post',
      title: 'Weekly post',
      content: 'Weekly content',
      createdAt: new Date('2026-02-28T09:00:00.000Z'),
      channel: 'weekly',
    });

    await expectSuccessfulTypedBackground<'api.v1.generate-channel-digest'>(
      worker,
      {
        digestKey: 'weekly-test',
        scheduledAt,
      },
    );

    expect(
      await getRedisObjectExpiry(getDoneKey('weekly-test', scheduledAt)),
    ).toBeGreaterThan(ONE_WEEK_IN_SECONDS);
  });
});
