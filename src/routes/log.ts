import { FastifyInstance, FastifyReply } from 'fastify';
import { Storage } from '@google-cloud/storage';
import { retryFetch } from '../integrations/retry';
import {
  WEBAPP_MAGIC_IMAGE_PREFIX,
  YEAR_IN_REVIEW_BUCKET_NAME,
} from '../config';
import createOrGetConnection from '../db';
import { User } from '../entity';

const storage = new Storage();

// Record types matching the webapp's RecordType enum
const RecordType = {
  YEAR_ACTIVE: 'yearActive',
  STREAK: 'streak',
  CONSISTENT_DAY: 'consistentDay',
  BINGE_DAY: 'bingeDay',
  LONGEST_SESSION: 'longestSession',
  TOPIC_MARATHON: 'topicMarathon',
  LATE_NIGHT: 'lateNight',
  EARLY_MORNING: 'earlyMorning',
  GROWTH_MONTH: 'growthMonth',
  IMPROVED_TOPIC: 'improvedTopic',
} as const;

// Mock data matching the webapp's LogData interface
// TODO: Replace with actual data fetching logic
const MOCK_LOG_DATA = {
  // Card 1: Total Impact
  totalPosts: 847,
  totalReadingTime: 62,
  daysActive: 234,
  totalImpactPercentile: 91,

  // Card 2: When You Read
  peakDay: 'Thursday',
  readingPattern: 'night' as const,
  patternPercentile: 8,
  activityHeatmap: Array(7)
    .fill(null)
    .map(() =>
      Array(24)
        .fill(0)
        .map(() => Math.floor(Math.random() * 10)),
    ),

  // Card 3: Topic Evolution
  topicJourney: [
    { quarter: 'Q1', topics: ['Python', 'Django', 'REST APIs'] },
    {
      quarter: 'Q2',
      topics: ['Docker', 'Kubernetes', 'DevOps'],
      comment: '🔥 THE PIVOT QUARTER',
    },
    { quarter: 'Q3', topics: ['Go', 'Concurrency', 'gRPC'] },
    { quarter: 'Q4', topics: ['Rust', 'Systems', 'Memory Safety'] },
  ],
  uniqueTopics: 47,
  evolutionPercentile: 23,

  // Card 4: Favorite Sources
  topSources: [
    {
      name: 'dev.to',
      postsRead: 127,
      logoUrl:
        'https://daily-now-res.cloudinary.com/image/upload/t_logo,f_auto/v1/logos/devto',
    },
    {
      name: 'Hacker News',
      postsRead: 98,
      logoUrl:
        'https://daily-now-res.cloudinary.com/image/upload/t_logo,f_auto/v1/logos/hn',
    },
    {
      name: 'Pragmatic Engineer',
      postsRead: 64,
      logoUrl:
        'https://daily-now-res.cloudinary.com/image/upload/t_logo,f_auto/v1/logos/pragmaticengineer',
    },
  ],
  uniqueSources: 89,
  sourcePercentile: 15,
  sourceLoyaltyName: 'dev.to',

  // Card 5: Community Engagement
  upvotesGiven: 234,
  commentsWritten: 18,
  postsBookmarked: 89,
  upvotePercentile: 15,
  commentPercentile: 32,
  bookmarkPercentile: 20,

  // Card 6: Your Contributions
  hasContributions: true,
  postsCreated: 12,
  totalViews: 8432,
  commentsReceived: 247,
  upvotesReceived: 892,
  reputationEarned: 1892,
  creatorPercentile: 8,

  // Card 7: Records
  records: [
    {
      type: RecordType.STREAK,
      label: 'Longest Streak',
      value: '47 days',
      percentile: 6,
    },
    {
      type: RecordType.BINGE_DAY,
      label: 'Biggest Binge',
      value: '34 posts',
      percentile: 3,
    },
    {
      type: RecordType.LATE_NIGHT,
      label: 'Latest Night Read',
      value: '3:47 AM',
    },
  ],

  // Card 8: Archetype
  archetype: 'COLLECTOR' as const,
  archetypeStat: 'Only 12% of developers read as late as you',
  archetypePercentile: 12,

  // Card 9: Share
  globalRank: 12847,
  totalDevelopers: 487000,
  shareCount: 24853,
};

