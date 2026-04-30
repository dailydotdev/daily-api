import { IsNull, type DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { ChannelHighlightDefinition } from '../../src/entity/ChannelHighlightDefinition';
import { AGENTS_DIGEST_SOURCE } from '../../src/entity/Source';
import {
  PostHighlight,
  PostHighlightSignificance,
} from '../../src/entity/PostHighlight';
import { PostHighlightChannel } from '../../src/entity/PostHighlightChannel';
import { ArticlePost, Source } from '../../src/entity';
import { PostType } from '../../src/entity/posts/Post';
import worker from '../../src/workers/generateChannelHighlight';
import { typedWorkers } from '../../src/workers/index';
import { deleteKeysByPattern } from '../../src/redis';
import * as evaluator from '../../src/common/channelHighlight/evaluate';
import * as typedPubsub from '../../src/common/typedPubsub';
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
  channels,
}: {
  id: string;
  title: string;
  createdAt: Date;
  channels: string[];
}) =>
  con.getRepository(ArticlePost).save({
    id,
    shortId: id,
    title,
    url: `https://example.com/${id}`,
    canonicalUrl: `https://example.com/${id}`,
    score: 0,
    sourceId: 'content-source',
    visible: true,
    deleted: false,
    banned: false,
    showOnFeed: true,
    createdAt,
    metadataChangedAt: createdAt,
    statsUpdatedAt: createdAt,
    type: PostType.Article,
    contentMeta: {
      channels,
    },
  });

