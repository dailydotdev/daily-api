import type { DataSource } from 'typeorm';
import { getEmailAd } from '../../src/common/personalizedDigest';
import createOrGetConnection from '../../src/db';
import { saveFixtures } from '../helpers';
import { User } from '../../src/entity/user/User';
import { usersFixture } from '../fixture/user';
import nock from 'nock';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

describe('getEmailAd', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    nock.cleanAll();

    await saveFixtures(
      con,
      User,
      usersFixture.map((user) => {
        return {
          ...user,
          id: `${user.id}-cgea`,
          username: `${user.username}-cgea`,
        };
      }),
    );
  });

  it('should return ad', async () => {
    nock('http://localhost:8080')
      .post('/private', {
        placement: 'default_digest',
        metadata: { USERID: '1-cgea' },
      })
      .reply(200, {
        type: 'ad',
        value: {
          digest: {
            call_to_action: 'Click now!',
            company_logo: ' https://daily.dev/image',
            company_name: 'WE',
            image: 'https://daily.dev/image',
            link: 'https://daily.dev/ad',
            title: 'Ad title',
            type: 'dynamic_ad',
          },
        },
        pixels: [],
      });

    const user = await con.getRepository(User).findOneByOrFail({
      id: '1-cgea',
    });

    const ad = await getEmailAd({
      user,
      feature: {
        templateId: '75',
      },
    });

    expect(ad).toEqual({
      call_to_action: 'Click now!',
      company_logo: ' https://daily.dev/image',
      company_name: 'WE',
      image: 'https://daily.dev/image',
      link: 'https://daily.dev/ad',
      title: 'Ad title',
      type: 'dynamic_ad',
    });
  });

  it('should return null if no ad available', async () => {
    nock('http://localhost:8080')
      .post('/private', {
        placement: 'default_digest',
        metadata: { USERID: '2-cgea' },
      })
      .reply(200, {});

    const user = await con.getRepository(User).findOneByOrFail({
      id: '2-cgea',
    });

    const ad = await getEmailAd({
      user,
      feature: {
        templateId: '75',
      },
    });

    expect(ad).toBeNull();
  });
});
