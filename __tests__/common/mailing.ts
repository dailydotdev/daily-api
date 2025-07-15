import nock from 'nock';
import { DataSource, In } from 'typeorm';
import { saveFixtures } from '../helpers';
import createOrGetConnection from '../../src/db';
import {
  User,
  UserPersonalizedDigest,
  UserPersonalizedDigestSendType,
  UserPersonalizedDigestType,
} from '../../src/entity';
import { usersFixture } from '../fixture/user';
import {
  CioUnsubscribeTopic,
  syncSubscription,
  updateFlagsStatement,
} from '../../src/common';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  nock.cleanAll();
  process.env.CIO_APP_KEY = 'test';
  await saveFixtures(
    con,
    User,
    usersFixture.map((item) => {
      return {
        ...item,
        id: `mss-${item.id}`,
      };
    }),
  );
});

describe('mailing', () => {
  describe('syncSubscription', () => {
    it('sync subscriptions for the given users', async () => {
      let users = await con.getRepository(User).find({
        where: {
          id: In(usersFixture.map((user) => `mss-${user.id}`)),
        },
      });

      nock(`https://api.customer.io`)
        .post('/v1/customers/attributes', {
          ids: users.map((user) => user.id),
        })
        .reply(200, {
          customers: users.map((user) => ({
            id: user.id,
            attributes: {
              cio_subscription_preferences: JSON.stringify({
                topics: {
                  [`topic_${CioUnsubscribeTopic.Marketing}`]: false,
                  [`topic_${CioUnsubscribeTopic.Digest}`]: true,
                  [`topic_${CioUnsubscribeTopic.Notifications}`]: true,
                  [`topic_${CioUnsubscribeTopic.Follow}`]: false,
                  [`topic_${CioUnsubscribeTopic.Award}`]: false,
                },
              }),
            },
            unsubscribed: false,
          })),
        });

      await syncSubscription(
        users.map((user) => user.id as string),
        con,
      );

      users = await con.getRepository(User).find({
        where: {
          id: In(usersFixture.map((user) => `mss-${user.id}`)),
        },
        order: {
          id: 'ASC',
        },
      });

      const digests = await con.getRepository(UserPersonalizedDigest).find({
        where: {
          userId: In(users.map((user) => user.id)),
          type: UserPersonalizedDigestType.Digest,
        },
        order: {
          userId: 'ASC',
        },
      });

      expect(digests).toHaveLength(4);

      users.forEach((user, index) => {
        expect(user.acceptedMarketing).toBe(false);
        expect(user.notificationEmail).toBe(true);
        expect(digests[index]).toMatchObject({
          userId: user.id,
          type: UserPersonalizedDigestType.Digest,
        });
        expect(user.followingEmail).toBe(false);
        expect(user.awardEmail).toBe(false);
      });
    });

    it('sync digest subscription with brief', async () => {
      let users = await con.getRepository(User).find({
        where: {
          id: In(usersFixture.map((user) => `mss-${user.id}`)),
        },
      });

      await con.getRepository(UserPersonalizedDigest).update(
        {
          userId: In(users.map((user) => user.id)),
        },
        {
          type: UserPersonalizedDigestType.Brief,
          flags: updateFlagsStatement<UserPersonalizedDigest>({
            sendType: UserPersonalizedDigestSendType.daily,
          }),
        },
      );

      nock(`https://api.customer.io`)
        .post('/v1/customers/attributes', {
          ids: users.map((user) => user.id),
        })
        .reply(200, {
          customers: users.map((user) => ({
            id: user.id,
            attributes: {
              cio_subscription_preferences: JSON.stringify({
                topics: {
                  [`topic_${CioUnsubscribeTopic.Marketing}`]: false,
                  [`topic_${CioUnsubscribeTopic.Digest}`]: true,
                  [`topic_${CioUnsubscribeTopic.Notifications}`]: true,
                  [`topic_${CioUnsubscribeTopic.Follow}`]: false,
                  [`topic_${CioUnsubscribeTopic.Award}`]: false,
                },
              }),
            },
            unsubscribed: false,
          })),
        });

      await syncSubscription(
        users.map((user) => user.id as string),
        con,
      );

      users = await con.getRepository(User).find({
        where: {
          id: In(usersFixture.map((user) => `mss-${user.id}`)),
        },
        order: {
          id: 'ASC',
        },
      });

      const digests = await con.getRepository(UserPersonalizedDigest).find({
        where: {
          userId: In(users.map((user) => user.id)),
          type: UserPersonalizedDigestType.Brief,
        },
        order: {
          userId: 'ASC',
        },
      });

      expect(digests).toHaveLength(4);

      users.forEach((user, index) => {
        expect(user.acceptedMarketing).toBe(false);
        expect(user.notificationEmail).toBe(true);
        expect(digests[index]).toMatchObject({
          userId: user.id,
          type: UserPersonalizedDigestType.Brief,
          flags: {
            sendType: UserPersonalizedDigestSendType.daily,
          },
        });
        expect(user.followingEmail).toBe(false);
        expect(user.awardEmail).toBe(false);
      });
    });
  });
});