describe('generateChannelHighlight worker', () => {
  beforeEach(async () => {
    jest.restoreAllMocks();
    await con.getRepository(Source).save([
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
  });

  afterEach(async () => {
    await deleteKeysByPattern('highlights:*');
    await con.getRepository(PostHighlightChannel).clear();
    await con.createQueryBuilder().delete().from(PostHighlight).execute();
    await con.getRepository(ChannelHighlightDefinition).clear();
    await con
      .createQueryBuilder()
      .delete()
      .from('post')
      .where('"sourceId" IN (:...sourceIds)', {
        sourceIds: ['content-source', AGENTS_DIGEST_SOURCE],
      })
      .execute();
    await con
      .getRepository(Source)
      .delete(['content-source', AGENTS_DIGEST_SOURCE]);
  });

  it('should be registered', () => {
    const registeredWorker = typedWorkers.find(
      (item) => item.subscription === worker.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should create one canonical highlight and place it in every matching publish channel', async () => {
    const now = new Date('2026-03-03T12:00:00.000Z');
    const triggerTypedEventSpy = jest
      .spyOn(typedPubsub, 'triggerTypedEvent')
      .mockResolvedValue();

    await con.getRepository(ChannelHighlightDefinition).save([
      {
        channel: 'backend',
        mode: 'publish',
        order: 1,
        candidateHorizonHours: 72,
        maxItems: 3,
      },
      {
        channel: 'vibes',
        mode: 'publish',
        order: 2,
        candidateHorizonHours: 72,
        maxItems: 3,
      },
    ]);
    await saveArticle({
      id: 'fresh-1',
      title: 'Fresh story',
      createdAt: new Date('2026-03-03T11:30:00.000Z'),
      channels: ['backend', 'vibes'],
    });

    jest.spyOn(evaluator, 'evaluateChannelHighlights').mockResolvedValue({
      items: [
        {
          postId: 'fresh-1',
          headline: 'Fresh highlight',
          significanceLabel: 'breaking',
        },
      ],
    });

    await expectSuccessfulTypedBackground<'api.v1.generate-highlights'>(
      worker,
      {
        scheduledAt: now.toISOString(),
      },
    );

    const highlight = await con.getRepository(PostHighlight).findOneByOrFail({
      postId: 'fresh-1',
    });
    const placements = await con.getRepository(PostHighlightChannel).find({
      where: {
        highlightId: highlight.id,
        retiredAt: IsNull(),
      },
      order: {
        channel: 'ASC',
      },
    });

    expect(highlight).toMatchObject({
      postId: 'fresh-1',
      channel: 'backend',
      headline: 'Fresh highlight',
      significance: PostHighlightSignificance.Breaking,
      retiredAt: null,
    });
    expect(placements).toEqual([
      expect.objectContaining({
        highlightId: highlight.id,
        channel: 'backend',
      }),
      expect.objectContaining({
        highlightId: highlight.id,
        channel: 'vibes',
      }),
    ]);
    expect(triggerTypedEventSpy).toHaveBeenCalledWith(
      expect.anything(),
      'api.v1.highlight-created',
      {
        highlightId: highlight.id,
        postId: 'fresh-1',
        headline: 'Fresh highlight',
        significance: PostHighlightSignificance.Breaking,
        highlightedAt: now.toISOString(),
      },
    );
  });

  it('should skip persistence when only shadow channels match', async () => {
    const now = new Date('2026-03-03T12:00:00.000Z');
    const triggerTypedEventSpy = jest
      .spyOn(typedPubsub, 'triggerTypedEvent')
      .mockResolvedValue();

    await con.getRepository(ChannelHighlightDefinition).save({
      channel: 'backend',
      mode: 'shadow',
      candidateHorizonHours: 72,
      maxItems: 3,
    });
    await saveArticle({
      id: 'shadow-1',
      title: 'Shadow story',
      createdAt: new Date('2026-03-03T11:30:00.000Z'),
      channels: ['backend'],
    });

    jest.spyOn(evaluator, 'evaluateChannelHighlights').mockResolvedValue({
      items: [
        {
          postId: 'shadow-1',
          headline: 'Shadow highlight',
          significanceLabel: 'major',
        },
      ],
    });

    await expectSuccessfulTypedBackground<'api.v1.generate-highlights'>(
      worker,
      {
        scheduledAt: now.toISOString(),
      },
    );

    expect(await con.getRepository(PostHighlight).count()).toBe(0);
    expect(await con.getRepository(PostHighlightChannel).count()).toBe(0);
    expect(triggerTypedEventSpy).not.toHaveBeenCalledWith(
      expect.anything(),
      'api.v1.highlight-created',
      expect.anything(),
    );
  });

  it('should retire displaced highlights when a newer published story takes the only slot', async () => {
    const now = new Date('2026-03-03T12:00:00.000Z');

    await con.getRepository(ChannelHighlightDefinition).save({
      channel: 'backend',
      mode: 'publish',
      candidateHorizonHours: 72,
      maxItems: 1,
    });
    await saveArticle({
      id: 'old-1',
      title: 'Old story',
      createdAt: new Date('2026-03-03T09:00:00.000Z'),
      channels: ['backend'],
    });
    await saveArticle({
      id: 'fresh-2',
      title: 'Fresh story',
      createdAt: new Date('2026-03-03T11:30:00.000Z'),
      channels: ['backend'],
    });

    const oldHighlight = await con.getRepository(PostHighlight).save({
      postId: 'old-1',
      channel: 'backend',
      highlightedAt: new Date('2026-03-03T10:00:00.000Z'),
      headline: 'Old highlight',
      significance: PostHighlightSignificance.Major,
    });
    await con.getRepository(PostHighlightChannel).save({
      highlightId: oldHighlight.id,
      channel: 'backend',
      placedAt: oldHighlight.highlightedAt,
    });

    jest.spyOn(evaluator, 'evaluateChannelHighlights').mockResolvedValue({
      items: [
        {
          postId: 'fresh-2',
          headline: 'Fresh replacement',
          significanceLabel: 'major',
        },
      ],
    });

    await expectSuccessfulTypedBackground<'api.v1.generate-highlights'>(
      worker,
      {
        scheduledAt: now.toISOString(),
      },
    );

    const retiredHighlight = await con.getRepository(PostHighlight).findOneByOrFail(
      {
        postId: 'old-1',
      },
    );
    const freshHighlight = await con.getRepository(PostHighlight).findOneByOrFail({
      postId: 'fresh-2',
    });
    const retiredPlacement = await con
      .getRepository(PostHighlightChannel)
      .findOneByOrFail({
        highlightId: oldHighlight.id,
        channel: 'backend',
      });

    expect(retiredHighlight.retiredAt).toBeInstanceOf(Date);
    expect(retiredPlacement.retiredAt).toBeInstanceOf(Date);
    expect(freshHighlight).toMatchObject({
      postId: 'fresh-2',
      retiredAt: null,
      headline: 'Fresh replacement',
      significance: PostHighlightSignificance.Major,
    });
  });
});
