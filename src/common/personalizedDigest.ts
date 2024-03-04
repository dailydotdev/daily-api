import {
  ArticlePost,
  Post,
  Source,
  User,
  UserPersonalizedDigest,
} from '../entity';
import { DayOfWeek } from '../types';
import { MailDataRequired } from '@sendgrid/mail';
import { format, nextDay, previousDay } from 'date-fns';
import { features } from '../growthbook';
import { feedToFilters, fixedIdsFeedBuilder } from './feedGenerator';
import { FeedClient } from '../integrations/feed';
import { addNotificationUtm, baseNotificationEmailData } from './mailing';
import { pickImageUrl } from './post';
import { getDiscussionLink } from './links';
import { DataSource } from 'typeorm';
import { FastifyBaseLogger } from 'fastify';
import { zonedTimeToUtc } from 'date-fns-tz';

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
};

export const getPersonalizedDigestSendDate = ({
  personalizedDigest,
  generationTimestamp,
}: EmailSendDateProps): Date => {
  const nextPreferredDay = nextDay(
    new Date(generationTimestamp),
    personalizedDigest.preferredDay,
  );
  nextPreferredDay.setHours(personalizedDigest.preferredHour, 0, 0, 0);
  return zonedTimeToUtc(nextPreferredDay, personalizedDigest.preferredTimezone);
};

export const getPersonalizedDigestPreviousSendDate = ({
  personalizedDigest,
  generationTimestamp,
}: EmailSendDateProps): Date => {
  const nextPreferredDay = previousDay(
    new Date(generationTimestamp),
    personalizedDigest.preferredDay,
  );
  nextPreferredDay.setHours(personalizedDigest.preferredHour, 0, 0, 0);
  const sendDateInPreferredTimezone = zonedTimeToUtc(
    nextPreferredDay,
    personalizedDigest.preferredTimezone,
  );

  return sendDateInPreferredTimezone;
};

const getPostsTemplateData = ({ posts }: { posts: TemplatePostData[] }) => {
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
        post.summary?.length > 150
          ? `${post.summary.slice(0, 150).trim()}...`
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
  feature: typeof features.personalizedDigest.defaultValue;
  currentDate: Date;
}): Promise<Partial<MailDataRequired>> => {
  const [dayName] = Object.entries(DayOfWeek).find(
    ([, value]) => value === personalizedDigest.preferredDay,
  );
  const userName = user.name?.trim().split(' ')[0] || user.username;
  const data = {
    day_name: dayName,
    first_name: userName,
    posts: getPostsTemplateData({ posts }),
    date: format(currentDate, 'MMM d, yyyy'),
    user: {
      username: user.username,
      image: user.image,
      reputation: user.reputation,
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
  feature: typeof features.personalizedDigest.defaultValue;
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
