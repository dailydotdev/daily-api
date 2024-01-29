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

interface Data {
  personalizedDigest: UserPersonalizedDigest;
  generationTimestamp: number;
  emailBatchId: string;
}

type TemplatePostData = Pick<
  ArticlePost,
  'id' | 'title' | 'image' | 'createdAt' | 'summary'
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

const personalizedDigestPostsCount = 5;

const emailTemplateId = 'd-328d1104d2e04fa1ab91e410e02751cb';

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
      source_name: post.sourceName,
      source_image: post.sourceImage,
    };
  });
};

const getEmailVariation = async (
  variation: number,
  firstName: string,
  dayName: string,
  posts: TemplatePostData[],
): Promise<Partial<MailDataRequired>> => {
  const defaultPreview = `Every ${dayName}, we'll send you five posts you haven't read. Each post was carefully picked based on topics you love reading about. Let's get to it!`;
  const data = {
    day_name: dayName,
    first_name: firstName,
    posts: getPostsTemplateData({ posts }),
  };
  if (variation === 2) {
    return {
      dynamicTemplateData: {
        ...data,
        title: posts[0].title,
        preview: posts[0].summary || defaultPreview,
      },
      from: {
        email: 'digest@daily.dev',
        name: 'Weekly Digest',
      },
    };
  }

  return {
    dynamicTemplateData: {
      ...data,
      title: `${firstName}, your personal weekly update from daily.dev is ready`,
      preview: defaultPreview,
    },
  };
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
        total_posts: personalizedDigestPostsCount,
        date_from: format(previousSendDate, personalizedDigestDateFormat),
        date_to: format(currentDate, personalizedDigestDateFormat),
        allowed_tags: feedConfig.includeTags,
        blocked_tags: feedConfig.blockedTags,
        blocked_sources: feedConfig.excludeSources,
      },
    );

    const posts: TemplatePostData[] = await fixedIdsFeedBuilder(
      {},
      feedResponse.data.map(([postId]) => postId),
      con
        .createQueryBuilder(Post, 'p')
        .select(
          'p.id, p.title, p.image, p."createdAt", p.summary, s.name as "sourceName", s.image as "sourceImage"',
        )
        .leftJoin(Source, 's', 'p."sourceId" = s.id'),
      'p',
    ).execute();

    if (posts.length === 0) {
      return;
    }

    const [dayName] = Object.entries(DayOfWeek).find(
      ([, value]) => value === personalizedDigest.preferredDay,
    );
    const userName = user.name?.trim().split(' ')[0] || user.username;
    const variationProps = await getEmailVariation(
      personalizedDigest.variation,
      userName,
      dayName,
      posts,
    );
    const emailPayload: MailDataRequired = {
      ...baseNotificationEmailData,
      to: {
        email: user.email,
        name: userName,
      },
      sendAt: Math.floor(emailSendDate.getTime() / 1000),
      templateId: emailTemplateId,
      asm: {
        groupId: 23809,
      },
      category: 'Digests',
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
