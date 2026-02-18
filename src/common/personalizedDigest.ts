import {
  ArticlePost,
  Post,
  PostType,
  Source,
  User,
  UserPersonalizedDigest,
  UserPersonalizedDigestSendType,
  UserStreak,
  type FreeformPost,
} from '../entity';
import { format, isSameDay, nextDay, previousDay } from 'date-fns';
import { PersonalizedDigestFeatureConfig } from '../growthbook';
import { feedToFilters, fixedIdsFeedBuilder } from './feedGenerator';
import { FeedClient } from '../integrations/feed/clients';
import { addNotificationUtm, baseNotificationEmailData } from './mailing';
import { findPostImageFromContent, pickImageUrl } from './post';
import { getDiscussionLink } from './links';
import { DataSource, SelectQueryBuilder, type EntityManager } from 'typeorm';
import { FastifyBaseLogger } from 'fastify';
import { zonedTimeToUtc } from 'date-fns-tz';
import fastq from 'fastq';
import { SendEmailRequestWithTemplate } from 'customerio-node/dist/lib/api/requests';
import { v4 as uuidv4 } from 'uuid';
import { DayOfWeek } from './date';
import { GarmrService } from '../integrations/garmr';
import { baseFeedConfig, BriefingType } from '../integrations/feed';
import { FeedConfigName } from '../integrations/feed';
import { isPlusMember } from '../paddle';
import { mapCloudinaryUrl } from './cloudinary';
import { queryReadReplica } from './queryReadReplica';
import { counters } from '../telemetry/metrics';
import { SkadiAd, skadiPersonalizedDigestClient } from '../integrations/skadi';
import { NotificationType } from '../notifications/common';

type TemplatePostData = Pick<
  ArticlePost,
  | 'id'
  | 'title'
  | 'image'
  | 'createdAt'
  | 'summary'
  | 'upvotes'
  | 'comments'
  | 'readTime'
  | 'views'
> & {
  sourceName: Source['name'];
  sourceImage: Source['image'];
  sharedPostImage: ArticlePost['image'];
  sharedPostTitle: ArticlePost['title'];
  content: FreeformPost['content'];
};

export const personalizedDigestDateFormat = 'yyyy-MM-dd HH:mm:ss';

type EmailSendDateProps = {
  personalizedDigest: UserPersonalizedDigest;
  generationTimestamp: number;
  timezone: string;
};

export const getPersonalizedDigestSendDate = ({
  personalizedDigest,
  generationTimestamp,
  timezone,
}: EmailSendDateProps): Date => {
  const nextPreferredDay = nextDay(
    new Date(generationTimestamp),
    personalizedDigest.preferredDay,
  );
  nextPreferredDay.setHours(personalizedDigest.preferredHour, 0, 0, 0);
  return zonedTimeToUtc(nextPreferredDay, timezone);
};

export const getPersonalizedDigestPreviousSendDate = ({
  personalizedDigest,
  generationTimestamp,
  timezone,
}: EmailSendDateProps): Date => {
  const nextPreferredDay = previousDay(
    new Date(generationTimestamp),
    personalizedDigest.preferredDay,
  );
  nextPreferredDay.setHours(personalizedDigest.preferredHour, 0, 0, 0);
  return zonedTimeToUtc(nextPreferredDay, timezone);
};

const getPostsTemplateData = ({
  posts,
  feature,
}: {
  posts: TemplatePostData[];
  feature: PersonalizedDigestFeatureConfig;
}) => {
  return posts.map((post) => {
    const summary = post.summary || '';

    return {
      post_title: post.title || post.sharedPostTitle,
      post_image: mapCloudinaryUrl(
        post.image ||
          post.sharedPostImage ||
          findPostImageFromContent({ post }) ||
          pickImageUrl(post),
      ),
      post_link: addNotificationUtm(
        getDiscussionLink(post.id),
        'email',
        'digest',
      ),
      post_upvotes: post.upvotes || 0,
      post_comments: post.comments || 0,
      post_summary:
        summary.length > feature.longTextLimit
          ? `${summary.slice(0, feature.longTextLimit).trim()}...`
          : post.summary,
      post_read_time: post.readTime,
      post_views: post.views || 0,
      source_name: post.sourceName,
      source_image: mapCloudinaryUrl(post.sourceImage),
      type: 'post',
    };
  });
};

