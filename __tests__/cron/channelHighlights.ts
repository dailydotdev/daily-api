import type { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { ChannelDigest } from '../../src/entity/ChannelDigest';
import { ChannelHighlightRun } from '../../src/entity/ChannelHighlightRun';
import { HighlightsCanonical } from '../../src/entity/HighlightsCanonical';
import { AGENTS_DIGEST_SOURCE, UNKNOWN_SOURCE } from '../../src/entity/Source';
import { HighlightSignificance } from '../../src/common/channelHighlight/significance';
import { Source } from '../../src/entity/Source';
import { ArticlePost } from '../../src/entity/posts/ArticlePost';
import { CollectionPost } from '../../src/entity/posts/CollectionPost';
import { SharePost } from '../../src/entity/posts/SharePost';
import {
  PostRelation,
  PostRelationType,
} from '../../src/entity/posts/PostRelation';
import { PostType } from '../../src/entity/posts/Post';
import * as evaluator from '../../src/common/channelHighlight/evaluate';
import { createSource } from '../fixture/source';
import channelHighlights, {
  runChannelHighlights,
} from '../../src/cron/channelHighlights';
import { crons } from '../../src/cron/index';

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
  channels = ['vibes'],
  sourceId = 'content-source',
  contentCuration = [] as string[],
  summary = 'A newsworthy summary describing the story in detail.',
}: {
  id: string;
  title: string;
  createdAt: Date;
  statsUpdatedAt?: Date;
  metadataChangedAt?: Date;
  channels?: string[];
  sourceId?: string;
  contentCuration?: string[];
  summary?: string | null;
}) =>
  con.getRepository(ArticlePost).save({
    id,
    shortId: id,
    title,
    summary,
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
      channels,
    },
  });

const saveCollection = async ({
  id,
  title,
  createdAt,
  channels = ['vibes'],
  sourceId = 'content-source',
}: {
  id: string;
  title: string;
  createdAt: Date;
  channels?: string[];
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
      channels,
    },
  });

const saveShare = async ({
  id,
  sharedPostId,
  createdAt,
  sourceId = 'content-source',
  title = 'Shared story',
  upvotes = 0,
  private: isPrivate = false,
}: {
  id: string;
  sharedPostId: string;
  createdAt: Date;
  sourceId?: string;
  title?: string;
  upvotes?: number;
  private?: boolean;
}) =>
  con.getRepository(SharePost).save({
    id,
    shortId: id,
    title,
    sourceId,
    sharedPostId,
    createdAt,
    metadataChangedAt: createdAt,
    statsUpdatedAt: createdAt,
    visible: true,
    deleted: false,
    banned: false,
    private: isPrivate,
    showOnFeed: true,
    upvotes,
    type: PostType.Share,
  });

