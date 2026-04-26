import { DataSource } from 'typeorm';
import { PostHighlightedMessage } from '@dailydotdev/schema';
import createOrGetConnection from '../../src/db';
import { NEW_HIGHLIGHT_CHANNEL } from '../../src/common/highlights';
import { ArticlePost, PostHighlight, Source } from '../../src/entity';
import { PostType } from '../../src/entity/posts/Post';
import { SourceType } from '../../src/entity/Source';
import { redisPubSub } from '../../src/redis';
import worker from '../../src/workers/newHighlightRealTime';
import { typedWorkers } from '../../src/workers';
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
    await con.getRepository(PostHighlight).clear();
    await con.getRepository(ArticlePost).delete(['highlight-post']);
    await con.getRepository(Source).delete(['highlight-source']);
  });

  it('should be registered', () => {
    const registeredWorker = typedWorkers.find(
      (item) => item.subscription === worker.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should publish a full highlight to the broadcast redis channel', async () => {
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

    const highlight = await con.getRepository(PostHighlight).save({
      postId: 'highlight-post',
      channel: 'backend',
      highlightedAt: new Date('2026-04-26T10:05:00.000Z'),
      headline: 'New backend highlight',
    });
    const publishSpy = jest.spyOn(redisPubSub, 'publish');

    await expectSuccessfulTypedBackground<'api.v1.post-highlighted'>(
      worker,
      new PostHighlightedMessage({
        highlightId: highlight.id,
      }),
    );

    expect(publishSpy).toHaveBeenCalledTimes(1);
    expect(publishSpy).toHaveBeenCalledWith(
      NEW_HIGHLIGHT_CHANNEL,
      expect.objectContaining({
        id: highlight.id,
        postId: 'highlight-post',
        channel: 'backend',
        headline: 'New backend highlight',
        highlightedAt: highlight.highlightedAt,
        createdAt: highlight.createdAt,
        updatedAt: highlight.updatedAt,
      }),
    );
  });
});