type CIOSkadiAd = {
  type: string;
} & SkadiAd;

export const getEmailAd = async ({
  user,
  feature,
}: {
  user: User;
  feature: Pick<PersonalizedDigestFeatureConfig, 'templateId'>;
}): Promise<CIOSkadiAd | null> => {
  // TODO: Temporary hardcode 75 check
  if (
    isPlusMember(user.subscriptionFlags?.cycle) ||
    feature.templateId != '75'
  ) {
    return null;
  }

  const ad = await skadiPersonalizedDigestClient.getAd('default_digest', {
    USERID: user.id,
  });

  const digestAd = ad.value?.digest;

  if (!digestAd) {
    return null;
  }

  return {
    type: 'dynamic_ad',
    ...digestAd,
  };
};

const getEmailVariation = async ({
  personalizedDigest,
  posts: postsData,
  user,
  feature,
  currentDate,
  adProps,
}: {
  personalizedDigest: UserPersonalizedDigest;
  posts: TemplatePostData[];
  user: User;
  userStreak?: UserStreak;
  feature: PersonalizedDigestFeatureConfig;
  currentDate: Date;
  adProps: CIOSkadiAd | null;
}): Promise<
  Pick<SendEmailRequestWithTemplate, 'to' | 'message_data' | 'identifiers'>
> => {
  const dayEntry = Object.entries(DayOfWeek).find(
    ([, value]) => value === personalizedDigest.preferredDay,
  );
  const dayName = dayEntry ? dayEntry[0] : undefined;
  const userName = user.name?.trim().split(' ')[0] || user.username;
  const userStreak = await user.streak;

  const posts: Record<string, unknown>[] = getPostsTemplateData({
    posts: postsData,
    feature,
  });
  if (posts.length >= feature.adIndex) {
    if (adProps) {
      posts.splice(feature.adIndex, 0, adProps);
    } else if (!isPlusMember(user.subscriptionFlags?.cycle)) {
      posts.splice(feature.adIndex, 0, {
        // type: 'ad_image',
        // link: `https://email.buysellads.net/?k=CW7DE23N&c=${user.id}`,
        // image: `https://email.buysellads.net/?k=CW7DE23N&i=${user.id}`,
        type: 'ad_plus',
        post_link: addNotificationUtm(
          'https://app.daily.dev/plus',
          'email',
          'digest',
        ),
      });
    }
  }
  const data = {
    day_name: dayName,
    first_name: userName,
    posts,
    date: format(currentDate, 'MMM d, yyyy'),
    user: {
      username: user.username,
      image: user.image,
      reputation: user.reputation,
      currentStreak: userStreak?.currentStreak || 0,
      maxStreak: userStreak?.maxStreak || 0,
      showStreak: !!userStreak,
    },
  };

  return {
    to: user.email,
    identifiers: {
      id: user.id,
    },
    message_data: {
      ...data,
      title: `${userName}, your personal update from daily.dev is ready`,
      preview: `Here are several posts you might like. Each post was carefully selected based on topics you love reading about. Let's get to it!`,
    },
  };
};

const personalizedDigestFeedClient = new FeedClient(
  process.env.PERSONALIZED_DIGEST_FEED,
  {
    fetchOptions: {
      timeout: 10 * 1000,
    },
    garmr: new GarmrService({
      service: 'feed-client-digest',
      breakerOpts: {
        halfOpenAfter: 5 * 1000,
        threshold: 0.1,
        duration: 10 * 1000,
        minimumRps: 1,
      },
      limits: {
        maxRequests: 150,
        queuedRequests: 100,
      },
      retryOpts: {
        maxAttempts: 0,
      },
      events: {
        onBreak: ({ meta }) => {
          counters?.['personalized-digest']?.garmrBreak?.add(1, {
            service: meta.service,
          });
        },
        onHalfOpen: ({ meta }) => {
          counters?.['personalized-digest']?.garmrHalfOpen?.add(1, {
            service: meta.service,
          });
        },
        onReset: ({ meta }) => {
          counters?.['personalized-digest']?.garmrReset?.add(1, {
            service: meta.service,
          });
        },
        onRetry: ({ meta }) => {
          counters?.['personalized-digest']?.garmrRetry?.add(1, {
            service: meta.service,
          });
        },
      },
    }),
  },
);

