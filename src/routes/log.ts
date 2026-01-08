import { FastifyInstance, FastifyReply } from 'fastify';
import { Storage } from '@google-cloud/storage';
import { retryFetch } from '../integrations/retry';
import {
  generateStorageKey,
  StorageKey,
  StorageTopic,
  WEBAPP_MAGIC_IMAGE_PREFIX,
  YEAR_IN_REVIEW_BUCKET_NAME,
} from '../config';
import createOrGetConnection from '../db';
import { User } from '../entity';
import { getRedisObject, setRedisObjectWithExpiry } from '../redis';

const storage = new Storage();

const ONE_HOUR_SECONDS = 60 * 60;

// LogData represents the year-in-review data structure from GCS
type LogData = Record<string, unknown>;

/**
 * Fetch user's year-in-review log data from GCS bucket.
 * Returns null if the file doesn't exist.
 */
async function fetchLogDataFromGCS(userId: string): Promise<LogData | null> {
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

/**
 * Get user's log data with Redis caching.
 * Checks cache first, falls back to GCS, and caches the result.
 */
async function getLogData(userId: string): Promise<LogData | null> {
  const cacheKey = generateStorageKey(
    StorageTopic.Log,
    StorageKey.LogData,
    userId,
  );

  const cachedData = await getRedisObject(cacheKey);
  if (cachedData) {
    return JSON.parse(cachedData);
  }

  const logData = await fetchLogDataFromGCS(userId);
  if (logData) {
    await setRedisObjectWithExpiry(
      cacheKey,
      JSON.stringify(logData),
      ONE_HOUR_SECONDS,
    );
  }

  return logData;
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
function extractCardData(card: CardType, logData: LogData) {
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
   * Returns the authenticated user's log data for the year.
   * Requires authentication.
   * Returns 404 if user doesn't have enough data (no JSON file exists).
   */
  fastify.get('/', async (req, res) => {
    if (!req.userId) {
      return res.status(401).send({ error: 'Unauthorized' });
    }

    const logData = await getLogData(req.userId);
    if (!logData) {
      return res.status(404).send({ error: 'No log data available' });
    }

    return res.send(logData);
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
      // Fetch user profile and log data in parallel
      const con = await createOrGetConnection();
      const [user, logData] = await Promise.all([
        con.getRepository(User).findOne({
          where: { id: req.userId },
          select: ['image', 'username'],
        }),
        getLogData(req.userId),
      ]);

      if (!user) {
        return res.status(404).send({ error: 'User not found' });
      }

      if (!logData) {
        return res.status(404).send({ error: 'No log data available' });
      }

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
        process.env.COMMENTS_PREFIX,
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
