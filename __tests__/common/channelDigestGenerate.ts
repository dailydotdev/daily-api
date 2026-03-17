import { SentimentDigestResponse } from '@dailydotdev/schema';
import type { DataSource } from 'typeorm';
import { AGENTS_DIGEST_SOURCE } from '../../src/entity/Source';
import { FreeformPost } from '../../src/entity/posts/FreeformPost';
import { Post, PostType } from '../../src/entity/posts/Post';
import { generateShortId } from '../../src/ids';
import { getBragiClient } from '../../src/integrations/bragi/clients';
import { yggdrasilSentimentClient } from '../../src/integrations/yggdrasil/clients';
import { generateChannelDigest } from '../../src/common/channelDigest/generate';

jest.mock('../../src/integrations/bragi/clients', () => ({
  getBragiClient: jest.fn(),
}));

jest.mock('../../src/integrations/yggdrasil/clients', () => ({
  yggdrasilSentimentClient: {
    getHighlights: jest.fn(),
  },
}));

jest.mock('../../src/ids', () => ({
  generateShortId: jest.fn(),
}));

const getBragiClientMock = getBragiClient as jest.MockedFunction<
  typeof getBragiClient
>;
const getHighlightsMock =
  yggdrasilSentimentClient.getHighlights as jest.MockedFunction<
    typeof yggdrasilSentimentClient.getHighlights
  >;
const generateShortIdMock = generateShortId as jest.MockedFunction<
  typeof generateShortId
>;
const generateSentimentDigestMock = jest.fn();

const createQueryBuilderMock = (rows: Array<Record<string, unknown>>) => {
  const queryBuilder = {
    leftJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(rows),
  };

  return queryBuilder;
};

const createConnectionMock = ({
  lastDigest,
  rows,
}: {
  lastDigest?: { id: string; createdAt: Date } | null;
  rows: Array<Record<string, unknown>>;
}): {
  con: DataSource;
  freeformRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  postQueryBuilder: ReturnType<typeof createQueryBuilderMock>;
} => {
  const freeformRepo = {
    findOne: jest.fn().mockResolvedValue(lastDigest ?? null),
    create: jest.fn((value) => value),
    save: jest.fn((value) => Promise.resolve(value)),
  };
  const postQueryBuilder = createQueryBuilderMock(rows);
  const postRepo = {
    createQueryBuilder: jest.fn(() => postQueryBuilder),
  };
  const con = {
    getRepository: jest.fn((target) => {
      if (target === FreeformPost) {
        return freeformRepo;
      }

      if (target === Post) {
        return postRepo;
      }

      throw new Error(`Unexpected repository target: ${String(target)}`);
    }),
  } as unknown as DataSource;

  return {
    con,
    freeformRepo,
    postQueryBuilder,
  };
};

describe('generateChannelDigest', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    generateShortIdMock.mockResolvedValue('digest-post-id');
    getHighlightsMock.mockResolvedValue({
      items: [],
      cursor: null,
    });
    generateSentimentDigestMock.mockResolvedValue(
      new SentimentDigestResponse({
        id: 'digest-id',
        title: 'Digest title',
        content: 'Digest content',
      }),
    );
    getBragiClientMock.mockReturnValue({
      instance: {
        generateSentimentDigest: generateSentimentDigestMock,
      } as ReturnType<typeof getBragiClient>['instance'],
      garmr: {
        execute: async (callback) => callback(),
      } as ReturnType<typeof getBragiClient>['garmr'],
    });
  });

  it('should send the agentic request with sentiment and save the post', async () => {
    const { con, freeformRepo } = createConnectionMock({
      rows: [
        {
          title: 'Collection worker post',
          summary: 'Collection worker summary',
          content: 'Collection worker content',
        },
      ],
    });
    getHighlightsMock
      .mockResolvedValueOnce({
        items: [
          {
            text: 'Worker highlight text',
            author: { handle: 'worker_author' },
            metrics: { like_count: 42 },
          },
        ],
        cursor: null,
      })
      .mockResolvedValueOnce({
        items: [],
        cursor: null,
      });

    const result = await generateChannelDigest({
      con,
      definition: {
        key: 'agentic',
        sourceId: AGENTS_DIGEST_SOURCE,
        channels: ['vibes'],
        targetAudience:
          'software engineers and engineering leaders who care about AI tooling, agentic engineering, models, and vibe coding. They range from vibe coders to seasoned engineers tracking how AI is reshaping their craft.',
        frequency: 'daily',
        includeSentiment: true,
        minHighlightScore: 0.65,
        sentimentGroupIds: ['group-1', 'group-2'],
      },
      now: new Date('2026-03-03T10:00:00.000Z'),
    });

    expect(generateSentimentDigestMock.mock.calls[0][0]).toMatchObject({
      date: '2026-03-03',
      targetAudience:
        'software engineers and engineering leaders who care about AI tooling, agentic engineering, models, and vibe coding. They range from vibe coders to seasoned engineers tracking how AI is reshaping their craft.',
      frequency: 'daily',
      sentimentItems: [
        {
          text: 'Worker highlight text',
          authorHandle: 'worker_author',
          likes: 42,
        },
      ],
      posts: [
        {
          title: 'Collection worker post',
          summary: 'Collection worker content',
        },
      ],
    });
    expect(freeformRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'digest-post-id',
        sourceId: AGENTS_DIGEST_SOURCE,
        type: PostType.Freeform,
        title: 'Digest title',
        content: 'Digest content',
      }),
    );
    expect(result).toMatchObject({
      id: 'digest-post-id',
      title: 'Digest title',
      content: 'Digest content',
    });
  });

  it('should return null and skip bragi when there is no input', async () => {
    const { con, freeformRepo } = createConnectionMock({
      rows: [],
    });

    const result = await generateChannelDigest({
      con,
      definition: {
        key: 'agentic',
        sourceId: AGENTS_DIGEST_SOURCE,
        channels: ['vibes'],
        targetAudience: 'audience',
        frequency: 'daily',
        includeSentiment: true,
        sentimentGroupIds: ['group-1'],
      },
      now: new Date('2026-03-03T10:00:00.000Z'),
    });

    expect(generateSentimentDigestMock).not.toHaveBeenCalled();
    expect(freeformRepo.save).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('should use a weekly fallback window for weekly digests', async () => {
    const { con, postQueryBuilder } = createConnectionMock({
      rows: [
        {
          title: 'Weekly post',
          summary: 'Weekly summary',
          content: 'Weekly content',
        },
      ],
    });

    await generateChannelDigest({
      con,
      definition: {
        key: 'weekly-test',
        sourceId: 'weekly-source',
        channels: ['weekly'],
        targetAudience: 'weekly audience',
        frequency: 'weekly',
        includeSentiment: false,
      },
      now: new Date('2026-03-03T10:00:00.000Z'),
    });

    expect(postQueryBuilder.where).toHaveBeenCalledWith(
      'post.createdAt >= :from',
      {
        from: new Date('2026-02-24T10:00:00.000Z'),
      },
    );
  });
});