export const getPersonalizedDigestEmailPayload = async ({
  con,
  logger,
  personalizedDigest,
  user,
  emailBatchId,
  emailSendDate,
  currentDate,
  previousSendDate,
  feature,
}: {
  con: DataSource;
  logger: FastifyBaseLogger;
  personalizedDigest: UserPersonalizedDigest;
  user: User;
  emailBatchId?: string;
  emailSendDate: Date;
  currentDate: Date;
  previousSendDate: Date;
  feature: PersonalizedDigestFeatureConfig;
}): Promise<SendEmailRequestWithTemplate | undefined> => {
  const feedConfig = await queryReadReplica(con, ({ queryRunner }) => {
    return feedToFilters(
      queryRunner.manager,
      personalizedDigest.userId,
      personalizedDigest.userId,
    );
  });

  const feedConfigPayload = {
    user_id: personalizedDigest.userId,
    total_posts: feature.maxPosts,
    date_from: format(previousSendDate, personalizedDigestDateFormat),
    date_to: format(currentDate, personalizedDigestDateFormat),
    allowed_tags: feedConfig.includeTags,
    blocked_tags: feedConfig.blockedTags,
    blocked_sources: feedConfig.excludeSources,
    feed_config_name: feature.feedConfig as FeedConfigName,
    source_types:
      baseFeedConfig.source_types?.filter(
        (el) => !feedConfig.excludeSourceTypes?.includes(el),
      ) || [],
    page_size: feature.maxPosts,
    total_pages: 1,
    blocked_author_ids: feedConfig.excludeUsers,
  };
  const feedResponse = await personalizedDigestFeedClient.fetchFeed(
    { log: logger },
    personalizedDigest.userId,
    feedConfigPayload,
  );

  const posts: TemplatePostData[] = await queryReadReplica(
    con,
    async ({ queryRunner }) => {
      return fixedIdsFeedBuilder(
        {},
        feedResponse.data.map(([postId]) => postId),
        queryRunner.manager
          .createQueryBuilder(Post, 'p')
          .select(
            [
              'p.id',
              'p.title',
              'p.image',
              'p."createdAt"',
              'p.summary',
              'p.upvotes',
              'p.comments',
              'p."readTime"',
              'p.views',
              'p.content',
              's.name as "sourceName"',
              's.image as "sourceImage"',
              'sp.title as "sharedPostTitle"',
              'sp.image as "sharedPostImage"',
            ].join(', '),
          )
          .leftJoin(Source, 's', 'p."sourceId" = s.id')
          .leftJoin(
            ArticlePost,
            'sp',
            'sp.id = p."sharedPostId" AND p.type = :shareType',
            {
              shareType: PostType.Share,
            },
          ),
        'p',
      ).execute();
    },
  );

  if (posts.length === 0) {
    logger.warn(
      { personalizedDigest, feedConfig: feedConfigPayload, emailBatchId },
      'no posts found for personalized digest',
    );

    return undefined;
  }

  const adProps = await getEmailAd({
    user,
    feature,
  });
  if (adProps) {
    logger.info(
      {
        adProps,
        personalizedDigest,
      },
      'Got Skadi powered Ad',
    );
  }

  const variationProps = await getEmailVariation({
    personalizedDigest,
    posts,
    user,
    feature,
    currentDate,
    adProps,
  });

  return {
    ...baseNotificationEmailData,
    send_at: Math.floor(emailSendDate.getTime() / 1000),
    transactional_message_id: feature.templateId,
    ...variationProps,
  };
};

