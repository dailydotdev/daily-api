import {
  ArticlePost,
  Post,
  Source,
  User,
  UserPersonalizedDigest,
  UserPersonalizedDigestSendType,
  UserStreak,
} from '../entity';
import { format, isSameDay, nextDay, previousDay } from 'date-fns';
import { PersonalizedDigestFeatureConfig } from '../growthbook';
import { feedToFilters, fixedIdsFeedBuilder } from './feedGenerator';
import { FeedClient } from '../integrations/feed';
import { addNotificationUtm, baseNotificationEmailData } from './mailing';
import { pickImageUrl } from './post';
import { getDiscussionLink } from './links';
import { DataSource, SelectQueryBuilder } from 'typeorm';
import { FastifyBaseLogger } from 'fastify';
import { zonedTimeToUtc } from 'date-fns-tz';
import fastq from 'fastq';
import { SendEmailRequestWithTemplate } from 'customerio-node/dist/lib/api/requests';
import { v4 as uuidv4 } from 'uuid';
import { DayOfWeek } from './date';
import { fetchOptions } from '../http';

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
      post_title: post.title,
      post_image: post.image || pickImageUrl(post),
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
      source_image: post.sourceImage,
    };
  });
};

const getEmailVariation = async ({
  personalizedDigest,
  posts,
  user,
  feature,
  currentDate,
}: {
  personalizedDigest: UserPersonalizedDigest;
  posts: TemplatePostData[];
  user: User;
  userStreak?: UserStreak;
  feature: PersonalizedDigestFeatureConfig;
  currentDate: Date;
}): Promise<
  Pick<SendEmailRequestWithTemplate, 'to' | 'message_data' | 'identifiers'>
> => {
  const dayEntry = Object.entries(DayOfWeek).find(
    ([, value]) => value === personalizedDigest.preferredDay,
  );
  const dayName = dayEntry ? dayEntry[0] : undefined;
  const userName = user.name?.trim().split(' ')[0] || user.username;
  const userStreak = await user.streak;
  const data = {
    day_name: dayName,
    first_name: userName,
    posts: getPostsTemplateData({ posts, feature }),
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
  const feedConfig = await feedToFilters(
    con,
    personalizedDigest.userId,
    personalizedDigest.userId,
  );
  const personalizedDigestFeedClient = new FeedClient(
    process.env.PERSONALIZED_DIGEST_FEED,
    {
      ...fetchOptions,
      retries: 1,
    },
  );

  const feedConfigPayload = {
    user_id: personalizedDigest.userId,
    total_posts: feature.maxPosts,
    date_from: format(previousSendDate, personalizedDigestDateFormat),
    date_to: format(currentDate, personalizedDigestDateFormat),
    allowed_tags: feedConfig.includeTags,
    blocked_tags: feedConfig.blockedTags,
    blocked_sources: feedConfig.excludeSources,
    feed_config_name: feature.feedConfig,
  };
  const feedResponse = await personalizedDigestFeedClient.fetchFeed(
    { log: logger },
    personalizedDigest.userId,
    feedConfigPayload,
  );

  const posts: TemplatePostData[] = await fixedIdsFeedBuilder(
    {},
    feedResponse.data.map(([postId]) => postId),
    con
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
          's.name as "sourceName"',
          's.image as "sourceImage"',
        ].join(', '),
      )
      .leftJoin(Source, 's', 'p."sourceId" = s.id'),
    'p',
  ).execute();

  if (posts.length === 0) {
    logger.warn(
      { personalizedDigest, feedConfig: feedConfigPayload, emailBatchId },
      'no posts found for personalized digest',
    );

    return undefined;
  }

  const variationProps = await getEmailVariation({
    personalizedDigest,
    posts,
    user,
    feature,
    currentDate,
  });

  return {
    ...baseNotificationEmailData,
    send_at: Math.floor(emailSendDate.getTime() / 1000),
    transactional_message_id: feature.templateId,
    ...variationProps,
  };
};

export const digestPreferredHourOffset = 4;

export const schedulePersonalizedDigestSubscriptions = async ({
  queryBuilder,
  logger,
  sendType,
  handler,
}: {
  queryBuilder: SelectQueryBuilder<UserPersonalizedDigest>;
  logger: FastifyBaseLogger;
  sendType: UserPersonalizedDigestSendType;
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
    personalizedDigestStream.on('end', resolve);
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
  con: DataSource;
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
