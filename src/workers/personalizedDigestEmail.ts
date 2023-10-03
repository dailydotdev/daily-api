import {
  addNotificationUtm,
  baseNotificationEmailData,
  feedToFilters,
  fixedIdsFeedBuilder,
  getDiscussionLink,
  pickImageUrl,
  sendEmail,
} from '../common';
import { ArticlePost, Post, Source, User } from '../entity';
import { UserPersonalizedDigest } from '../entity/UserPersonalizedDigest';
import { messageToJson, Worker } from './worker';
import { DayOfWeek } from '../types';
import { MailDataRequired } from '@sendgrid/mail';
import { format, nextDay, previousDay } from 'date-fns';
import { zonedTimeToUtc } from 'date-fns-tz';
import { personalizedDigestFeedClient } from '../integrations/feed/generators';

interface Data {
  personalizedDigest: UserPersonalizedDigest;
}

type TemplatePostData = Pick<
  ArticlePost,
  'id' | 'title' | 'image' | 'createdAt'
> & {
  sourceName: Source['name'];
  sourceImage: Source['image'];
};

const personalizedDigestPostsCount = 5;

const emailTemplateId = 'd-328d1104d2e04fa1ab91e410e02751cb';

const personalizedDigestDateFormat = 'yyyy-MM-dd HH:mm:ss';

const getEmailSendDate = ({
  personalizedDigest,
}: {
  personalizedDigest: UserPersonalizedDigest;
}): Date => {
  const nextPreferredDay = nextDay(new Date(), personalizedDigest.preferredDay);
  nextPreferredDay.setHours(personalizedDigest.preferredHour, 0, 0, 0);
  const sendDateInPreferredTimezone = zonedTimeToUtc(
    nextPreferredDay,
    personalizedDigest.preferredTimezone,
  );

  return sendDateInPreferredTimezone;
};

const getPreviousSendDate = ({
  personalizedDigest,
}: {
  personalizedDigest: UserPersonalizedDigest;
}): Date => {
  const nextPreferredDay = previousDay(
    new Date(),
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
  const templateData = posts.map((post) => {
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

  return templateData;
};

const worker: Worker = {
  subscription: 'api.personalized-digest-email',
  handler: async (message, con, logger) => {
    if (process.env.NODE_ENV === 'development') {
      return;
    }

    const data = messageToJson<Data>(message);
    const { personalizedDigest } = data;

    const user = await con.getRepository(User).findOneBy({
      id: personalizedDigest.userId,
    });

    if (!user?.infoConfirmed) {
      return;
    }

    const currentDate = new Date();
    const emailSendDate = getEmailSendDate({ personalizedDigest });
    const previousSendDate = getPreviousSendDate({ personalizedDigest });

    const feedConfig = await feedToFilters(
      con,
      personalizedDigest.userId,
      personalizedDigest.userId,
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
      feedResponse.map(([postId]) => postId),
      con
        .createQueryBuilder(Post, 'p')
        .select(
          'p.id, p.title, p.image, p."createdAt", s.name as "sourceName", s.image as "sourceImage"',
        )
        .leftJoin(Source, 's', 'p."sourceId" = s.id'),
      'p',
    ).execute();

    if (posts.length === 0) {
      logger.warn(
        { data: messageToJson(message) },
        'no posts found for personalized digest',
      );

      return;
    }

    const [dayName] = Object.entries(DayOfWeek).find(
      ([, value]) => value === personalizedDigest.preferredDay,
    );
    const userName = user.name?.trim().split(' ')[0] || user.username;
    const emailPayload: MailDataRequired = {
      ...baseNotificationEmailData,
      to: {
        email: user.email,
        name: user.name,
      },
      sendAt: Math.floor(emailSendDate.getTime() / 1000),
      templateId: emailTemplateId,
      dynamicTemplateData: {
        day_name: dayName,
        first_name: userName,
        posts: await getPostsTemplateData({ posts }),
      },
      asm: {
        groupId: 23809,
      },
      category: 'Digests',
    };

    await sendEmail(emailPayload);
  },
};

export default worker;
