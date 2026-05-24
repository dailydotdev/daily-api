import { IsNull, type DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { ChannelDigest } from '../../src/entity/ChannelDigest';
import { ChannelHighlightDefinition } from '../../src/entity/ChannelHighlightDefinition';
import { ChannelHighlightRun } from '../../src/entity/ChannelHighlightRun';
import { HighlightsCanonical } from '../../src/entity/HighlightsCanonical';
import { AGENTS_DIGEST_SOURCE, UNKNOWN_SOURCE } from '../../src/entity/Source';
import {
  PostHighlight,
  PostHighlightSignificance,
} from '../../src/entity/PostHighlight';
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
  channel = 'vibes',
  channels = [channel],
  sourceId = 'content-source',
  contentCuration = [] as string[],
  summary,
}: {
  id: string;
  title: string;
  createdAt: Date;
  statsUpdatedAt?: Date;
  metadataChangedAt?: Date;
  channel?: string;
  channels?: string[];
  sourceId?: string;
  contentCuration?: string[];
  summary?: string;
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
  channel = 'vibes',
  channels = [channel],
  sourceId = 'content-source',
}: {
  id: string;
  title: string;
  createdAt: Date;
  channel?: string;
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
    await con.getRepository(ChannelHighlightDefinition).clear();
    await con.getRepository(ChannelDigest).clear();
    await con.getRepository(HighlightsCanonical).clear();
    await con.getRepository(PostHighlight).clear();
    await con.getRepository(PostRelation).clear();
    await con
      .createQueryBuilder()
      .delete()
      .from('post')
      .where('"sourceId" IN (:...sourceIds)', {
        sourceIds: ['content-source', 'secondary-source', AGENTS_DIGEST_SOURCE],
      })
      .execute();
    await con
      .getRepository(Source)
      .delete(['content-source', 'secondary-source', AGENTS_DIGEST_SOURCE]);
  });

  it('should be registered', () => {
    const registeredCron = crons.find(
      (item) => item.name === channelHighlights.name,
    );

    expect(registeredCron).toBeDefined();
  });

  it('should generate highlights for active definitions', async () => {
    await con.getRepository(ChannelHighlightDefinition).save([
      {
        channel: 'backend',
        mode: 'shadow',
        candidateHorizonHours: 72,
        maxItems: 10,
      },
      {
        channel: 'vibes',
        mode: 'shadow',
        candidateHorizonHours: 72,
        maxItems: 10,
      },
      {
        channel: 'disabled',
        mode: 'disabled',
        candidateHorizonHours: 72,
        maxItems: 10,
      },
    ]);

    const startedAt = Date.now();
    await channelHighlights.handler(con, {} as never, {} as never);
    const completedAt = Date.now();

    const runs = await con.getRepository(ChannelHighlightRun).find({
      order: { channel: 'ASC' },
    });
    expect(runs).toMatchObject([
      {
        channel: 'global',
        status: 'completed',
      },
    ]);

    for (const run of runs) {
      expect(run.scheduledAt.getTime()).toBeGreaterThanOrEqual(startedAt);
      expect(run.scheduledAt.getTime()).toBeLessThanOrEqual(completedAt);
    }
  });

  it('should generate canonical highlights without legacy definitions', async () => {
    const now = new Date('2026-03-03T10:00:00.000Z');
    await saveArticle({
      id: 'defless-1',
      title: 'Definitionless story',
      createdAt: new Date('2026-03-03T09:45:00.000Z'),
      channels: ['backend', 'vibes'],
    });

    const evaluatorSpy = jest
      .spyOn(evaluator, 'evaluateHighlights')
      .mockResolvedValue({
        items: [
          {
            postId: 'defless-1',
            headline: 'Definitionless headline',
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
        postId: 'defless-1',
        title: 'Definitionless story',
      }),
    ]);

    const canonicalHighlights = await con
      .getRepository(HighlightsCanonical)
      .find();
    expect(canonicalHighlights).toEqual([
      expect.objectContaining({
        postId: 'defless-1',
        channels: ['backend', 'vibes'],
        headline: 'Definitionless headline',
        significance: PostHighlightSignificance.Major,
        reason: 'test',
      }),
    ]);

    const liveHighlights = await con.getRepository(PostHighlight).find();
    expect(liveHighlights).toEqual([]);

    const runs = await con.getRepository(ChannelHighlightRun).find();
    expect(runs).toMatchObject([
      {
        channel: 'global',
        status: 'completed',
      },
    ]);
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
      summary: 'Live story summary',
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
      .spyOn(evaluator, 'evaluateHighlights')
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

    await runChannelHighlights({ con, now });

    expect(evaluatorSpy).toHaveBeenCalledTimes(1);
    expect(evaluatorSpy.mock.calls[0][0].maxItems).toBe(20);
    expect(evaluatorSpy.mock.calls[0][0].currentHighlights).toEqual([]);
    expect(evaluatorSpy.mock.calls[0][0].newCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          postId: 'fresh-1',
          title: 'Fresh story',
          relatedItemsCount: 1,
        }),
      ]),
    );

    const liveHighlights = await con.getRepository(PostHighlight).find({
      where: { channel: 'vibes', retiredAt: IsNull() },
      order: { highlightedAt: 'DESC' },
    });
    expect(liveHighlights).toHaveLength(1);
    expect(liveHighlights[0]).toMatchObject({
      postId: 'live-1',
      headline: 'Live headline',
    });

    const canonicalHighlights = await con
      .getRepository(HighlightsCanonical)
      .find({
        order: { highlightedAt: 'DESC' },
      });
    expect(canonicalHighlights).toEqual([
      expect.objectContaining({
        postId: 'fresh-1',
        channels: ['vibes'],
        headline: 'Fresh headline',
        significance: PostHighlightSignificance.Breaking,
        reason: 'test',
      }),
    ]);

    const run = await con.getRepository(ChannelHighlightRun).findOneByOrFail({
      channel: 'global',
    });
    expect(run.status).toBe('completed');
    expect(run.comparison).toMatchObject({
      wouldPublish: true,
      published: true,
      baselineCount: 0,
      internalCount: 1,
      addedPostIds: ['fresh-1'],
    });
  });

  it('should send global canonical highlight history to the evaluator', async () => {
    const now = new Date('2026-03-03T10:00:00.000Z');
    await con.getRepository(ChannelHighlightDefinition).save({
      channel: 'vibes',
      mode: 'shadow',
      candidateHorizonHours: 72,
      maxItems: 3,
    });
    await saveArticle({
      id: 'legacy-only',
      title: 'Legacy only story',
      summary: 'Legacy only summary',
      createdAt: new Date('2026-03-03T08:00:00.000Z'),
    });
    await saveArticle({
      id: 'canonical-1',
      title: 'Canonical story',
      summary: 'Canonical summary',
      createdAt: new Date('2026-03-03T08:30:00.000Z'),
    });
    await saveArticle({
      id: 'fresh-1',
      title: 'Fresh story',
      createdAt: new Date('2026-03-03T09:20:00.000Z'),
    });
    await con.getRepository(PostHighlight).save({
      channel: 'vibes',
      postId: 'legacy-only',
      highlightedAt: new Date('2026-03-03T09:00:00.000Z'),
      headline: 'Legacy only headline',
    });
    await con.getRepository(HighlightsCanonical).save({
      postId: 'canonical-1',
      channels: ['backend'],
      highlightedAt: new Date('2026-03-03T09:10:00.000Z'),
      headline: 'Canonical headline',
      significance: PostHighlightSignificance.Major,
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
    await con.getRepository(HighlightsCanonical).save([
      {
        postId: 'new-live',
        channels: ['vibes'],
        highlightedAt: new Date('2026-03-03T10:00:00.000Z'),
        headline: 'Newer live headline',
      },
      {
        postId: 'old-live',
        channels: ['vibes'],
        highlightedAt: new Date('2026-03-03T09:00:00.000Z'),
        headline: 'Older live headline',
      },
    ]);

    jest.spyOn(evaluator, 'evaluateHighlights').mockResolvedValue({
      items: [
        {
          postId: 'fresh-1',
          headline: 'Fresh headline',
          significanceLabel: 'breaking',
          reason: 'test',
        },
      ],
    });

    await runChannelHighlights({ con, now });

    const liveHighlights = await con.getRepository(PostHighlight).find({
      where: { channel: 'vibes', retiredAt: IsNull() },
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
    const retiredHighlight = await con.getRepository(PostHighlight).findOneBy({
      channel: 'vibes',
      postId: 'old-live',
    });
    expect(retiredHighlight?.retiredAt).toBeInstanceOf(Date);

    const canonicalHighlights = await con
      .getRepository(HighlightsCanonical)
      .find({
        order: { highlightedAt: 'DESC' },
      });
    expect(canonicalHighlights).toEqual([
      expect.objectContaining({
        postId: 'fresh-1',
        channels: ['vibes'],
        headline: 'Fresh headline',
        significance: PostHighlightSignificance.Breaking,
        reason: 'test',
      }),
      expect.objectContaining({
        postId: 'new-live',
        channels: ['vibes'],
        headline: 'Newer live headline',
      }),
      expect.objectContaining({
        postId: 'old-live',
        channels: ['vibes'],
        headline: 'Older live headline',
      }),
    ]);
  });

  it('should evaluate globally and fan out admitted highlights to all enabled post channels', async () => {
    const now = new Date('2026-03-03T11:10:00.000Z');
    await con.getRepository(ChannelHighlightDefinition).save([
      {
        channel: 'backend',
        mode: 'publish',
        candidateHorizonHours: 72,
        maxItems: 2,
      },
      {
        channel: 'vibes',
        mode: 'publish',
        candidateHorizonHours: 72,
        maxItems: 3,
      },
      {
        channel: 'disabled',
        mode: 'disabled',
        candidateHorizonHours: 72,
        maxItems: 3,
      },
    ]);
    await saveArticle({
      id: 'global-fresh',
      title: 'Global fresh story',
      createdAt: new Date('2026-03-03T10:55:00.000Z'),
      channels: ['backend', 'vibes', 'disabled'],
    });

    const evaluatorSpy = jest
      .spyOn(evaluator, 'evaluateHighlights')
      .mockResolvedValue({
        items: [
          {
            postId: 'global-fresh',
            headline: 'Global headline',
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
        postId: 'global-fresh',
        title: 'Global fresh story',
      }),
    ]);

    const liveHighlights = await con.getRepository(PostHighlight).find({
      where: { retiredAt: IsNull() },
      order: { channel: 'ASC' },
    });
    expect(liveHighlights).toEqual([
      expect.objectContaining({
        channel: 'backend',
        postId: 'global-fresh',
        headline: 'Global headline',
        significance: PostHighlightSignificance.Major,
      }),
      expect.objectContaining({
        channel: 'vibes',
        postId: 'global-fresh',
        headline: 'Global headline',
        significance: PostHighlightSignificance.Major,
      }),
    ]);
    const canonicalHighlights = await con
      .getRepository(HighlightsCanonical)
      .find();
    expect(canonicalHighlights).toEqual([
      expect.objectContaining({
        postId: 'global-fresh',
        channels: ['backend', 'disabled', 'vibes'],
        headline: 'Global headline',
        significance: PostHighlightSignificance.Major,
      }),
    ]);

    const runs = await con.getRepository(ChannelHighlightRun).find({
      order: { channel: 'ASC' },
    });
    expect(runs).toMatchObject([
      {
        channel: 'global',
        status: 'completed',
        comparison: expect.objectContaining({ published: true }),
      },
    ]);
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
    const originalCanonicalUpdatedAt = new Date('2026-03-03T10:30:00.000Z');
    const originalCanonical = await con
      .getRepository(HighlightsCanonical)
      .save({
        postId: 'child-upgrade',
        channels: ['vibes'],
        highlightedAt: new Date('2026-03-03T11:00:00.000Z'),
        headline: 'Original child headline',
        significance: PostHighlightSignificance.Major,
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

    const liveHighlights = await con.getRepository(PostHighlight).find({
      where: { channel: 'vibes', retiredAt: IsNull() },
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
    const retiredHighlight = await con.getRepository(PostHighlight).findOneBy({
      channel: 'vibes',
      postId: 'child-upgrade',
    });
    expect(retiredHighlight?.retiredAt).toBeInstanceOf(Date);
    const canonicalHighlights = await con
      .getRepository(HighlightsCanonical)
      .find();
    expect(canonicalHighlights).toEqual([
      expect.objectContaining({
        postId: 'col-upgrade',
        channels: ['vibes'],
        headline: 'Original child headline',
        significance: PostHighlightSignificance.Major,
        reason: 'existing',
      }),
    ]);
    expect(canonicalHighlights[0].updatedAt.getTime()).toBeGreaterThan(
      originalCanonicalUpdatedAt.getTime(),
    );
  });

  it('should exclude retired highlights from candidates and keep them retired', async () => {
    const now = new Date('2026-03-03T11:45:00.000Z');
    await con.getRepository(ChannelHighlightDefinition).save({
      channel: 'vibes',
      mode: 'publish',
      candidateHorizonHours: 72,
      maxItems: 3,
    });
    await saveArticle({
      id: 'retired-1',
      title: 'Previously highlighted story',
      createdAt: new Date('2026-03-03T11:15:00.000Z'),
    });
    await saveArticle({
      id: 'fresh-1',
      title: 'Fresh candidate',
      createdAt: new Date('2026-03-03T11:20:00.000Z'),
    });
    await con.getRepository(PostHighlight).save({
      channel: 'vibes',
      postId: 'retired-1',
      highlightedAt: new Date('2026-03-03T11:00:00.000Z'),
      headline: 'Previously highlighted headline',
      significance: PostHighlightSignificance.Major,
      reason: 'previous run',
      retiredAt: new Date('2026-03-03T11:10:00.000Z'),
    });

    const evaluatorSpy = jest
      .spyOn(evaluator, 'evaluateHighlights')
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

    await runChannelHighlights({ con, now });

    expect(evaluatorSpy).toHaveBeenCalledTimes(1);
    expect(evaluatorSpy.mock.calls[0][0].newCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          postId: 'fresh-1',
          title: 'Fresh candidate',
        }),
      ]),
    );

    const liveHighlights = await con.getRepository(PostHighlight).find({
      where: { channel: 'vibes', retiredAt: IsNull() },
    });
    expect(liveHighlights).toEqual([
      expect.objectContaining({
        postId: 'fresh-1',
        headline: 'Fresh headline',
      }),
    ]);

    const retiredHighlights = await con.getRepository(PostHighlight).find({
      where: { channel: 'vibes', postId: 'retired-1' },
    });
    expect(retiredHighlights).toHaveLength(1);
    expect(retiredHighlights[0].retiredAt).toBeInstanceOf(Date);
  });

  it('should send recent canonical history to the evaluator while excluding resurfaced stories', async () => {
    const now = new Date('2026-03-03T12:00:00.000Z');
    await con.getRepository(ChannelHighlightDefinition).save({
      channel: 'vibes',
      mode: 'shadow',
      candidateHorizonHours: 72,
      maxItems: 3,
    });
    await saveCollection({
      id: 'collection-1',
      title: 'Collection story',
      createdAt: new Date('2026-03-03T11:50:00.000Z'),
    });
    await saveArticle({
      id: 'retired-child',
      title: 'Retired child story',
      createdAt: new Date('2026-03-03T11:20:00.000Z'),
    });
    await saveArticle({
      id: 'fresh-child',
      title: 'Fresh child story',
      createdAt: new Date('2026-03-03T11:55:00.000Z'),
    });
    await saveArticle({
      id: 'fresh-stand-1',
      title: 'Fresh standalone story',
      createdAt: new Date('2026-03-03T11:58:00.000Z'),
    });
    await con.getRepository(PostRelation).save([
      {
        postId: 'collection-1',
        relatedPostId: 'retired-child',
        type: PostRelationType.Collection,
      },
      {
        postId: 'collection-1',
        relatedPostId: 'fresh-child',
        type: PostRelationType.Collection,
      },
    ]);
    await con.getRepository(PostHighlight).save({
      channel: 'vibes',
      postId: 'retired-child',
      highlightedAt: new Date('2026-03-03T11:30:00.000Z'),
      headline: 'Retired child headline',
      significance: PostHighlightSignificance.Notable,
      retiredAt: new Date('2026-03-03T11:40:00.000Z'),
    });
    await con.getRepository(HighlightsCanonical).save({
      postId: 'retired-child',
      channels: ['vibes'],
      highlightedAt: new Date('2026-03-03T11:30:00.000Z'),
      headline: 'Retired child headline',
      significance: PostHighlightSignificance.Notable,
    });

    const evaluatorSpy = jest
      .spyOn(evaluator, 'evaluateHighlights')
      .mockResolvedValue({ items: [] });

    await runChannelHighlights({ con, now });

    expect(evaluatorSpy).toHaveBeenCalledTimes(1);
    expect(evaluatorSpy.mock.calls[0][0].currentHighlights).toEqual([
      expect.objectContaining({
        postId: 'collection-1',
        headline: 'Retired child headline',
      }),
    ]);
    expect(evaluatorSpy.mock.calls[0][0].newCandidates).toEqual([
      expect.objectContaining({
        postId: 'fresh-stand-1',
        title: 'Fresh standalone story',
      }),
    ]);
  });

  it('should keep an accessible underlying article as the highlight postId when a public share appears later', async () => {
    const now = new Date('2026-03-03T12:00:00.000Z');
    await con.getRepository(ChannelHighlightDefinition).save({
      channel: 'vibes',
      mode: 'publish',
      candidateHorizonHours: 72,
      maxItems: 3,
    });
    // The article is highlighted on its underlying postId at run time.
    await saveArticle({
      id: 'underlying-1',
      title: 'Original article',
      createdAt: new Date('2026-03-03T11:00:00.000Z'),
    });
    await con.getRepository(PostHighlight).save({
      channel: 'vibes',
      postId: 'underlying-1',
      highlightedAt: new Date('2026-03-03T11:30:00.000Z'),
      headline: 'Original headline',
      significance: PostHighlightSignificance.Major,
      reason: 'previous run',
    });
    await con.getRepository(HighlightsCanonical).save({
      postId: 'underlying-1',
      channels: ['vibes'],
      highlightedAt: new Date('2026-03-03T11:30:00.000Z'),
      headline: 'Original headline',
      significance: PostHighlightSignificance.Major,
      reason: 'previous run',
    });
    // A user shares the article between runs.
    await saveShare({
      id: 'share-1',
      sharedPostId: 'underlying-1',
      createdAt: new Date('2026-03-03T11:50:00.000Z'),
      upvotes: 5,
    });

    jest
      .spyOn(evaluator, 'evaluateHighlights')
      .mockResolvedValue({ items: [] });

    await runChannelHighlights({ con, now });

    const allRows = await con.getRepository(PostHighlight).find({
      where: { channel: 'vibes' },
    });
    expect(allRows).toHaveLength(1);
    expect(allRows[0]).toMatchObject({
      postId: 'underlying-1',
      retiredAt: null,
    });
  });

  it('should downgrade a SharePost-stored highlight back to its underlying article when accessible', async () => {
    const now = new Date('2026-03-03T12:00:00.000Z');
    await con.getRepository(ChannelHighlightDefinition).save({
      channel: 'vibes',
      mode: 'publish',
      candidateHorizonHours: 72,
      maxItems: 3,
    });
    await saveArticle({
      id: 'underlying-2',
      title: 'Underlying article',
      createdAt: new Date('2026-03-03T11:00:00.000Z'),
    });
    await saveShare({
      id: 'share-2',
      sharedPostId: 'underlying-2',
      createdAt: new Date('2026-03-03T11:20:00.000Z'),
    });
    // Legacy row: highlight previously stored on the share post ID.
    await con.getRepository(PostHighlight).save({
      channel: 'vibes',
      postId: 'share-2',
      highlightedAt: new Date('2026-03-03T11:30:00.000Z'),
      headline: 'Legacy share headline',
      significance: PostHighlightSignificance.Major,
      reason: 'pre-fix run',
    });
    await con.getRepository(HighlightsCanonical).save({
      postId: 'share-2',
      channels: ['vibes'],
      highlightedAt: new Date('2026-03-03T11:30:00.000Z'),
      headline: 'Legacy share headline',
      significance: PostHighlightSignificance.Major,
      reason: 'pre-fix run',
    });

    jest
      .spyOn(evaluator, 'evaluateHighlights')
      .mockResolvedValue({ items: [] });

    await runChannelHighlights({ con, now });

    const liveRows = await con.getRepository(PostHighlight).find({
      where: { channel: 'vibes', retiredAt: IsNull() },
    });
    expect(liveRows).toEqual([
      expect.objectContaining({
        postId: 'underlying-2',
        headline: 'Legacy share headline',
      }),
    ]);
    const retiredRows = await con.getRepository(PostHighlight).find({
      where: { channel: 'vibes', postId: 'share-2' },
    });
    expect(retiredRows).toHaveLength(1);
    expect(retiredRows[0].retiredAt).toBeInstanceOf(Date);
  });

  it('should drop admitted candidates that race with collection regeneration', async () => {
    const now = new Date('2026-03-15T12:00:00.000Z');
    await con.getRepository(ChannelHighlightDefinition).save({
      channel: 'vibes',
      mode: 'publish',
      candidateHorizonHours: 72,
      maxItems: 3,
    });
    await saveCollection({
      id: 'collection-cve',
      title: 'CVE collection',
      createdAt: new Date('2026-02-15T10:00:00.000Z'),
    });
    // Existing canonical story is a child that now belongs to the collection.
    await saveArticle({
      id: 'old-child',
      title: 'Original CVE writeup',
      createdAt: new Date('2026-02-15T10:00:00.000Z'),
    });
    await con.getRepository(PostRelation).save({
      postId: 'collection-cve',
      relatedPostId: 'old-child',
      type: PostRelationType.Collection,
    });
    await con.getRepository(PostHighlight).save({
      channel: 'vibes',
      postId: 'old-child',
      highlightedAt: new Date('2026-02-15T10:30:00.000Z'),
      headline: 'Original CVE headline',
      significance: PostHighlightSignificance.Major,
      reason: 'first run',
      retiredAt: new Date('2026-02-15T20:00:00.000Z'),
    });
    await con.getRepository(HighlightsCanonical).save({
      postId: 'old-child',
      channels: ['vibes'],
      highlightedAt: new Date('2026-03-15T11:30:00.000Z'),
      headline: 'Original CVE headline',
      significance: PostHighlightSignificance.Major,
      reason: 'first run',
    });
    // Brand-new child article. Its relation to the collection is created
    // *after* fetchRelations runs (simulated below) — exactly the race
    // observed in production for collection NB1YEYCZ6 on 2026-05-06.
    await saveArticle({
      id: 'new-child',
      title: 'New video on the same CVE',
      createdAt: new Date('2026-03-15T11:55:00.000Z'),
    });

    const evaluatorSpy = jest
      .spyOn(evaluator, 'evaluateHighlights')
      .mockImplementation(async () => {
        await con.getRepository(PostRelation).save({
          postId: 'collection-cve',
          relatedPostId: 'new-child',
          type: PostRelationType.Collection,
        });
        return {
          items: [
            {
              postId: 'new-child',
              headline: 'Same CVE, different child',
              significanceLabel: 'major',
              reason: 'test',
            },
          ],
        };
      });

    await runChannelHighlights({ con, now });

    // The candidate reached the evaluator (the race-affected fetchRelations
    // sees no collection-cve relation for new-child yet).
    expect(evaluatorSpy).toHaveBeenCalledTimes(1);
    expect(evaluatorSpy.mock.calls[0][0].newCandidates).toEqual([
      expect.objectContaining({ postId: 'new-child' }),
    ]);

    // The admit-time guard re-fetches relations and drops the duplicate,
    // leaving the canonical collection projected into legacy.
    const liveHighlights = await con.getRepository(PostHighlight).find({
      where: { channel: 'vibes', retiredAt: IsNull() },
    });
    expect(liveHighlights).toEqual([
      expect.objectContaining({
        postId: 'collection-cve',
        headline: 'Original CVE headline',
      }),
    ]);

    const allHighlightsForNewChild = await con
      .getRepository(PostHighlight)
      .find({
        where: { channel: 'vibes', postId: 'new-child' },
      });
    expect(allHighlightsForNewChild).toHaveLength(0);

    const retiredHighlights = await con.getRepository(PostHighlight).find({
      where: { channel: 'vibes', postId: 'old-child' },
    });
    expect(retiredHighlights).toHaveLength(1);
    expect(retiredHighlights[0].retiredAt).toBeInstanceOf(Date);
  });

  it('should ignore posts from channel digest sources for highlights', async () => {
    const now = new Date('2026-03-03T11:50:00.000Z');
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
      key: 'agentic',
      sourceId: AGENTS_DIGEST_SOURCE,
      channel: 'vibes',
      targetAudience: 'Digest readers',
      frequency: 'daily',
      enabled: true,
    });
    await con.getRepository(ChannelHighlightDefinition).save({
      channel: 'vibes',
      mode: 'publish',
      candidateHorizonHours: 72,
      maxItems: 3,
    });
    await saveArticle({
      id: 'digest-post',
      sourceId: AGENTS_DIGEST_SOURCE,
      title: 'Digest source post',
      createdAt: new Date('2026-03-03T11:20:00.000Z'),
    });
    await saveArticle({
      id: 'fresh-1',
      title: 'Fresh candidate',
      createdAt: new Date('2026-03-03T11:25:00.000Z'),
    });
    await con.getRepository(PostHighlight).save({
      channel: 'vibes',
      postId: 'digest-post',
      highlightedAt: new Date('2026-03-03T11:10:00.000Z'),
      headline: 'Digest highlight',
      significance: PostHighlightSignificance.Major,
      reason: 'existing',
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
    expect(evaluatorSpy.mock.calls[0][0].newCandidates).toEqual([
      expect.objectContaining({
        postId: 'fresh-1',
      }),
    ]);

    const liveHighlights = await con.getRepository(PostHighlight).find({
      where: { channel: 'vibes', retiredAt: IsNull() },
    });
    expect(liveHighlights).toEqual([
      expect.objectContaining({
        postId: 'fresh-1',
        headline: 'Fresh headline',
      }),
    ]);

    const retiredDigestHighlight = await con
      .getRepository(PostHighlight)
      .findOneByOrFail({
        channel: 'vibes',
        postId: 'digest-post',
      });
    expect(retiredDigestHighlight.retiredAt).toBeInstanceOf(Date);
  });

  it('should remove legacy highlights that aged past the projection horizon', async () => {
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
      createdAt: new Date('2026-01-01T10:00:00.000Z'),
    });
    await con.getRepository(PostHighlight).save({
      channel: 'vibes',
      postId: 'expired-live',
      highlightedAt: new Date('2026-03-02T10:00:00.000Z'),
      headline: 'Expired headline',
    });

    const evaluatorSpy = jest.spyOn(evaluator, 'evaluateHighlights');

    await runChannelHighlights({ con, now });

    expect(evaluatorSpy).not.toHaveBeenCalled();

    const liveHighlights = await con.getRepository(PostHighlight).find({
      where: { channel: 'vibes', retiredAt: IsNull() },
    });
    expect(liveHighlights).toEqual([]);
    const retiredHighlight = await con.getRepository(PostHighlight).findOneBy({
      channel: 'vibes',
      postId: 'expired-live',
    });
    expect(retiredHighlight?.retiredAt).toBeInstanceOf(Date);
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
      .spyOn(evaluator, 'evaluateHighlights')
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

    await runChannelHighlights({ con, now });

    expect(evaluatorSpy).toHaveBeenCalledTimes(1);
    expect(evaluatorSpy.mock.calls[0][0].newCandidates).toEqual([
      expect.objectContaining({
        postId: 'fresh-1',
        title: 'Fresh candidate',
        relatedItemsCount: 1,
      }),
    ]);
  });

  it('should replace unknown-source candidates with the most upvoted public share before evaluation', async () => {
    const now = new Date('2026-03-03T12:40:00.000Z');
    await con.getRepository(ChannelHighlightDefinition).save({
      channel: 'vibes',
      mode: 'publish',
      candidateHorizonHours: 72,
      maxItems: 3,
    });
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
      id: 'unk-orig-1',
      sourceId: UNKNOWN_SOURCE,
      title: 'Unknown source story',
      createdAt: new Date('2026-03-03T12:20:00.000Z'),
    });
    await saveShare({
      id: 'pub-share-1',
      sharedPostId: 'unk-orig-1',
      createdAt: new Date('2026-03-03T12:26:00.000Z'),
      upvotes: 25,
    });
    await saveShare({
      id: 'pub-share-2',
      sharedPostId: 'unk-orig-1',
      createdAt: new Date('2026-03-03T12:25:00.000Z'),
      upvotes: 50,
    });
    await saveShare({
      id: 'priv-share1',
      sharedPostId: 'unk-orig-1',
      createdAt: new Date('2026-03-03T12:27:00.000Z'),
      upvotes: 100,
      private: true,
    });

    const evaluatorSpy = jest
      .spyOn(evaluator, 'evaluateHighlights')
      .mockImplementation(async ({ newCandidates }) => ({
        items: [
          {
            postId: newCandidates[0].postId,
            headline: 'Shared headline',
            significanceLabel: 'breaking',
            reason: 'test',
          },
        ],
      }));

    await runChannelHighlights({ con, now });

    expect(evaluatorSpy).toHaveBeenCalledTimes(1);
    expect(evaluatorSpy.mock.calls[0][0].newCandidates).toEqual([
      expect.objectContaining({
        postId: 'pub-share-2',
        title: 'Unknown source story',
      }),
    ]);

    const liveHighlights = await con.getRepository(PostHighlight).find({
      where: { channel: 'vibes', retiredAt: IsNull() },
    });
    expect(liveHighlights).toEqual([
      expect.objectContaining({
        postId: 'pub-share-2',
        headline: 'Shared headline',
        significance: PostHighlightSignificance.Breaking,
        reason: 'test',
      }),
    ]);
  });

  it('should skip unknown-source candidates when no public share exists', async () => {
    const now = new Date('2026-03-03T12:41:00.000Z');
    await con.getRepository(ChannelHighlightDefinition).save({
      channel: 'vibes',
      mode: 'publish',
      candidateHorizonHours: 72,
      maxItems: 3,
    });
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
      id: 'unk-orig-2',
      sourceId: UNKNOWN_SOURCE,
      title: 'Unknown source story 2',
      createdAt: new Date('2026-03-03T12:21:00.000Z'),
    });
    await saveShare({
      id: 'priv-share2',
      sharedPostId: 'unk-orig-2',
      createdAt: new Date('2026-03-03T12:28:00.000Z'),
      upvotes: 100,
      private: true,
    });

    const evaluatorSpy = jest.spyOn(evaluator, 'evaluateHighlights');

    await runChannelHighlights({ con, now });

    expect(evaluatorSpy).not.toHaveBeenCalled();

    const liveHighlights = await con.getRepository(PostHighlight).find({
      where: { channel: 'vibes', retiredAt: IsNull() },
    });
    expect(liveHighlights).toEqual([]);
  });

  it('should exclude posts refreshed only by stats updates from incremental candidates', async () => {
    const now = new Date('2026-03-03T12:45:00.000Z');
    await con.getRepository(ChannelHighlightDefinition).save({
      channel: 'vibes',
      mode: 'shadow',
      candidateHorizonHours: 72,
      maxItems: 3,
    });
    await con.getRepository(ChannelHighlightRun).save({
      channel: 'global',
      scheduledAt: new Date('2026-03-03T12:20:00.000Z'),
      status: 'completed',
      baselineSnapshot: [],
      inputSummary: {},
      internalSnapshot: [],
      comparison: {},
      metrics: {},
      completedAt: new Date('2026-03-03T12:21:00.000Z'),
    });
    await saveArticle({
      id: 'stats-only-1',
      title: 'Stats only refresh',
      createdAt: new Date('2026-03-02T12:00:00.000Z'),
      metadataChangedAt: new Date('2026-03-02T12:00:00.000Z'),
      statsUpdatedAt: new Date('2026-03-03T12:40:00.000Z'),
    });
    await saveArticle({
      id: 'fresh-1',
      title: 'Fresh candidate',
      createdAt: new Date('2026-03-03T12:30:00.000Z'),
    });

    const evaluatorSpy = jest
      .spyOn(evaluator, 'evaluateHighlights')
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

    await runChannelHighlights({ con, now });

    expect(evaluatorSpy).toHaveBeenCalledTimes(1);
    expect(evaluatorSpy.mock.calls[0][0].newCandidates).toEqual([
      expect.objectContaining({
        postId: 'fresh-1',
        title: 'Fresh candidate',
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
      .spyOn(evaluator, 'evaluateHighlights')
      .mockResolvedValue({ items: [] });

    await runChannelHighlights({ con, now });

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
