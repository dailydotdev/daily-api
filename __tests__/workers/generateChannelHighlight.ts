import type { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { ChannelHighlightDefinition } from '../../src/entity/ChannelHighlightDefinition';
import { ChannelHighlightRun } from '../../src/entity/ChannelHighlightRun';
import { ChannelHighlightState } from '../../src/entity/ChannelHighlightState';
import { PostHighlight } from '../../src/entity/PostHighlight';
import {
  CollectionPost,
  ArticlePost,
  SocialTwitterPost,
  Source,
} from '../../src/entity';
import {
  PostRelation,
  PostRelationType,
} from '../../src/entity/posts/PostRelation';
import { PostType } from '../../src/entity/posts/Post';
import worker from '../../src/workers/generateChannelHighlight';
import { typedWorkers } from '../../src/workers/index';
import { deleteKeysByPattern } from '../../src/redis';
import * as evaluator from '../../src/common/channelHighlight/evaluate';
import { expectSuccessfulTypedBackground } from '../helpers';
import { createSource } from '../fixture/source';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

const saveArticle = async ({
  id,
  title,
  createdAt,
  statsUpdatedAt = createdAt,
  metadataChangedAt = createdAt,
  channel = 'vibes',
  sourceId = 'content-source',
}: {
  id: string;
  title: string;
  createdAt: Date;
  statsUpdatedAt?: Date;
  metadataChangedAt?: Date;
  channel?: string;
  sourceId?: string;
}) =>
  con.getRepository(ArticlePost).save({
    id,
    shortId: id,
    title,
    url: `https://example.com/${id}`,
    canonicalUrl: `https://example.com/${id}`,
    score: 0,
    sourceId,
    visible: true,
    deleted: false,
    banned: false,
    showOnFeed: true,
    createdAt,
    metadataChangedAt,
    statsUpdatedAt,
    type: PostType.Article,
    contentMeta: {
      channels: [channel],
    },
  });

const saveCollection = async ({
  id,
  title,
  createdAt,
  channel = 'vibes',
  sourceId = 'content-source',
}: {
  id: string;
  title: string;
  createdAt: Date;
  channel?: string;
  sourceId?: string;
}) =>
  con.getRepository(CollectionPost).save({
    id,
    shortId: id,
    title,
    url: `https://example.com/${id}`,
    canonicalUrl: `https://example.com/${id}`,
    score: 0,
    sourceId,
    visible: true,
    deleted: false,
    banned: false,
    showOnFeed: true,
    createdAt,
    metadataChangedAt: createdAt,
    statsUpdatedAt: createdAt,
    type: PostType.Collection,
    contentMeta: {
      channels: [channel],
    },
  });

const saveTwitterPost = async ({
  id,
  title,
  url,
  createdAt,
  channel = 'vibes',
  sourceId = 'content-source',
  sharedPostId,
  contentMeta,
}: {
  id: string;
  title: string;
  url: string;
  createdAt: Date;
  channel?: string;
  sourceId?: string;
  sharedPostId?: string;
  contentMeta?: Record<string, unknown>;
}) =>
  con.getRepository(SocialTwitterPost).save({
    id,
    shortId: id,
    title,
    url,
    canonicalUrl: url,
    score: 0,
    sourceId,
    visible: true,
    deleted: false,
    banned: false,
    showOnFeed: true,
    createdAt,
    metadataChangedAt: createdAt,
    statsUpdatedAt: createdAt,
    type: PostType.SocialTwitter,
    sharedPostId,
    contentMeta: {
      channels: [channel],
      ...(contentMeta || {}),
    },
  });

describe('generateChannelHighlight worker', () => {
  beforeEach(async () => {
    await con
      .getRepository(Source)
      .save([
        createSource(
          'content-source',
          'Content',
          'https://daily.dev/content.png',
        ),
        createSource(
          'secondary-source',
          'Secondary',
          'https://daily.dev/secondary.png',
        ),
      ]);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await deleteKeysByPattern('channel-highlight:*');
    await con.getRepository(ChannelHighlightRun).clear();
    await con.getRepository(ChannelHighlightState).clear();
    await con.getRepository(ChannelHighlightDefinition).clear();
    await con.getRepository(PostHighlight).clear();
    await con.getRepository(PostRelation).clear();
    await con
      .createQueryBuilder()
      .delete()
      .from('post')
      .where('"sourceId" IN (:...sourceIds)', {
        sourceIds: ['content-source', 'secondary-source'],
      })
      .execute();
    await con
      .getRepository(Source)
      .delete(['content-source', 'secondary-source']);
  });

  it('should be registered', () => {
    const registeredWorker = typedWorkers.find(
      (item) => item.subscription === worker.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should keep live highlights unchanged in shadow mode and store a comparison run', async () => {
    const now = new Date('2026-03-03T10:00:00.000Z');
    await con.getRepository(ChannelHighlightDefinition).save({
      channel: 'vibes',
      enabled: true,
      mode: 'shadow',
      candidateHorizonHours: 72,
      maxItems: 3,
    });
    await saveArticle({
      id: 'live-1',
      title: 'Live story',
      createdAt: new Date('2026-03-03T08:00:00.000Z'),
    });
    await saveCollection({
      id: 'collection-1',
      title: 'Fresh collection',
      createdAt: new Date('2026-03-03T09:30:00.000Z'),
    });
    await saveArticle({
      id: 'child-1',
      title: 'Fresh child story',
      createdAt: new Date('2026-03-03T09:20:00.000Z'),
    });
    await con.getRepository(PostRelation).save({
      postId: 'collection-1',
      relatedPostId: 'child-1',
      type: PostRelationType.Collection,
    });
    await con.getRepository(PostHighlight).save({
      channel: 'vibes',
      postId: 'live-1',
      rank: 1,
      headline: 'Live headline',
    });

    const evaluatorSpy = jest
      .spyOn(evaluator, 'evaluateChannelHighlights')
      .mockImplementation(async ({ candidates }) => ({
        items: candidates.slice(0, 1).map((candidate, index) => ({
          storyKey: candidate.storyKey,
          postId: candidate.canonicalPostId,
          headline: `${candidate.title} headline`,
          significanceScore: 0.9,
          significanceLabel: 'breaking',
          rank: index + 1,
          reason: 'test',
        })),
      }));

    await expectSuccessfulTypedBackground<'api.v1.generate-channel-highlight'>(
      worker,
      {
        channel: 'vibes',
        scheduledAt: now.toISOString(),
      },
    );

    expect(evaluatorSpy).toHaveBeenCalledTimes(1);
    expect(evaluatorSpy.mock.calls[0][0].candidates[0]).toMatchObject({
      storyKey: 'collection:collection-1',
      canonicalPostId: 'collection-1',
      memberPostIds: ['child-1', 'collection-1'],
    });

    const liveHighlights = await con.getRepository(PostHighlight).find({
      where: { channel: 'vibes' },
      order: { rank: 'ASC' },
    });
    expect(liveHighlights).toHaveLength(1);
    expect(liveHighlights[0]).toMatchObject({
      postId: 'live-1',
      headline: 'Live headline',
    });

    const run = await con.getRepository(ChannelHighlightRun).findOneByOrFail({
      channel: 'vibes',
    });
    expect(run.status).toBe('completed');
    expect(run.comparison).toMatchObject({
      wouldPublish: true,
      published: false,
      baselineCount: 1,
      internalCount: 1,
    });

    const state = await con
      .getRepository(ChannelHighlightState)
      .findOneByOrFail({
        channel: 'vibes',
      });
    expect(state.candidatePool).toEqual({
      stories: expect.arrayContaining([
        expect.objectContaining({
          storyKey: 'collection:collection-1',
          canonicalPostId: 'collection-1',
        }),
      ]),
    });
  });

  it('should publish evaluated highlights in publish mode', async () => {
    const now = new Date('2026-03-03T11:00:00.000Z');
    await con.getRepository(ChannelHighlightDefinition).save({
      channel: 'vibes',
      enabled: true,
      mode: 'publish',
      candidateHorizonHours: 72,
      maxItems: 3,
    });
    await saveArticle({
      id: 'publish-1',
      title: 'Publish me',
      createdAt: new Date('2026-03-03T10:30:00.000Z'),
    });

    jest.spyOn(evaluator, 'evaluateChannelHighlights').mockResolvedValue({
      items: [
        {
          storyKey: 'url:https://example.com/publish-1',
          postId: 'publish-1',
          headline: 'Publish headline',
          significanceScore: 0.95,
          significanceLabel: 'breaking',
          rank: 1,
          reason: 'test',
        },
      ],
    });

    await expectSuccessfulTypedBackground<'api.v1.generate-channel-highlight'>(
      worker,
      {
        channel: 'vibes',
        scheduledAt: now.toISOString(),
      },
    );

    const liveHighlights = await con.getRepository(PostHighlight).find({
      where: { channel: 'vibes' },
      order: { rank: 'ASC' },
    });
    expect(liveHighlights).toHaveLength(1);
    expect(liveHighlights[0]).toMatchObject({
      postId: 'publish-1',
      headline: 'Publish headline',
      rank: 1,
    });
  });

  it('should publish a collection upgrade for the same story', async () => {
    const now = new Date('2026-03-03T11:30:00.000Z');
    await con.getRepository(ChannelHighlightDefinition).save({
      channel: 'vibes',
      enabled: true,
      mode: 'publish',
      candidateHorizonHours: 72,
      maxItems: 3,
    });
    await saveCollection({
      id: 'col-upgrade',
      title: 'Collection upgrade',
      createdAt: new Date('2026-03-03T11:10:00.000Z'),
    });
    await saveArticle({
      id: 'child-upgr',
      title: 'Child upgrade',
      createdAt: new Date('2026-03-03T11:05:00.000Z'),
    });
    await con.getRepository(PostRelation).save({
      postId: 'col-upgrade',
      relatedPostId: 'child-upgr',
      type: PostRelationType.Collection,
    });
    await con.getRepository(PostHighlight).save({
      channel: 'vibes',
      postId: 'child-upgr',
      rank: 1,
      headline: 'Same story headline',
    });

    jest.spyOn(evaluator, 'evaluateChannelHighlights').mockResolvedValue({
      items: [
        {
          storyKey: 'collection:col-upgrade',
          postId: 'col-upgrade',
          headline: 'Same story headline',
          significanceScore: 0.96,
          significanceLabel: 'breaking',
          rank: 1,
          reason: 'test',
        },
      ],
    });

    await expectSuccessfulTypedBackground<'api.v1.generate-channel-highlight'>(
      worker,
      {
        channel: 'vibes',
        scheduledAt: now.toISOString(),
      },
    );

    const liveHighlights = await con.getRepository(PostHighlight).find({
      where: { channel: 'vibes' },
      order: { rank: 'ASC' },
    });
    expect(liveHighlights).toEqual([
      expect.objectContaining({
        postId: 'col-upgrade',
        headline: 'Same story headline',
        rank: 1,
      }),
    ]);
  });

  it('should re-evaluate a cached story when a relation changed after the last evaluation', async () => {
    const now = new Date('2026-03-03T12:30:00.000Z');
    await con.getRepository(ChannelHighlightDefinition).save({
      channel: 'vibes',
      enabled: true,
      mode: 'shadow',
      candidateHorizonHours: 72,
      maxItems: 3,
    });
    await saveCollection({
      id: 'col-cached',
      title: 'Cached collection',
      createdAt: new Date('2026-03-03T11:00:00.000Z'),
    });
    await saveArticle({
      id: 'child-cach',
      title: 'Cached child',
      createdAt: new Date('2026-03-03T10:55:00.000Z'),
    });
    await con.getRepository(ChannelHighlightState).save({
      channel: 'vibes',
      lastFetchedAt: new Date('2026-03-03T12:00:00.000Z'),
      lastPublishedAt: null,
      candidatePool: {
        stories: [
          {
            storyKey: 'collection:col-cached',
            canonicalPostId: 'col-cached',
            collectionId: 'col-cached',
            memberPostIds: ['child-cach', 'col-cached'],
            firstSeenAt: '2026-03-03T10:55:00.000Z',
            lastSeenAt: '2026-03-03T12:00:00.000Z',
            lastLlmEvaluatedAt: '2026-03-03T12:05:00.000Z',
            lastSignificanceScore: 0.82,
            lastSignificanceLabel: 'breaking',
            lastHeadline: 'Cached headline',
            status: 'active',
          },
        ],
      },
    });
    await con.getRepository(PostRelation).save({
      postId: 'col-cached',
      relatedPostId: 'child-cach',
      type: PostRelationType.Collection,
      createdAt: new Date('2026-03-03T12:10:00.000Z'),
    });

    const evaluatorSpy = jest
      .spyOn(evaluator, 'evaluateChannelHighlights')
      .mockResolvedValue({
        items: [
          {
            storyKey: 'collection:col-cached',
            postId: 'col-cached',
            headline: 'Fresh headline',
            significanceScore: 0.91,
            significanceLabel: 'breaking',
            rank: 1,
            reason: 'test',
          },
        ],
      });

    await expectSuccessfulTypedBackground<'api.v1.generate-channel-highlight'>(
      worker,
      {
        channel: 'vibes',
        scheduledAt: now.toISOString(),
      },
    );

    expect(evaluatorSpy).toHaveBeenCalledTimes(1);
  });

  it('should exclude posts older than the configured horizon even when they were recently updated', async () => {
    const now = new Date('2026-03-03T12:00:00.000Z');
    await con.getRepository(ChannelHighlightDefinition).save({
      channel: 'vibes',
      enabled: true,
      mode: 'shadow',
      candidateHorizonHours: 72,
      maxItems: 3,
    });
    await saveArticle({
      id: 'old-1',
      title: 'Old but active',
      createdAt: new Date('2026-02-20T12:00:00.000Z'),
      statsUpdatedAt: new Date('2026-03-03T11:55:00.000Z'),
      metadataChangedAt: new Date('2026-03-03T11:55:00.000Z'),
    });
    await saveArticle({
      id: 'fresh-1',
      title: 'Fresh candidate',
      createdAt: new Date('2026-03-03T11:30:00.000Z'),
    });

    const evaluatorSpy = jest
      .spyOn(evaluator, 'evaluateChannelHighlights')
      .mockImplementation(async ({ candidates }) => ({
        items: candidates.map((candidate, index) => ({
          storyKey: candidate.storyKey,
          postId: candidate.canonicalPostId,
          headline: candidate.title,
          significanceScore: 0.7,
          significanceLabel: 'notable',
          rank: index + 1,
          reason: 'test',
        })),
      }));

    await expectSuccessfulTypedBackground<'api.v1.generate-channel-highlight'>(
      worker,
      {
        channel: 'vibes',
        scheduledAt: now.toISOString(),
      },
    );

    expect(evaluatorSpy).toHaveBeenCalledTimes(1);
    expect(evaluatorSpy.mock.calls[0][0].candidates).toEqual([
      expect.objectContaining({
        canonicalPostId: 'fresh-1',
      }),
    ]);
  });

  it('should prefer referenced tweet identity for quote tweets', async () => {
    const now = new Date('2026-03-03T13:00:00.000Z');
    await con.getRepository(ChannelHighlightDefinition).save({
      channel: 'vibes',
      enabled: true,
      mode: 'shadow',
      candidateHorizonHours: 72,
      maxItems: 3,
    });
    await saveTwitterPost({
      id: 'tweet-quote-1',
      title: 'Quote tweet',
      url: 'https://x.com/quoter/status/1234567890123456789',
      createdAt: new Date('2026-03-03T12:45:00.000Z'),
      contentMeta: {
        social_twitter: {
          tweet_id: '1234567890123456789',
          reference: {
            tweet_id: '9876543210987654321',
            url: 'https://x.com/original/status/9876543210987654321',
          },
        },
      },
    });

    const evaluatorSpy = jest
      .spyOn(evaluator, 'evaluateChannelHighlights')
      .mockImplementation(async ({ candidates }) => ({
        items: candidates.map((candidate, index) => ({
          storyKey: candidate.storyKey,
          postId: candidate.canonicalPostId,
          headline: candidate.title,
          significanceScore: 0.8,
          significanceLabel: 'major',
          rank: index + 1,
          reason: 'test',
        })),
      }));

    await expectSuccessfulTypedBackground<'api.v1.generate-channel-highlight'>(
      worker,
      {
        channel: 'vibes',
        scheduledAt: now.toISOString(),
      },
    );

    expect(evaluatorSpy).toHaveBeenCalledTimes(1);
    expect(evaluatorSpy.mock.calls[0][0].candidates).toEqual([
      expect.objectContaining({
        canonicalPostId: 'tweet-quote-1',
        storyKey: 'twitter:9876543210987654321',
      }),
    ]);
  });
});
