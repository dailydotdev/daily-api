import { DataSource } from 'typeorm';
import {
  baseNotificationEmailData,
  getDiscussionLink,
  pickImageUrl,
  sendEmail,
} from '../common';
import { ArticlePost, Source, User } from '../entity';
import { UserPersonalizedDigest } from '../entity/UserPersonalizedDigest';
import { messageToJson, Worker } from './worker';
import { DayOfWeek } from '../types';
import { MailDataRequired } from '@sendgrid/mail';
import { nextDay } from 'date-fns';
import { zonedTimeToUtc } from 'date-fns-tz';

interface Data {
  personalizedDigest: UserPersonalizedDigest;
}

const personalizedDigestPostsCount = 5;

const emailTemplateId = 'd-328d1104d2e04fa1ab91e410e02751cb';

// TODO WT-1820 replace with feed config fetch
const getMockedPosts = async ({
  con,
}: {
  con: DataSource;
}): Promise<(ArticlePost & { source: Source })[]> => {
  const posts = await con.getRepository(ArticlePost).find({
    take: personalizedDigestPostsCount,
    order: {
      createdAt: 'DESC',
    },
    relations: ['source'],
  });

  return Promise.all(
    posts.map(async (post) => {
      const source = await post.source;

      return {
        ...post,
        source,
      } as ArticlePost & { source: Source };
    }),
  );
};

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

const worker: Worker = {
  subscription: 'api.personalized-digest-email',
  handler: async (message, con) => {
    const data = messageToJson<Data>(message);
    const { personalizedDigest } = data;

    const user = await con.getRepository(User).findOneBy({
      id: personalizedDigest.userId,
    });

    if (!user || !user.infoConfirmed) {
      return;
    }

    const posts = await getMockedPosts({ con });

    const [dayName] = Object.entries(DayOfWeek).find(
      ([, value]) => value === personalizedDigest.preferredDay,
    );
    const userName = user.name?.trim().split(' ')[0] || user.username;
    const emailSendDate = getEmailSendDate({ personalizedDigest });
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
        posts: posts.map((post) => {
          const postUrl = new URL(getDiscussionLink(post.id));
          postUrl.searchParams.append('utm_source', 'notification');
          postUrl.searchParams.append('utm_medium', 'email');
          postUrl.searchParams.append('utm_campaign', 'digest');

          return {
            post_title: post.title,
            post_image: post.image || pickImageUrl(post),
            post_link: postUrl.toString(),
            source_name: post.source.name,
            source_image: post.source.image,
          };
        }),
      },
    };

    await sendEmail(emailPayload);
  },
};

export default worker;