/**
 * Fetch user's year-in-review log data from GCS bucket.
 * Returns null if the file doesn't exist.
 */
async function fetchLogDataFromGCS(
  userId: string,
): Promise<typeof MOCK_LOG_DATA | null> {
  try {
    const bucket = storage.bucket(YEAR_IN_REVIEW_BUCKET_NAME);
    const file = bucket.file(`2025/first_30/${userId}.json`);

    const [exists] = await file.exists();
    if (!exists) {
      return null;
    }

    const [content] = await file.download();
    return JSON.parse(content.toString());
  } catch (error) {
    return null;
  }
}

// Valid card types for log share images (welcome is not shareable)
const VALID_CARD_TYPES = [
  'total-impact',
  'when-you-read',
  'topic-evolution',
  'favorite-sources',
  'community',
  'contributions',
  'records',
  'archetype',
  'share',
] as const;

type CardType = (typeof VALID_CARD_TYPES)[number];

/**
 * Extract only the data needed for a specific card type.
 * This keeps the base64 URL payload small.
 */
function extractCardData(card: CardType, logData: typeof MOCK_LOG_DATA) {
  switch (card) {
    case 'total-impact':
      return {
        totalPosts: logData.totalPosts,
        totalReadingTime: logData.totalReadingTime,
        daysActive: logData.daysActive,
        totalImpactPercentile: logData.totalImpactPercentile,
      };
    case 'when-you-read':
      return {
        peakDay: logData.peakDay,
        readingPattern: logData.readingPattern,
        patternPercentile: logData.patternPercentile,
        activityHeatmap: logData.activityHeatmap,
      };
    case 'topic-evolution':
      return {
        topicJourney: logData.topicJourney,
        uniqueTopics: logData.uniqueTopics,
        evolutionPercentile: logData.evolutionPercentile,
      };
    case 'favorite-sources':
      return {
        topSources: logData.topSources,
        uniqueSources: logData.uniqueSources,
        sourcePercentile: logData.sourcePercentile,
        sourceLoyaltyName: logData.sourceLoyaltyName,
      };
    case 'community':
      return {
        upvotesGiven: logData.upvotesGiven,
        commentsWritten: logData.commentsWritten,
        postsBookmarked: logData.postsBookmarked,
        upvotePercentile: logData.upvotePercentile,
        commentPercentile: logData.commentPercentile,
        bookmarkPercentile: logData.bookmarkPercentile,
      };
    case 'contributions':
      return {
        postsCreated: logData.postsCreated,
        totalViews: logData.totalViews,
        commentsReceived: logData.commentsReceived,
        upvotesReceived: logData.upvotesReceived,
        reputationEarned: logData.reputationEarned,
        creatorPercentile: logData.creatorPercentile,
      };
    case 'records':
      return {
        records: logData.records,
      };
    case 'archetype':
      return {
        archetype: logData.archetype,
        archetypeStat: logData.archetypeStat,
        archetypePercentile: logData.archetypePercentile,
      };
    case 'share':
      return {
        archetype: logData.archetype,
        archetypeStat: logData.archetypeStat,
        archetypePercentile: logData.archetypePercentile,
        totalPosts: logData.totalPosts,
        totalReadingTime: logData.totalReadingTime,
        daysActive: logData.daysActive,
        records: logData.records,
        uniqueTopics: logData.uniqueTopics,
        uniqueSources: logData.uniqueSources,
        upvotesGiven: logData.upvotesGiven,
        commentsWritten: logData.commentsWritten,
        postsBookmarked: logData.postsBookmarked,
        activityHeatmap: logData.activityHeatmap,
      };
    default:
      return logData;
  }
}