describe('channel highlight generation cron', () => {
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
    await con.getRepository(ChannelHighlightRun).clear();
    await con.getRepository(ChannelDigest).clear();
    await con.getRepository(HighlightsCanonical).clear();
    await con.getRepository(PostRelation).clear();
    await con
      .createQueryBuilder()
      .delete()
      .from('post')
      .where('"sourceId" IN (:...sourceIds)', {
        sourceIds: [
          'content-source',
          'secondary-source',
          AGENTS_DIGEST_SOURCE,
          UNKNOWN_SOURCE,
        ],
      })
      .execute();
    await con
      .getRepository(Source)
      .delete([
        'content-source',
        'secondary-source',
        AGENTS_DIGEST_SOURCE,
        UNKNOWN_SOURCE,
      ]);
  });

  it('should be registered', () => {
    const registeredCron = crons.find(
      (item) => item.name === channelHighlights.name,
    );

    expect(registeredCron).toBeDefined();
  });

  it('should generate canonical highlights from post channels', async () => {
    const now = new Date('2026-03-03T10:00:00.000Z');
    await saveArticle({
      id: 'fresh-1',
      title: 'Fresh story',
      createdAt: new Date('2026-03-03T09:45:00.000Z'),
      channels: ['backend', 'vibes'],
    });

    const evaluatorSpy = jest
      .spyOn(evaluator, 'evaluateHighlights')
      .mockResolvedValue({
        items: [
          {
            postId: 'fresh-1',
            headline: 'Fresh headline',
            significanceLabel: 'major',
            reason: 'test',
          },
        ],
      });

    await runChannelHighlights({ con, now });

    expect(evaluatorSpy).toHaveBeenCalledTimes(1);
    expect(evaluatorSpy.mock.calls[0][0]).toMatchObject({
      maxItems: 20,
    });
    expect(evaluatorSpy.mock.calls[0][0].newCandidates).toEqual([
      expect.objectContaining({
        postId: 'fresh-1',
        title: 'Fresh story',
      }),
    ]);

    const canonicalHighlights = await con
      .getRepository(HighlightsCanonical)
      .find();
    expect(canonicalHighlights).toEqual([
      expect.objectContaining({
        postId: 'fresh-1',
        channels: ['backend', 'vibes'],
        headline: 'Fresh headline',
        significance: HighlightSignificance.Major,
        reason: 'test',
      }),
    ]);

    const runs = await con.getRepository(ChannelHighlightRun).find();
    expect(runs).toMatchObject([
      {
        channel: 'global',
        status: 'completed',
      },
    ]);
  });

  it('should send recent canonical history to the evaluator', async () => {
    const now = new Date('2026-03-03T12:00:00.000Z');
    await saveArticle({
      id: 'canonical-1',
      title: 'Canonical story',
      summary: 'Canonical summary',
      createdAt: new Date('2026-03-03T08:30:00.000Z'),
    });
    await saveArticle({
      id: 'fresh-1',
      title: 'Fresh story',
      createdAt: new Date('2026-03-03T11:20:00.000Z'),
    });
    await con.getRepository(HighlightsCanonical).save({
      postId: 'canonical-1',
      channels: ['backend'],
      highlightedAt: new Date('2026-03-03T09:10:00.000Z'),
      headline: 'Canonical headline',
      significance: HighlightSignificance.Major,
      reason: 'canonical history',
    });

    const evaluatorSpy = jest
      .spyOn(evaluator, 'evaluateHighlights')
      .mockResolvedValue({ items: [] });

    await runChannelHighlights({ con, now });

    expect(evaluatorSpy).toHaveBeenCalledTimes(1);
    expect(evaluatorSpy.mock.calls[0][0].currentHighlights).toEqual([
      expect.objectContaining({
        postId: 'canonical-1',
        headline: 'Canonical headline',
        summary: 'Canonical summary',
        reason: 'canonical history',
      }),
    ]);
    expect(evaluatorSpy.mock.calls[0][0].newCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          postId: 'fresh-1',
          title: 'Fresh story',
        }),
      ]),
    );
  });

  it('should upgrade a highlighted article to its collection without re-evaluating it', async () => {
    const now = new Date('2026-03-03T11:30:00.000Z');
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
    const originalCanonicalUpdatedAt = new Date('2026-03-03T10:30:00.000Z');
    const originalCanonical = await con
      .getRepository(HighlightsCanonical)
      .save({
        postId: 'child-upgrade',
        channels: ['vibes'],
        highlightedAt: new Date('2026-03-03T11:00:00.000Z'),
        headline: 'Original child headline',
        significance: HighlightSignificance.Major,
        reason: 'existing',
      });
    await con.getRepository(HighlightsCanonical).update(
      { id: originalCanonical.id },
      {
        updatedAt: originalCanonicalUpdatedAt,
      },
    );

    const evaluatorSpy = jest.spyOn(evaluator, 'evaluateHighlights');

    await runChannelHighlights({ con, now });

    expect(evaluatorSpy).not.toHaveBeenCalled();
    const canonicalHighlights = await con
      .getRepository(HighlightsCanonical)
      .find();
    expect(canonicalHighlights).toEqual([
      expect.objectContaining({
        postId: 'col-upgrade',
        channels: ['vibes'],
        headline: 'Original child headline',
        significance: HighlightSignificance.Major,
        reason: 'existing',
      }),
    ]);
    expect(canonicalHighlights[0].updatedAt.getTime()).toBeGreaterThan(
      originalCanonicalUpdatedAt.getTime(),
    );
  });

  it('should ignore posts from channel digest sources', async () => {
    const now = new Date('2026-03-03T14:00:00.000Z');
    await con
      .getRepository(Source)
      .save(
        createSource(
          AGENTS_DIGEST_SOURCE,
          'Agents Digest',
          'https://daily.dev/agents.png',
        ),
      );
    await con.getRepository(ChannelDigest).save({
      key: 'vibes-daily',
      channel: 'vibes',
      sourceId: AGENTS_DIGEST_SOURCE,
      targetAudience: 'Developers',
      enabled: true,
      frequency: 'daily',
      includeSentiment: false,
      minHighlightScore: null,
      sentimentGroupIds: [],
    });
    await saveArticle({
      id: 'digest-post',
      sourceId: AGENTS_DIGEST_SOURCE,
      title: 'Digest post',
      createdAt: new Date('2026-03-03T13:45:00.000Z'),
    });
    await saveArticle({
      id: 'regular-post',
      title: 'Regular post',
      createdAt: new Date('2026-03-03T13:50:00.000Z'),
    });

    const evaluatorSpy = jest
      .spyOn(evaluator, 'evaluateHighlights')
      .mockResolvedValue({ items: [] });

    await runChannelHighlights({ con, now });

    expect(evaluatorSpy).toHaveBeenCalledTimes(1);
    expect(evaluatorSpy.mock.calls[0][0].newCandidates).toEqual([
      expect.objectContaining({
        postId: 'regular-post',
      }),
    ]);
  });

  it('should replace unknown-source candidates with the most upvoted public share before evaluation', async () => {
    const now = new Date('2026-03-03T15:00:00.000Z');
    await con
      .getRepository(Source)
      .save(
        createSource(
          UNKNOWN_SOURCE,
          'Unknown',
          'https://daily.dev/unknown.png',
          undefined,
          true,
        ),
      );
    await saveArticle({
      id: 'unknown-under',
      sourceId: UNKNOWN_SOURCE,
      title: 'Unknown source story',
      createdAt: new Date('2026-03-03T14:30:00.000Z'),
    });
    await saveShare({
      id: 'pshare-low',
      sharedPostId: 'unknown-under',
      createdAt: new Date('2026-03-03T14:35:00.000Z'),
      upvotes: 1,
    });
    await saveShare({
      id: 'pshare-high',
      sharedPostId: 'unknown-under',
      createdAt: new Date('2026-03-03T14:40:00.000Z'),
      upvotes: 3,
    });

    const evaluatorSpy = jest
      .spyOn(evaluator, 'evaluateHighlights')
      .mockResolvedValue({ items: [] });

    await runChannelHighlights({ con, now });

    expect(evaluatorSpy).toHaveBeenCalledTimes(1);
    expect(evaluatorSpy.mock.calls[0][0].newCandidates).toEqual([
      expect.objectContaining({
        postId: 'pshare-high',
        title: 'Unknown source story',
      }),
    ]);
  });

  it('should not evaluate a candidate until it has a summary', async () => {
    const now = new Date('2026-03-03T16:00:00.000Z');
    await saveArticle({
      id: 'summarized',
      title: 'Summarized story',
      summary: 'A concise summary of what happened.',
      createdAt: new Date('2026-03-03T15:45:00.000Z'),
    });
    await saveArticle({
      id: 'no-summary',
      title: 'Pending summary story',
      summary: null,
      createdAt: new Date('2026-03-03T15:50:00.000Z'),
    });

    const evaluatorSpy = jest
      .spyOn(evaluator, 'evaluateHighlights')
      .mockResolvedValue({ items: [] });

    await runChannelHighlights({ con, now });

    expect(evaluatorSpy).toHaveBeenCalledTimes(1);
    expect(evaluatorSpy.mock.calls[0][0].newCandidates).toEqual([
      expect.objectContaining({ postId: 'summarized' }),
    ]);
  });

  it('should evaluate a public share using the referred post summary', async () => {
    const now = new Date('2026-03-03T17:00:00.000Z');
    await con
      .getRepository(Source)
      .save(
        createSource(
          UNKNOWN_SOURCE,
          'Unknown',
          'https://daily.dev/unknown.png',
          undefined,
          true,
        ),
      );
    await saveArticle({
      id: 'under-summ',
      sourceId: UNKNOWN_SOURCE,
      title: 'Referred story',
      summary: 'The referred post carries the summary.',
      createdAt: new Date('2026-03-03T16:30:00.000Z'),
    });
    await saveShare({
      id: 'pshare-summ',
      sharedPostId: 'under-summ',
      createdAt: new Date('2026-03-03T16:35:00.000Z'),
      upvotes: 2,
    });

    const evaluatorSpy = jest
      .spyOn(evaluator, 'evaluateHighlights')
      .mockResolvedValue({ items: [] });

    await runChannelHighlights({ con, now });

    expect(evaluatorSpy).toHaveBeenCalledTimes(1);
    expect(evaluatorSpy.mock.calls[0][0].newCandidates).toEqual([
      expect.objectContaining({
        postId: 'pshare-summ',
        summary: 'The referred post carries the summary.',
      }),
    ]);
  });
});
