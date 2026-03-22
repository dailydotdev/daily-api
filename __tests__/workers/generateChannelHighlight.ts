import type { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { ChannelHighlightDefinition } from '../../src/entity/ChannelHighlightDefinition';
import { ChannelHighlightRun } from '../../src/entity/ChannelHighlightRun';
import {
  PostHighlight,
  PostHighlightSignificance,
} from '../../src/entity/PostHighlight';
import { ArticlePost, CollectionPost, Source } from '../../src/entity';
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
  contentCuration = [] as string[],
}: {
  id: string;
  title: string;
  createdAt: Date;
  statsUpdatedAt?: Date;
  metadataChangedAt?: Date;
  channel?: string;
  sourceId?: string;
  contentCuration?: string[];
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
    contentCuration,
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
      mode: 'shadow',
      targetAudience: 'Developers following vibes',
      candidateHorizonHours: 72,
      maxItems: 3,
    });
    await saveArticle({
      id: 'live-1',
      title: 'Live story',
      createdAt: new Date('2026-03-03T08:00:00.000Z'),
    });
    await saveArticle({
      id: 'fresh-1',
      title: 'Fresh story',
      createdAt: new Date('2026-03-03T09:20:00.000Z'),
    });
    await con.getRepository(PostHighlight).save({
      channel: 'vibes',
      postId: 'live-1',
      highlightedAt: new Date('2026-03-03T09:00:00.000Z'),
      headline: 'Live headline',
    });

    const evaluatorSpy = jest
      .spyOn(evaluator, 'evaluateChannelHighlights')
      .mockResolvedValue({
        items: [
          {
            postId: 'fresh-1',
            headline: 'Fresh headline',
            significanceLabel: 'breaking',
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
    expect(evaluatorSpy.mock.calls[0][0].targetAudience).toBe(
      'Developers following vibes',
    );
    expect(evaluatorSpy.mock.calls[0][0].maxItems).toBe(3);
    expect(evaluatorSpy.mock.calls[0][0].currentHighlights).toEqual([
      expect.objectContaining({
        postId: 'live-1',
        headline: 'Live headline',
      }),
    ]);
    expect(evaluatorSpy.mock.calls[0][0].newCandidates).toEqual([
      expect.objectContaining({
        postId: 'fresh-1',
        title: 'Fresh story',
        relatedItemsCount: 1,
      }),
    ]);

    const liveHighlights = await con.getRepository(PostHighlight).find({
      where: { channel: 'vibes' },
      order: { highlightedAt: 'DESC' },
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
      internalCount: 2,
      addedPostIds: ['fresh-1'],
    });
  });

  it('should publish admitted highlights in publish mode and trim FIFO by maxItems', async () => {
    const now = new Date('2026-03-03T11:00:00.000Z');
    await con.getRepository(ChannelHighlightDefinition).save({
      channel: 'vibes',
      mode: 'publish',
      candidateHorizonHours: 72,
      maxItems: 2,
    });
    await saveArticle({
      id: 'old-live',
      title: 'Older live story',
      createdAt: new Date('2026-03-03T08:00:00.000Z'),
    });
    await saveArticle({
      id: 'new-live',
      title: 'Newer live story',
      createdAt: new Date('2026-03-03T09:00:00.000Z'),
    });
    await saveArticle({
      id: 'fresh-1',
      title: 'Fresh candidate',
      createdAt: new Date('2026-03-03T10:30:00.000Z'),
    });
    await con.getRepository(PostHighlight).save([
      {
        channel: 'vibes',
        postId: 'new-live',
        highlightedAt: new Date('2026-03-03T10:00:00.000Z'),
        headline: 'Newer live headline',
      },
      {
        channel: 'vibes',
        postId: 'old-live',
        highlightedAt: new Date('2026-03-03T09:00:00.000Z'),
        headline: 'Older live headline',
      },
    ]);

    jest.spyOn(evaluator, 'evaluateChannelHighlights').mockResolvedValue({
      items: [
        {
          postId: 'fresh-1',
          headline: 'Fresh headline',
          significanceLabel: 'breaking',
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
      order: { highlightedAt: 'DESC' },
    });
    expect(liveHighlights).toHaveLength(2);
    expect(liveHighlights[0]).toMatchObject({
      postId: 'fresh-1',
      headline: 'Fresh headline',
      significance: PostHighlightSignificance.Breaking,
      reason: 'test',
    });
    expect(liveHighlights[1]).toMatchObject({
      postId: 'new-live',
      headline: 'Newer live headline',
    });
  });

  it('should upgrade a highlighted article to its collection without re-evaluating it', async () => {
    const now = new Date('2026-03-03T11:30:00.000Z');
    await con.getRepository(ChannelHighlightDefinition).save({
      channel: 'vibes',
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
      id: 'child-upgrade',
      title: 'Child story',
      createdAt: new Date('2026-03-03T11:05:00.000Z'),
    });
    await con.getRepository(PostRelation).save({
      postId: 'col-upgrade',
      relatedPostId: 'child-upgrade',
      type: PostRelationType.Collection,
    });
    await con.getRepository(PostHighlight).save({
      channel: 'vibes',
      postId: 'child-upgrade',
      highlightedAt: new Date('2026-03-03T11:00:00.000Z'),
      headline: 'Original child headline',
      significance: PostHighlightSignificance.Major,
      reason: 'existing',
    });

    const evaluatorSpy = jest.spyOn(evaluator, 'evaluateChannelHighlights');

    await expectSuccessfulTypedBackground<'api.v1.generate-channel-highlight'>(
      worker,
      {
        channel: 'vibes',
        scheduledAt: now.toISOString(),
      },
    );

    expect(evaluatorSpy).not.toHaveBeenCalled();

    const liveHighlights = await con.getRepository(PostHighlight).find({
      where: { channel: 'vibes' },
    });
    expect(liveHighlights).toEqual([
      expect.objectContaining({
        postId: 'col-upgrade',
        headline: 'Original child headline',
        significance: PostHighlightSignificance.Major,
        reason: 'existing',
      }),
    ]);
    expect(liveHighlights[0].highlightedAt.toISOString()).toBe(
      '2026-03-03T11:00:00.000Z',
    );
  });

  it('should remove highlights that aged past the configured horizon', async () => {
    const now = new Date('2026-03-03T12:00:00.000Z');
    await con.getRepository(ChannelHighlightDefinition).save({
      channel: 'vibes',
      mode: 'publish',
      candidateHorizonHours: 24,
      maxItems: 3,
    });
    await saveArticle({
      id: 'expired-live',
      title: 'Expired live story',
      createdAt: new Date('2026-03-01T10:00:00.000Z'),
    });
    await con.getRepository(PostHighlight).save({
      channel: 'vibes',
      postId: 'expired-live',
      highlightedAt: new Date('2026-03-02T10:00:00.000Z'),
      headline: 'Expired headline',
    });

    const evaluatorSpy = jest.spyOn(evaluator, 'evaluateChannelHighlights');

    await expectSuccessfulTypedBackground<'api.v1.generate-channel-highlight'>(
      worker,
      {
        channel: 'vibes',
        scheduledAt: now.toISOString(),
      },
    );

    expect(evaluatorSpy).not.toHaveBeenCalled();

    const liveHighlights = await con.getRepository(PostHighlight).find({
      where: { channel: 'vibes' },
    });
    expect(liveHighlights).toEqual([]);
  });

  it('should exclude posts older than the candidate horizon even when recently updated', async () => {
    const now = new Date('2026-03-03T12:30:00.000Z');
    await con.getRepository(ChannelHighlightDefinition).save({
      channel: 'vibes',
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
      .mockResolvedValue({
        items: [
          {
            postId: 'fresh-1',
            headline: 'Fresh headline',
            significanceLabel: 'notable',
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
    expect(evaluatorSpy.mock.calls[0][0].newCandidates).toEqual([
      expect.objectContaining({
        postId: 'fresh-1',
        title: 'Fresh candidate',
        relatedItemsCount: 1,
      }),
    ]);
  });

  it('should exclude posts with rejected content curation types from candidates', async () => {
    const now = new Date('2026-03-03T13:00:00.000Z');
    await con.getRepository(ChannelHighlightDefinition).save({
      channel: 'vibes',
      mode: 'shadow',
      candidateHorizonHours: 72,
      maxItems: 5,
    });
    await saveArticle({
      id: 'news-1',
      title: 'News story',
      createdAt: new Date('2026-03-03T12:00:00.000Z'),
      contentCuration: ['news'],
    });
    await saveArticle({
      id: 'release-1',
      title: 'Release story',
      createdAt: new Date('2026-03-03T12:10:00.000Z'),
      contentCuration: ['release'],
    });
    await saveArticle({
      id: 'tutorial-1',
      title: 'Tutorial post',
      createdAt: new Date('2026-03-03T12:20:00.000Z'),
      contentCuration: ['tutorial'],
    });
    await saveArticle({
      id: 'opinion-1',
      title: 'Opinion post',
      createdAt: new Date('2026-03-03T12:30:00.000Z'),
      contentCuration: ['opinion'],
    });
    await saveArticle({
      id: 'listicle-1',
      title: 'Listicle post',
      createdAt: new Date('2026-03-03T12:40:00.000Z'),
      contentCuration: ['listicle'],
    });

    const evaluatorSpy = jest
      .spyOn(evaluator, 'evaluateChannelHighlights')
      .mockResolvedValue({ items: [] });

    await expectSuccessfulTypedBackground<'api.v1.generate-channel-highlight'>(
      worker,
      {
        channel: 'vibes',
        scheduledAt: now.toISOString(),
      },
    );

    expect(evaluatorSpy).toHaveBeenCalledTimes(1);
    const candidateIds = evaluatorSpy.mock.calls[0][0].newCandidates.map(
      (c: { postId: string }) => c.postId,
    );
    expect(candidateIds).toContain('news-1');
    expect(candidateIds).toContain('release-1');
    expect(candidateIds).not.toContain('tutorial-1');
    expect(candidateIds).not.toContain('opinion-1');
    expect(candidateIds).not.toContain('listicle-1');
  });
});
