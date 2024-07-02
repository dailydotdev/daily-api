import nock from 'nock';
import { DataSource, Not } from 'typeorm';
import { saveFixtures } from '../helpers';
import createOrGetConnection from '../../src/db';
import { User } from '../../src/entity';
import { usersFixture } from '../fixture/user';
import { CioUnsubscribeTopic, syncSubscription } from '../../src/common';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  nock.cleanAll();
  await saveFixtures(con, User, usersFixture);
});

describe('mailing', () => {
  describe('syncSubscription', () => {
    it('sync subscriptions for the given users', async () => {
      nock(`https://api.customer.io`)
        .post('/v1/customers/attributes', {
          ids: usersFixture.map((user) => user.id),
        })
        .reply(200, {
          customers: usersFixture.map((user) => ({
            id: user.id,
            attributes: {
              cio_subscription_preferences: JSON.stringify({
                topics: {
                  [`topic_${CioUnsubscribeTopic.Marketing}`]: false,
                  [`topic_${CioUnsubscribeTopic.Digest}`]: true,
                  [`topic_${CioUnsubscribeTopic.Notifications}`]: true,
                },
              }),
            },
            unsubscribed: false,
          })),
        });

      await syncSubscription(
        usersFixture.map((user) => user.id as string),
        con,
      );

      const users = await con.getRepository(User).find({
        where: {
          id: Not('404'),
        },
      });

      users.forEach((user) => {
        expect(user.acceptedMarketing).toBe(false);
        expect(user.notificationEmail).toBe(true);
      });
    });
  });
});