export const digestPreferredHourOffset = 2;

export const schedulePersonalizedDigestSubscriptions = async ({
  queryBuilder,
  logger,
  sendType,
  handler,
}: {
  queryBuilder: SelectQueryBuilder<UserPersonalizedDigest>;
  logger: FastifyBaseLogger;
  sendType: UserPersonalizedDigestSendType[];
  handler: ({
    personalizedDigest,
    emailBatchId,
  }: {
    personalizedDigest: UserPersonalizedDigest;
    emailBatchId: string;
  }) => Promise<void>;
}) => {
  // Keep email batch id around just in case
  const emailBatchId = uuidv4();
  logger.info({ emailBatchId, sendType }, 'starting personalized digest send');

  let digestCount = 0;

  const personalizedDigestStream = await queryBuilder.stream();
  const notifyQueueConcurrency = +process.env.DIGEST_QUEUE_CONCURRENCY;
  const notifyQueue = fastq.promise(
    async ({
      personalizedDigest,
      emailBatchId,
    }: Parameters<typeof handler>[0]) => {
      await handler({ personalizedDigest, emailBatchId });

      digestCount += 1;
    },
    notifyQueueConcurrency,
  );

  personalizedDigestStream.on(
    'data',
    (personalizedDigest: UserPersonalizedDigest) => {
      notifyQueue.push({ personalizedDigest, emailBatchId });
    },
  );

  await new Promise((resolve, reject) => {
    personalizedDigestStream.on('error', (error) => {
      logger.error(
        { err: error, emailBatchId, sendType },
        'streaming personalized digest subscriptions failed',
      );

      reject(error);
    });
    personalizedDigestStream.on('end', () => resolve(true));
  });
  await notifyQueue.drained();

  logger.info(
    { digestCount, emailBatchId, sendType },
    'personalized digest sent',
  );
};

type SetEmailSendDateProps = {
  personalizedDigest: UserPersonalizedDigest;
  deduplicate: boolean;
  con: DataSource | EntityManager;
  date: Date;
};

const setEmailSendDate = async ({
  con,
  personalizedDigest,
  date,
  deduplicate,
}: Omit<SetEmailSendDateProps, 'date'> & {
  date: Date | null;
}) => {
  if (!deduplicate) {
    return;
  }

  return con.getRepository(UserPersonalizedDigest).update(
    {
      userId: personalizedDigest.userId,
      type: personalizedDigest.type,
    },
    {
      lastSendDate: date as Date,
    },
  );
};

export const dedupedSend = async (
  send: () => Promise<unknown>,
  { con, personalizedDigest, deduplicate, date }: SetEmailSendDateProps,
): Promise<void> => {
  const { lastSendDate = null } =
    (await con.getRepository(UserPersonalizedDigest).findOne({
      select: ['lastSendDate'],
      where: {
        userId: personalizedDigest.userId,
        type: personalizedDigest.type,
      },
    })) || {};

  if (deduplicate && lastSendDate && isSameDay(date, lastSendDate)) {
    return;
  }

  await setEmailSendDate({
    con,
    personalizedDigest,
    date,
    deduplicate,
  });

  try {
    await send();
  } catch (error) {
    // since email did not send we revert the lastSendDate
    // so worker can do it again in retry
    await setEmailSendDate({
      con,
      personalizedDigest,
      date: lastSendDate,
      deduplicate,
    });

    throw error;
  }
};

export const getDigestCronTime = (): string => 'NOW()';

export const digestSendTypeToBriefingType = (
  sendType: UserPersonalizedDigestSendType | undefined | null,
): BriefingType => {
  switch (sendType) {
    case UserPersonalizedDigestSendType.daily:
    case UserPersonalizedDigestSendType.workdays:
      return BriefingType.Daily;
    case UserPersonalizedDigestSendType.weekly:
      return BriefingType.Weekly;
    default:
      // sendeType null means weekly for legacy users
      return BriefingType.Weekly;
  }
};

export const personalizedDigestNotificationTypes = [
  NotificationType.BriefingReady,
];
