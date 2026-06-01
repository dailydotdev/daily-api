import type { DataSource } from 'typeorm';
import { sub } from 'date-fns';
import createOrGetConnection from '../../src/db';
import { expectSuccessfulCron } from '../helpers';
import { crons } from '../../src/cron/index';
import { ChannelHighlightRun } from '../../src/entity/ChannelHighlightRun';
import { PostHighlight } from '../../src/entity/PostHighlight';
import { ArticlePost, Source } from '../../src/entity';
import { PostType } from '../../src/entity/posts/Post';
import { createSource } from '../fixture/source';
import { cleanChannelHighlights } from '../../src/cron/cleanChannelHighlights';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

describe('cleanChannelHighlights cron', () => {
  beforeEach(async () => {
    await con
      .getRepository(Source)
      .save([
        createSource(
          'content-source',
          'Content',
          'https://daily.dev/content.png',
        ),
      ]);
    await con.getRepository(ArticlePost).save([
      {
        id: 'active-highlight',
        shortId: 'active-hl',
        title: 'Active highlight',
        url: 'https://example.com/active-highlight',
        canonicalUrl: 'https://example.com/active-highlight',
        score: 0,
        sourceId: 'content-source',
        visible: true,
        deleted: false,
        banned: false,
        showOnFeed: true,
        createdAt: new Date('2026-03-01T10:00:00.000Z'),
        metadataChangedAt: new Date('2026-03-01T10:00:00.000Z'),
        statsUpdatedAt: new Date('2026-03-01T10:00:00.000Z'),
        type: PostType.Article,
        contentMeta: {
          channels: ['vibes'],
        },
      },
      {
        id: 'retired-highlight',
        shortId: 'retired-hl',
        title: 'Retired highlight',
        url: 'https://example.com/retired-highlight',
        canonicalUrl: 'https://example.com/retired-highlight',
        score: 0,
        sourceId: 'content-source',
        visible: true,
        deleted: false,
        banned: false,
        showOnFeed: true,
        createdAt: new Date('2026-01-01T10:00:00.000Z'),
        metadataChangedAt: new Date('2026-01-01T10:00:00.000Z'),
        statsUpdatedAt: new Date('2026-01-01T10:00:00.000Z'),
        type: PostType.Article,
        contentMeta: {
          channels: ['vibes'],
        },
      },
      {
        id: 'recently-retired-highlight',
        shortId: 'recent-hl',
        title: 'Recently retired highlight',
        url: 'https://example.com/recently-retired-highlight',
        canonicalUrl: 'https://example.com/recently-retired-highlight',
        score: 0,
        sourceId: 'content-source',
        visible: true,
        deleted: false,
        banned: false,
        showOnFeed: true,
        createdAt: new Date('2026-01-03T10:00:00.000Z'),
        metadataChangedAt: new Date('2026-01-03T10:00:00.000Z'),
        statsUpdatedAt: new Date('2026-01-03T10:00:00.000Z'),
        type: PostType.Article,
        contentMeta: {
          channels: ['vibes'],
        },
      },
    ]);
  });

  afterEach(async () => {
    await con.getRepository(ChannelHighlightRun).clear();
    await con.getRepository(PostHighlight).clear();
    await con
      .createQueryBuilder()
      .delete()
      .from('post')
      .where('"sourceId" = :sourceId', {
        sourceId: 'content-source',
      })
      .execute();
    await con.getRepository(Source).delete(['content-source']);
  });

  it('should be registered', () => {
    const registeredCron = crons.find(
      (item) => item.name === cleanChannelHighlights.name,
    );

    expect(registeredCron).toBeDefined();
  });

  it('should delete retired highlights older than 30 days and expired runs', async () => {
    await con.getRepository(PostHighlight).save([
      {
        channel: 'vibes',
        postId: 'active-highlight',
        highlightedAt: new Date(),
        headline: 'Active headline',
        retiredAt: null,
      },
      {
        channel: 'vibes',
        postId: 'retired-highlight',
        highlightedAt: new Date('2026-01-01T10:00:00.000Z'),
        headline: 'Retired headline',
        retiredAt: new Date('2026-01-02T10:00:00.000Z'),
      },
      {
        channel: 'vibes',
        postId: 'recently-retired-highlight',
        highlightedAt: new Date('2026-01-03T10:00:00.000Z'),
        headline: 'Recently retired headline',
        retiredAt: sub(new Date(), { days: 1 }),
      },
    ]);
    await con.getRepository(ChannelHighlightRun).save([
      {
        channel: 'vibes',
        scheduledAt: new Date('2026-01-01T10:00:00.000Z'),
        status: 'completed',
        baselineSnapshot: [],
        inputSummary: {},
        internalSnapshot: [],
        comparison: {},
        metrics: {},
        completedAt: new Date('2026-01-01T10:05:00.000Z'),
      },
      {
        channel: 'vibes',
        scheduledAt: new Date(),
        status: 'completed',
        baselineSnapshot: [],
        inputSummary: {},
        internalSnapshot: [],
        comparison: {},
        metrics: {},
        completedAt: new Date(),
      },
    ]);

    await expectSuccessfulCron(cleanChannelHighlights);

    const highlights = await con.getRepository(PostHighlight).find({
      order: { postId: 'ASC' },
    });
    const runs = await con.getRepository(ChannelHighlightRun).find({
      order: { scheduledAt: 'ASC' },
    });

    expect(highlights).toEqual([
      expect.objectContaining({
        postId: 'active-highlight',
      }),
      expect.objectContaining({
        postId: 'recently-retired-highlight',
      }),
    ]);
    expect(runs).toHaveLength(1);
    expect(runs[0].completedAt).not.toBeNull();
  });
});
