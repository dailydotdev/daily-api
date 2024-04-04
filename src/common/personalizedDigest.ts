import {
  ArticlePost,
  Post,
  Source,
  User,
  UserPersonalizedDigest,
  UserPersonalizedDigestSendType,
  UserStreak,
} from '../entity';
import { DayOfWeek } from '../types';
import { MailDataRequired } from '@sendgrid/mail';
import { format, isSameDay, nextDay, previousDay } from 'date-fns';
import { PersonalizedDigestFeatureConfig } from '../growthbook';
import { feedToFilters, fixedIdsFeedBuilder } from './feedGenerator';
import { FeedClient } from '../integrations/feed';
import {
  addNotificationUtm,
  baseNotificationEmailData,
  createEmailBatchId,
} from './mailing';
import { pickImageUrl } from './post';
import { getDiscussionLink } from './links';
import { DataSource, SelectQueryBuilder } from 'typeorm';
import { FastifyBaseLogger } from 'fastify';
import { zonedTimeToUtc } from 'date-fns-tz';
import fastq from 'fastq';

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
        post.summary?.length > feature.longTextLimit
          ? `${post.summary.slice(0, feature.longTextLimit).trim()}...`
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
}): Promise<Partial<MailDataRequired>> => {
  const [dayName] = Object.entries(DayOfWeek).find(
    ([, value]) => value === personalizedDigest.preferredDay,
  );
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

  const mailData = {
    from: {
      email: feature.meta.from.email,
      name: feature.meta.from.name,
    },
    to: {
      email: user.email,
      name: userName,
    },
    dynamicTemplateData: {
      ...data,
      title: `${userName}, your personal weekly update from daily.dev is ready`,
      preview: `Every ${dayName}, we'll send you five posts you haven't read. Each post was carefully picked based on topics you love reading about. Let's get to it!`,
    },
  };

  return mailData;
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
}): Promise<MailDataRequired | undefined> => {
  const feedConfig = await feedToFilters(
    con,
    personalizedDigest.userId,
    personalizedDigest.userId,
  );
  const personalizedDigestFeedClient = new FeedClient(
    process.env.PERSONALIZED_DIGEST_FEED,
  );

  const feedResponse = await personalizedDigestFeedClient.fetchFeed(
    { log: logger },
    personalizedDigest.userId,
    {
      user_id: personalizedDigest.userId,
      total_posts: feature.maxPosts,
      date_from: format(previousSendDate, personalizedDigestDateFormat),
      date_to: format(currentDate, personalizedDigestDateFormat),
      allowed_tags: feedConfig.includeTags,
      blocked_tags: feedConfig.blockedTags,
      blocked_sources: feedConfig.excludeSources,
      feed_config_name: feature.feedConfig,
    },
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
    return undefined;
  }

  const variationProps = await getEmailVariation({
    personalizedDigest,
    posts,
    user,
    feature,
    currentDate,
  });

  const emailPayload: MailDataRequired = {
    ...baseNotificationEmailData,
    sendAt: Math.floor(emailSendDate.getTime() / 1000),
    templateId: feature.templateId,
    asm: {
      groupId: feature.meta.asmGroupId,
    },
    category: feature.meta.category,
    batchId: emailBatchId,
    ...variationProps,
  };

  return emailPayload;
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
  const emailBatchId = await createEmailBatchId();

  if (!emailBatchId) {
    throw new Error('failed to create email batch id');
  }

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
}: SetEmailSendDateProps) => {
  if (!deduplicate) {
    return;
  }

  return con.getRepository(UserPersonalizedDigest).update(
    {
      userId: personalizedDigest.userId,
      type: personalizedDigest.type,
    },
    {
      lastSendDate: date,
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