export default async function (fastify: FastifyInstance): Promise<void> {
  /**
   * GET /log
   * Returns the user's log data for the year.
   * Accepts optional userId query param to fetch specific user's data from GCS.
   * Returns 404 if user doesn't have enough data (no JSON file exists).
   */
  fastify.get<{
    Querystring: { userId?: string };
  }>('/', async (req, res) => {
    const { userId } = req.query;

    // If userId query param is provided, fetch from GCS
    if (userId) {
      const logData = await fetchLogDataFromGCS(userId);
      if (!logData) {
        return res.status(404).send({ error: 'No log data available' });
      }
      return res.send(logData);
    }

    // Fall back to mock data when no userId provided
    return res.send(MOCK_LOG_DATA);
  });

  /**
   * GET /log/images?card=xxx&userId=xxx
   *
   * Generates a share image for a specific Log card.
   * Requires authentication. The userId query param must match the authenticated user
   * for cache key uniqueness.
   */
  fastify.get<{
    Querystring: { card?: string; userId?: string };
  }>('/images', async (req, res): Promise<FastifyReply> => {
    // Require authentication
    if (!req.userId) {
      return res.status(401).send({ error: 'Unauthorized' });
    }

    const { card, userId } = req.query;

    // Validate card type
    if (!card || !VALID_CARD_TYPES.includes(card as CardType)) {
      return res.status(400).send({
        error: 'Invalid card type',
        validTypes: VALID_CARD_TYPES,
      });
    }

    // Validate userId matches authenticated user (for cache key integrity)
    if (userId && userId !== req.userId) {
      return res.status(403).send({ error: 'User ID mismatch' });
    }

    try {
      // Fetch user profile for personalization
      const con = await createOrGetConnection();
      const user = await con
        .getRepository(User)
        .findOne({ where: { id: req.userId }, select: ['image', 'username'] });

      if (!user) {
        return res.status(404).send({ error: 'User not found' });
      }

      // Fetch user's log data from GCS, fall back to mock data
      const logData = (await fetchLogDataFromGCS(req.userId)) ?? MOCK_LOG_DATA;

      // Extract only the data needed for this card type
      const cardData = extractCardData(card as CardType, logData);

      // Combine card data with user profile for personalization
      const payloadData = {
        ...cardData,
        userImage: user.image,
        username: user.username,
      };

      // Encode data as base64url for URL-safe transmission
      const encoded = Buffer.from(JSON.stringify(payloadData)).toString(
        'base64url',
      );

      // Build image-generator URL
      const imageUrl = new URL(
        `${WEBAPP_MAGIC_IMAGE_PREFIX}/log`,
        'https://dailydev-log-2025.preview.app.daily.dev', // TODO: process.env.COMMENTS_PREFIX
      );
      imageUrl.searchParams.set('card', card);
      imageUrl.searchParams.set('data', encoded);

      req.log.info(
        { url: imageUrl.toString(), card },
        'Generating log share image',
      );

      // Call scraper service to screenshot the page
      const response = await retryFetch(
        `${process.env.SCRAPER_URL}/screenshot`,
        {
          method: 'POST',
          body: JSON.stringify({
            url: imageUrl.toString(),
            selector: '#screenshot_wrapper',
          }),
          headers: { 'content-type': 'application/json' },
        },
      );

      if (!response.ok) {
        req.log.error(
          { status: response.status, card },
          'Scraper failed to generate image',
        );
        return res.status(500).send({ error: 'Failed to generate image' });
      }

      // Return the image with cache headers
      // Cache key includes userId in the URL for per-user uniqueness
      return res
        .type('image/png')
        .header('cross-origin-opener-policy', 'cross-origin')
        .header('cross-origin-resource-policy', 'cross-origin')
        .header('cache-control', 'public, max-age=3600, s-maxage=3600')
        .send(await response.buffer());
    } catch (err) {
      req.log.error({ err, card }, 'Error generating log share image');
      return res.status(500).send({ error: 'Internal server error' });
    }
  });
}
