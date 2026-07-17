import type { FastifyBaseLogger } from 'fastify';
import {
  mapCommunitySentimentPayload,
  tryMapCommunitySentimentPayload,
} from '../../src/common/communitySentiment';

jest.setTimeout(30000);

const validPayload = {
  breakdown: { positive: 57, mixed: 27, critical: 16 },
  tldr: 'Developers like the idea but worry about scale.',
  post_count: 410,
  sources: ['Hacker News', 'Lobsters'],
  pros: ['One database to run'],
  cons: ['Purpose-built tools still win at scale'],
  by_source: [
    {
      source: 'Hacker News',
      lean: 'heated',
      note: 'Classic flame war',
      url: 'https://news.ycombinator.com/item?id=1',
    },
  ],
  hottest_debate: 'Is consolidating a smart simplification?',
  open_questions: ['At what scale does it break down?'],
  highlights: [
    {
      quote: 'Every service I replace is one less thing paging me at 3am.',
      author: 'throwaway_42',
      source: 'Hacker News',
      url: 'https://news.ycombinator.com/item?id=1',
      metrics: { points: 214, replies: 96 },
    },
  ],
};

const validDiscussions = [
  {
    provider: 'hackernews',
    url: 'https://news.ycombinator.com/item?id=1',
    points: 329,
    comments_count: 172,
  },
];

describe('mapCommunitySentimentPayload', () => {
  it('should return undefined when no take is present', () => {
    expect(
      mapCommunitySentimentPayload({
        communitySentiment: undefined,
        discussions: validDiscussions,
      }),
    ).toBeUndefined();
    expect(
      mapCommunitySentimentPayload({
        communitySentiment: null,
        discussions: validDiscussions,
      }),
    ).toBeUndefined();
  });

  it('should map a valid wire payload into the stored shape', () => {
    const result = mapCommunitySentimentPayload({
      communitySentiment: validPayload,
      discussions: validDiscussions,
    });

    expect(result).toMatchObject({
      breakdown: { positive: 57, mixed: 27, critical: 16 },
      tldr: validPayload.tldr,
      postCount: 410,
      sources: ['Hacker News', 'Lobsters'],
      pros: validPayload.pros,
      cons: validPayload.cons,
      bySource: [
        {
          source: 'Hacker News',
          lean: 'heated',
          note: 'Classic flame war',
          url: 'https://news.ycombinator.com/item?id=1',
        },
      ],
      hottestDebate: validPayload.hottest_debate,
      openQuestions: validPayload.open_questions,
      highlights: [
        {
          quote: validPayload.highlights[0].quote,
          author: 'throwaway_42',
          source: 'Hacker News',
          url: 'https://news.ycombinator.com/item?id=1',
          metrics: { points: 214, replies: 96 },
        },
      ],
      discussions: [
        {
          provider: 'hackernews',
          url: 'https://news.ycombinator.com/item?id=1',
          points: 329,
          commentsCount: 172,
        },
      ],
    });
    expect(typeof result?.updatedAt).toBe('string');
  });

  it('should default discussions to an empty array when omitted', () => {
    const result = mapCommunitySentimentPayload({
      communitySentiment: validPayload,
      discussions: undefined,
    });

    expect(result?.discussions).toEqual([]);
  });

  it('should accept a minimal payload with omitempty-omitted fields', () => {
    const result = mapCommunitySentimentPayload({
      communitySentiment: {
        breakdown: { positive: 60, mixed: 25, critical: 15 },
        tldr: 'Early take from a small thread.',
        post_count: 12,
      },
      discussions: undefined,
    });

    expect(result).toMatchObject({
      breakdown: { positive: 60, mixed: 25, critical: 15 },
      tldr: 'Early take from a small thread.',
      postCount: 12,
      sources: [],
      pros: [],
      cons: [],
      bySource: [],
      hottestDebate: undefined,
      openQuestions: [],
      highlights: [],
      discussions: [],
    });
  });

  it('should throw when the breakdown does not sum to 100', () => {
    expect(() =>
      mapCommunitySentimentPayload({
        communitySentiment: {
          ...validPayload,
          breakdown: { positive: 50, mixed: 20, critical: 20 },
        },
        discussions: validDiscussions,
      }),
    ).toThrow();
  });

  it('should throw when a by_source lean value is invalid', () => {
    expect(() =>
      mapCommunitySentimentPayload({
        communitySentiment: {
          ...validPayload,
          by_source: [
            { source: 'Hacker News', lean: 'angry', note: 'invalid lean' },
          ],
        },
        discussions: validDiscussions,
      }),
    ).toThrow();
  });

  it('should drop discussion entries missing provider or url', () => {
    const result = mapCommunitySentimentPayload({
      communitySentiment: validPayload,
      discussions: [
        ...validDiscussions,
        { provider: 'lobsters', points: 12 },
        { url: 'https://lobste.rs/s/abc', comments_count: 3 },
      ],
    });

    expect(result?.discussions).toEqual([
      {
        provider: 'hackernews',
        url: 'https://news.ycombinator.com/item?id=1',
        points: 329,
        commentsCount: 172,
      },
    ]);
  });

  it('should throw when discussions are malformed', () => {
    expect(() =>
      mapCommunitySentimentPayload({
        communitySentiment: validPayload,
        discussions: 'not-an-array',
      }),
    ).toThrow();
  });
});

describe('tryMapCommunitySentimentPayload', () => {
  const logger = { warn: jest.fn() } as unknown as FastifyBaseLogger;

  it('should return the mapped take for a valid payload', () => {
    const result = tryMapCommunitySentimentPayload({
      logger,
      communitySentiment: validPayload,
      discussions: validDiscussions,
    });

    expect(result?.postCount).toEqual(410);
  });

  it('should swallow validation errors and return undefined', () => {
    const result = tryMapCommunitySentimentPayload({
      logger,
      communitySentiment: {
        ...validPayload,
        breakdown: { positive: 50, mixed: 20, critical: 20 },
      },
      discussions: validDiscussions,
    });

    expect(result).toBeUndefined();
    expect(logger.warn).toHaveBeenCalled();
  });
});
