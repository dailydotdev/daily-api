import { mapCommunitySentimentPayload } from '../../src/common/communitySentiment';

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

  it('should throw when discussions are malformed', () => {
    expect(() =>
      mapCommunitySentimentPayload({
        communitySentiment: validPayload,
        discussions: [{ provider: 'hackernews', points: 329 }],
      }),
    ).toThrow();
  });
});
