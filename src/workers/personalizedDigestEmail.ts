import {
  addNotificationUtm,
  baseNotificationEmailData,
  feedToFilters,
  fixedIdsFeedBuilder,
  getDiscussionLink,
  pickImageUrl,
  sendEmail,
} from '../common';
import {
  ArticlePost,
  Post,
  Source,
  User,
  UserPersonalizedDigest,
} from '../entity';
import { messageToJson, Worker } from './worker';
import { DayOfWeek } from '../types';
import { MailDataRequired } from '@sendgrid/mail';
import { format, isSameDay, nextDay, previousDay } from 'date-fns';
import { zonedTimeToUtc } from 'date-fns-tz';
import { FeedClient } from '../integrations/feed';
import { DataSource } from 'typeorm';
import { features, getUserGrowthBookInstace } from '../growthbook';

interface Data {
  personalizedDigest: UserPersonalizedDigest;
  generationTimestamp: number;
  emailBatchId: string;
}

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

type EmailSendDateProps = Pick<
  Data,
  'personalizedDigest' | 'generationTimestamp'
>;

type SetEmailSendDateProps = Pick<Data, 'personalizedDigest'> & {
  con: DataSource;
  date: Date;
};

const personalizedDigestDateFormat = 'yyyy-MM-dd HH:mm:ss';

const getEmailSendDate = ({
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

const getPreviousSendDate = ({
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
      post_summary: post.summary,
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

  if (personalizedDigest.variation === 2) {
    mailData.from = {
      email: 'digest@daily.dev',
      name: 'Weekly Digest',
    };
    mailData.dynamicTemplateData.title = posts[0].title;

    if (posts[0].summary) {
      mailData.dynamicTemplateData.preview = posts[0].summary;
    }
  }

  return mailData;
};

const setEmailSendDate = async ({
  con,
  personalizedDigest,
  date,
}: SetEmailSendDateProps) => {
  return con.getRepository(UserPersonalizedDigest).update(
    {
      userId: personalizedDigest.userId,
    },
    {
      lastSendDate: date,
    },
  );
};

const worker: Worker = {
  subscription: 'api.personalized-digest-email',
  handler: async (message, con, logger) => {
    if (process.env.NODE_ENV === 'development') {
      return;
    }

    const data = messageToJson<Data>(message);

    const { personalizedDigest, generationTimestamp, emailBatchId } = data;

    const user = await con.getRepository(User).findOneBy({
      id: personalizedDigest.userId,
    });

    if (!user?.infoConfirmed) {
      return;
    }

    const growthbookClient = getUserGrowthBookInstace(user.id, {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      trackingCallback: (experiment, result) => {
        // TODO notify allocation
      },
    });

    const digestFeature = growthbookClient.getFeatureValue(
      features.personalizedDigest.id,
      features.personalizedDigest.defaultValue,
    );

    const currentDate = new Date();
    const emailSendDate = getEmailSendDate({
      personalizedDigest,
      generationTimestamp,
    });
    const previousSendDate = getPreviousSendDate({
      personalizedDigest,
      generationTimestamp,
    });

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
        total_posts: digestFeature.maxPosts,
        date_from: format(previousSendDate, personalizedDigestDateFormat),
        date_to: format(currentDate, personalizedDigestDateFormat),
        allowed_tags: feedConfig.includeTags,
        blocked_tags: feedConfig.blockedTags,
        blocked_sources: feedConfig.excludeSources,
        feed_config_name: digestFeature.feedConfig,
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
      return;
    }

    const variationProps = await getEmailVariation({
      personalizedDigest,
      posts,
      user,
      feature: digestFeature,
      currentDate,
    });
    const emailPayload: MailDataRequired = {
      ...baseNotificationEmailData,
      sendAt: Math.floor(emailSendDate.getTime() / 1000),
      templateId: digestFeature.templateId,
      asm: {
        groupId: digestFeature.meta.asmGroupId,
      },
      category: digestFeature.meta.category,
      batchId: emailBatchId,
      ...variationProps,
    };

    const { lastSendDate = null } =
      (await con.getRepository(UserPersonalizedDigest).findOne({
        select: ['lastSendDate'],
        where: {
          userId: personalizedDigest.userId,
        },
      })) || {};

    if (lastSendDate && isSameDay(currentDate, lastSendDate)) {
      return;
    }

    await setEmailSendDate({
      con,
      personalizedDigest,
      date: currentDate,
    });

    try {
      await sendEmail(emailPayload);
    } catch (error) {
      // since email did not send we revert the lastSendDate
      // so worker can do it again in retry
      await setEmailSendDate({
        con,
        personalizedDigest,
        date: lastSendDate,
      });

      throw error;
    }
  },
};

export default worker;
