import { SentimentDigestResponse } from '@dailydotdev/schema';
import { DataSource } from 'typeorm';
import cron from '../../src/cron/agentsDigest';
import createOrGetConnection from '../../src/db';
import {
  AGENTS_DIGEST_SOURCE,
  CollectionPost,
  FreeformPost,
  PostRelation,
  PostRelationType,
  PostType,
  Source,
} from '../../src/entity';
import { getBragiClient } from '../../src/integrations/bragi/clients';
import { yggdrasilSentimentClient } from '../../src/integrations/yggdrasil/clients';
import { crons } from '../../src/cron/index';
import { doNotFake, expectSuccessfulCron, saveFixtures } from '../helpers';

jest.mock('../../src/integrations/yggdrasil/clients', () => ({
  yggdrasilSentimentClient: {
    getHighlights: jest.fn(),
  },
}));

jest.mock('../../src/integrations/bragi/clients', () => ({
  getBragiClient: jest.fn(),
}));

let con: DataSource;

const getHighlightsMock =
  yggdrasilSentimentClient.getHighlights as jest.MockedFunction<
    typeof yggdrasilSentimentClient.getHighlights
  >;
const getBragiClientMock = getBragiClient as jest.MockedFunction<
  typeof getBragiClient
>;

const bragiGenerateMock = jest.fn();

const setupBragiMock = (): void => {
  getBragiClientMock.mockReturnValue({
    instance: {
      generateSentimentDigest: bragiGenerateMock,
    } as ReturnType<typeof getBragiClient>['instance'],
    garmr: {
      execute: async (callback) => callback(),
    } as ReturnType<typeof getBragiClient>['garmr'],
  });
};

