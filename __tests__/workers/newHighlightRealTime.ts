import { HighlightsCanonicalPublishedMessage } from '@dailydotdev/schema';
import { DataSource } from 'typeorm';
import { HighlightSignificance } from '../../src/common/channelHighlight/significance';
import { NEW_HIGHLIGHT_CHANNEL } from '../../src/common/highlights';
import { HighlightsCanonical } from '../../src/entity/HighlightsCanonical';
import { Source, SourceType } from '../../src/entity/Source';
import { ArticlePost } from '../../src/entity/posts/ArticlePost';
import { PostType } from '../../src/entity/posts/Post';
import { redisPubSub } from '../../src/redis';
import worker from '../../src/workers/newHighlightRealTime';
import { typedWorkers } from '../../src/workers';
import createOrGetConnection from '../../src/db';
import { expectSuccessfulTypedBackground } from '../helpers';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

describe('newHighlightRealTime worker', () => {
  beforeEach(async () => {
    jest.resetAllMocks();

    await con.getRepository(Source).save({
      id: 'highlight-source',
      name: 'Highlight Source',
      image: 'https://example.com/highlight.png',
      handle: 'highlight-source',
      type: SourceType.Machine,
      active: true,
      private: false,
    });
  });

  afterEach(async () => {
    if (!con) {
      return;
    }

    await con.getRepository(HighlightsCanonical).clear();
    await con.getRepository(ArticlePost).delete(['highlight-post']);
    await con.getRepository(Source).delete(['highlight-source']);
  });

  it('should be registered', () => {
    const registeredWorker = typedWorkers.find(
      (item) => item.subscription === worker.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should publish full highlights to the broadcast redis channel', async () => {
    await con.getRepository(ArticlePost).save({
      id: 'highlight-post',
      shortId: 'highlight-post',
      title: 'Highlight post',
      url: 'https://example.com/highlight-post',
      canonicalUrl: 'https://example.com/highlight-post',
      score: 0,
      sourceId: 'highlight-source',
      visible: true,
      deleted: false,
      banned: false,
      showOnFeed: true,
      createdAt: new Date('2026-04-26T10:00:00.000Z'),
      metadataChangedAt: new Date('2026-04-26T10:00:00.000Z'),
      type: PostType.Article,
    });

    const highlight = await con.getRepository(HighlightsCanonical).save({
      postId: 'highlight-post',
      channels: ['backend', 'javascript', 'vibes'],
      highlightedAt: new Date('2026-04-26T10:05:00.000Z'),
      headline: 'New canonical highlight',
      significance: HighlightSignificance.Major,
    });
    const publishSpy = jest.spyOn(redisPubSub, 'publish');

    await expectSuccessfulTypedBackground<'api.v1.post-highlighted'>(
      worker,
      new HighlightsCanonicalPublishedMessage({
        highlightId: highlight.id,
        channels: highlight.channels,
        publishedChannels: ['backend', 'javascript'],
      }),
    );

    expect(publishSpy).toHaveBeenCalledTimes(2);
    for (const channel of ['backend', 'javascript']) {
      expect(publishSpy).toHaveBeenCalledWith(
        NEW_HIGHLIGHT_CHANNEL,
        expect.objectContaining({
          id: highlight.id,
          postId: 'highlight-post',
          channel,
          channels: ['backend', 'javascript', 'vibes'],
          headline: 'New canonical highlight',
          significance: 'major',
          highlightedAt: highlight.highlightedAt,
          createdAt: highlight.createdAt,
          updatedAt: highlight.updatedAt,
          post: expect.objectContaining({
            id: 'highlight-post',
            title: 'Highlight post',
            source: expect.objectContaining({
              id: 'highlight-source',
              handle: 'highlight-source',
            }),
          }),
        }),
      );
    }
  });

  it('should fallback to canonical channels when published channels are missing', async () => {
    await con.getRepository(ArticlePost).save({
      id: 'highlight-post',
      shortId: 'highlight-post',
      title: 'Highlight post',
      url: 'https://example.com/highlight-post',
      canonicalUrl: 'https://example.com/highlight-post',
      score: 0,
      sourceId: 'highlight-source',
      visible: true,
      deleted: false,
      banned: false,
      showOnFeed: true,
      createdAt: new Date('2026-04-26T10:00:00.000Z'),
      metadataChangedAt: new Date('2026-04-26T10:00:00.000Z'),
      type: PostType.Article,
    });

    const highlight = await con.getRepository(HighlightsCanonical).save({
      postId: 'highlight-post',
      channels: ['backend'],
      highlightedAt: new Date('2026-04-26T10:05:00.000Z'),
      headline: 'New canonical highlight',
      significance: HighlightSignificance.Major,
    });
    const publishSpy = jest.spyOn(redisPubSub, 'publish');

    await expectSuccessfulTypedBackground<'api.v1.post-highlighted'>(
      worker,
      new HighlightsCanonicalPublishedMessage({
        highlightId: highlight.id,
        channels: ['backend'],
      }),
    );

    expect(publishSpy).toHaveBeenCalledWith(
      NEW_HIGHLIGHT_CHANNEL,
      expect.objectContaining({
        id: highlight.id,
        channel: 'backend',
      }),
    );
  });
});