const sourceFixtures = [
  {
    id: AGENTS_DIGEST_SOURCE,
    name: 'Agents digest',
    handle: 'agents_digest',
    image: 'https://daily.dev/agents-digest.png',
    private: false,
  },
  {
    id: 'vibes-source',
    name: 'Vibes source',
    handle: 'vibes_source',
    image: 'https://daily.dev/vibes-source.png',
    private: false,
  },
];

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  jest
    .useFakeTimers({ doNotFake })
    .setSystemTime(new Date('2026-03-03T10:00:00.000Z'));

  setupBragiMock();
  getHighlightsMock.mockResolvedValue({
    items: [],
    cursor: null,
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('agentsDigest cron', () => {
  it('should be registered', () => {
    const registeredCron = crons.find((item) => item.name === cron.name);
    expect(registeredCron).toBeDefined();
  });

  it('should generate daily digest post', async () => {
    await saveFixtures(con, Source, sourceFixtures);
    await saveFixtures(con, FreeformPost, [
      {
        id: 'vibes-1',
        shortId: 'vibes-1',
        sourceId: 'vibes-source',
        title: 'Vibes post',
        summary: 'Vibes summary',
        content: 'Vibes content',
        contentHtml: '<p>Vibes content</p>',
        type: PostType.Freeform,
        createdAt: new Date('2026-03-03T06:00:00.000Z'),
        metadataChangedAt: new Date('2026-03-03T06:00:00.000Z'),
        contentMeta: { channels: ['vibes'] },
      },
    ]);
    await saveFixtures(con, CollectionPost, [
      {
        id: 'collection-1',
        shortId: 'collection-1',
        sourceId: 'vibes-source',
        title: 'Collection post',
        summary: 'Collection summary',
        content: 'Collection content',
        contentHtml: '<p>Collection content</p>',
        type: PostType.Collection,
        createdAt: new Date('2026-03-03T06:00:00.000Z'),
        metadataChangedAt: new Date('2026-03-03T06:00:00.000Z'),
        contentMeta: { channels: ['vibes'] },
      },
    ]);
    await saveFixtures(con, PostRelation, [
      {
        postId: 'collection-1',
        relatedPostId: 'vibes-1',
        type: PostRelationType.Collection,
      },
    ]);

    getHighlightsMock
      .mockResolvedValueOnce({
        items: [
          {
            provider: 'x',
            external_item_id: '1',
            url: 'https://x.com/item/1',
            text: 'Highlight text',
            author: { handle: 'author1' },
            metrics: { like_count: 42 },
            created_at: '2026-03-03T08:00:00.000Z',
            sentiments: [],
          },
        ],
        cursor: null,
      })
      .mockResolvedValueOnce({
        items: [],
        cursor: null,
      });
    bragiGenerateMock.mockResolvedValue(
      new SentimentDigestResponse({
        id: 'digest-1',
        title: 'Daily vibes digest',
        content: 'Digest body',
      }),
    );

    await expectSuccessfulCron(cron);

    expect(getHighlightsMock).toHaveBeenCalledTimes(2);
    expect(getHighlightsMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        groupId: '385404b4-f0f4-4e81-a338-bdca851eca31',
        minHighlightScore: 0.65,
        orderBy: 'recency',
        from: expect.any(String),
        to: expect.any(String),
      }),
    );
    expect(getHighlightsMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        groupId: '970ab2c9-f845-4822-82f0-02169713b814',
        minHighlightScore: 0.65,
        orderBy: 'recency',
        from: expect.any(String),
        to: expect.any(String),
      }),
    );

    expect(bragiGenerateMock).toHaveBeenCalledTimes(1);
    const digestRequest = bragiGenerateMock.mock.calls[0][0];
    expect(digestRequest.date).toEqual('2026-03-03');
    expect(digestRequest.sentimentItems).toHaveLength(1);
    expect(digestRequest.sentimentItems[0]).toMatchObject({
      text: 'Highlight text',
      authorHandle: 'author1',
      likes: 42,
    });
    expect(digestRequest.posts).toHaveLength(1);
    expect(digestRequest.posts[0]).toMatchObject({
      title: 'Collection post',
      summary: 'Collection content',
    });

    const digestPosts = await con.getRepository(FreeformPost).find({
      where: {
        sourceId: AGENTS_DIGEST_SOURCE,
        type: PostType.Freeform,
      },
    });
    expect(digestPosts).toHaveLength(1);
    expect(digestPosts[0]).toMatchObject({
      title: 'Daily vibes digest',
      content: 'Digest body',
      showOnFeed: true,
      visible: true,
    });
  });

  it('should skip generation when no highlights and no channel posts', async () => {
    await expectSuccessfulCron(cron);

    expect(bragiGenerateMock).not.toHaveBeenCalled();
  });

  it('should create a new digest post every run', async () => {
    await saveFixtures(con, Source, sourceFixtures);
    await saveFixtures(con, FreeformPost, [
      {
        id: 'vibes-2',
        shortId: 'vibes-2',
        sourceId: 'vibes-source',
        title: 'Another vibes post',
        summary: 'Another vibes summary',
        content: 'Another vibes content',
        contentHtml: '<p>Another vibes content</p>',
        type: PostType.Freeform,
        createdAt: new Date('2026-03-03T07:00:00.000Z'),
        metadataChangedAt: new Date('2026-03-03T07:00:00.000Z'),
        contentMeta: { channels: ['vibes'] },
      },
    ]);

    getHighlightsMock
      .mockResolvedValueOnce({
        items: [
          {
            provider: 'x',
            external_item_id: '2',
            url: 'https://x.com/item/2',
            text: 'Another highlight',
            author: { handle: 'author2' },
            metrics: { like_count: 5 },
            created_at: '2026-03-03T08:00:00.000Z',
            sentiments: [],
          },
        ],
        cursor: null,
      })
      .mockResolvedValueOnce({
        items: [],
        cursor: null,
      });
    bragiGenerateMock.mockResolvedValue(
      new SentimentDigestResponse({
        id: 'digest-2',
        title: 'Updated title',
        content: 'Updated content',
      }),
    );

    await expectSuccessfulCron(cron);

    const digestPosts = await con.getRepository(FreeformPost).find({
      where: {
        sourceId: AGENTS_DIGEST_SOURCE,
        type: PostType.Freeform,
      },
    });
    expect(digestPosts).toHaveLength(1);
    expect(digestPosts[0]).toMatchObject({
      title: 'Updated title',
      content: 'Updated content',
      showOnFeed: true,
      visible: true,
    });
  });
});
