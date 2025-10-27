import appFunc from '../src';
import { FastifyInstance } from 'fastify';
import { authorizeRequest, saveFixtures, TEST_UA } from './helpers';
import { ArticlePost, Source, User, YouTubePost } from '../src/entity';
import { sourcesFixture } from './fixture/source';
import request from 'supertest';
import { postsFixture, videoPostsFixture } from './fixture/post';
import { hmacHashIP, notifyView } from '../src/common';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import { fallbackImages } from '../src/config';
import { usersFixture } from './fixture/user';
import { UserReferralLinkedin } from '../src/entity/user/referral/UserReferralLinkedin';
import { logger } from '../src/logger';
import { UserReferralStatus } from '../src/entity/user/referral/UserReferral';

jest.mock('../src/common', () => ({
  ...(jest.requireActual('../src/common') as Record<string, unknown>),
  notifyView: jest.fn(),
}));

let app: FastifyInstance;
let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
  app = await appFunc();
  return app.ready();
});

afterAll(() => app.close());

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, ArticlePost, postsFixture);
  await saveFixtures(con, YouTubePost, videoPostsFixture);
});

describe('GET /r/:postId', () => {
  it('should return not found', () => {
    return request(app.server).get('/r/not').expect(404);
  });

  it('should redirect to post url', () => {
    return request(app.server)
      .get('/r/p1')
      .expect(302)
      .expect('Location', 'http://p1.com/?ref=dailydev');
  });

  it('should redirect to youtube post url', () => {
    return request(app.server)
      .get('/r/yt1')
      .expect(302)
      .expect('Location', 'https://youtu.be/T_AbQGe7fuU?ref=dailydev');
  });

  it('should render redirect html and notify view event', async () => {
    await request(app.server)
      .get('/r/p1')
      .set('user-agent', TEST_UA)
      .set('cookie', 'da2=u1')
      .set('referer', 'https://daily.dev')
      .expect(200)
      .expect('content-type', 'text/html')
      .expect('referrer-policy', 'origin, origin-when-cross-origin')
      .expect('link', `<http://p1.com/?ref=dailydev>; rel="preconnect"`)
      .expect(
        '<html><head><meta name="robots" content="noindex,nofollow"><meta http-equiv="refresh" content="0;URL=http://p1.com/?ref=dailydev"></head></html>',
      );
    expect(notifyView).toBeCalledWith(
      expect.anything(),
      'p1',
      'u1',
      'https://daily.dev',
      expect.anything(),
      ['javascript', 'webdev'],
    );
  });

  it('should render redirect html with hash value', async () => {
    await request(app.server)
      .get('/r/p1?a=id')
      .set('user-agent', TEST_UA)
      .expect(200)
      .expect('content-type', 'text/html')
      .expect('referrer-policy', 'origin, origin-when-cross-origin')
      .expect('link', `<http://p1.com/?ref=dailydev>; rel="preconnect"`)
      .expect(
        '<html><head><meta name="robots" content="noindex,nofollow"><meta http-equiv="refresh" content="0;URL=http://p1.com/?ref=dailydev#id"></head></html>',
      );
  });

  it('should concat query params correctly', async () => {
    await con
      .getRepository(ArticlePost)
      .update({ id: 'p1' }, { url: 'http://p1.com/?a=b' });
    return request(app.server)
      .get('/r/p1')
      .expect(302)
      .expect('Location', 'http://p1.com/?a=b&ref=dailydev');
  });

  it('should redirect to post page when url is not available', async () => {
    await con.getRepository(ArticlePost).update({ id: 'p1' }, { url: null });
    return request(app.server)
      .get('/r/p1')
      .expect(302)
      .expect('Location', 'http://localhost:5002/posts/p1-p1');
  });
});

describe('GET /:id/profile-image', () => {
  beforeEach(async () => {
    await con.getRepository(User).save([
      {
        id: '1',
        name: 'Ido',
        image: 'https://daily.dev/ido.jpg',
        timezone: 'utc',
        createdAt: new Date(),
      },
    ]);
  });

  it('should return profile picture for user', async () => {
    return request(app.server)
      .get('/1/profile-image')
      .expect(302)
      .expect('Location', 'https://daily.dev/ido.jpg');
  });

  it('should return default image for non existing user', async () => {
    return request(app.server)
      .get('/123/profile-image')
      .expect(302)
      .expect('Location', fallbackImages.avatar);
  });
});

describe('GET /r/recruiter/:id', () => {
  const spyLogger = jest.fn();
  const recruiterUrl =
    'https://recruiter.daily.dev/?utm_source=redirector&utm_medium=linkedin_referral';

  const saveReferral = async (override?: Partial<UserReferralLinkedin>) => {
    return con.getRepository(UserReferralLinkedin).save({
      userId: usersFixture[0].id,
      externalUserId: 'ext-0',
      flags: { hashedRequestIP: hmacHashIP('198.51.100.1') },
      ...override,
    });
  };

  const getReferral = async (id: string) => {
    return con.getRepository(UserReferralLinkedin).findOne({ where: { id } });
  };

  beforeEach(async () => {
    await saveFixtures(con, User, usersFixture);
  });

  it('should redirect to recruiter landing', async () => {
    const r = await saveReferral();
    const res = await request(app.server)
      .get(`/r/recruiter/${r.id}`)
      .set('Referer', 'https://www.linkedin.com/')
      .set('X-Forwarded-For', '203.0.113.1');

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(recruiterUrl);
  });

  it('should redirect to recruiter landing even with invalid UUID', async () => {
    jest.spyOn(logger, 'debug').mockImplementation(spyLogger);
    const res = await request(app.server)
      .get(`/r/recruiter/invalid-uuid`)
      .set('Referer', 'https://www.linkedin.com/')
      .set('X-Forwarded-For', '203.0.113.1');

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(recruiterUrl);

    await new Promise((r) => setTimeout(r, 100)); // wait for onResponse async tasks

    expect(spyLogger).toHaveBeenCalledTimes(1);
    expect(spyLogger).toHaveBeenCalledWith(
      { referralId: 'invalid-uuid' },
      'Invalid referral id provided, skipping recruiter redirector',
    );
  });

  it('should redirect to recruiter landing without marking visited if user is logged in', async () => {
    jest.spyOn(logger, 'debug').mockImplementation(spyLogger);
    const r = await saveReferral();

    const res = await authorizeRequest(
      request(app.server)
        .get(`/r/recruiter/${r.id}`)
        .set('Referer', 'https://www.linkedin.com/')
        .set('X-Forwarded-For', '203.0.113.1'),
    );
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(recruiterUrl);

    await new Promise((r) => setTimeout(r, 100)); // wait for onResponse async tasks

    expect(spyLogger).toHaveBeenCalledTimes(1);
    expect(spyLogger).toHaveBeenCalledWith(
      { referralId: r.id },
      'User is logged in, skipping recruiter redirector',
    );

    const referral = await getReferral(r.id);
    expect(referral?.visited).toBe(false);
  });

  it('should redirect to recruiter landing without marking visited if no referrer', async () => {
    jest.spyOn(logger, 'debug').mockImplementation(spyLogger);
    const r = await saveReferral();

    const res = await request(app.server)
      .get(`/r/recruiter/${r.id}`)
      .set('X-Forwarded-For', '203.0.113.1');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(recruiterUrl);

    await new Promise((r) => setTimeout(r, 100)); // wait for onResponse async tasks

    expect(spyLogger).toHaveBeenCalledTimes(1);
    expect(spyLogger).toHaveBeenCalledWith(
      { referralId: r.id },
      'No referrer provided, skipping recruiter redirector',
    );

    const referral = await getReferral(r.id);
    expect(referral?.visited).toBe(false);
  });

  it('should redirect to recruiter landing without marking visited if referrer is not linkedin', async () => {
    jest.spyOn(logger, 'debug').mockImplementation(spyLogger);
    const r = await saveReferral();

    const res = await request(app.server)
      .get(`/r/recruiter/${r.id}`)
      .set('Referer', 'https://daily.dev/')
      .set('X-Forwarded-For', '203.0.113.1');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(recruiterUrl);

    await new Promise((r) => setTimeout(r, 100)); // wait for onResponse async tasks

    expect(spyLogger).toHaveBeenCalledTimes(1);
    expect(spyLogger).toHaveBeenCalledWith(
      {
        referralId: r.id,
        referrer: 'https://daily.dev/',
      },
      'Referrer is not linkedin, skipping recruiter redirector',
    );

    const referral = await getReferral(r.id);
    expect(referral?.visited).toBe(false);
  });

  it('should mark referral as visited when all conditions met', async () => {
    jest.spyOn(logger, 'debug').mockImplementation(spyLogger);
    const r = await saveReferral();

    const res = await request(app.server)
      .get(`/r/recruiter/${r.id}`)
      .set('Referer', 'https://www.linkedin.com/')
      .set('X-Forwarded-For', '203.0.113.1');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(recruiterUrl);

    await new Promise((r) => setTimeout(r, 100)); // wait for onResponse async tasks

    expect(spyLogger).toHaveBeenCalledTimes(1);
    expect(spyLogger).toHaveBeenCalledWith(
      { referralId: r.id },
      'Marked referral as visited',
    );

    const referral = await getReferral(r.id);
    expect(referral?.visited).toBe(true);
  });

  it('should not mark referral as visited if visitor is the requester', async () => {
    jest.spyOn(logger, 'debug').mockImplementation(spyLogger);
    const r = await saveReferral();

    const res = await request(app.server)
      .get(`/r/recruiter/${r.id}`)
      .set('Referer', 'https://www.linkedin.com/')
      .set('X-Forwarded-For', '198.51.100.1');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(recruiterUrl);

    await new Promise((r) => setTimeout(r, 100)); // wait for onResponse async tasks

    expect(spyLogger).toHaveBeenCalledTimes(1);
    expect(spyLogger).toHaveBeenCalledWith(
      { referralId: r.id },
      'No referral found or referral already marked as visited',
    );

    const referral = await getReferral(r.id);
    expect(referral?.visited).toBe(false);
  });

  it('should not do anything if already visited', async () => {
    jest.spyOn(logger, 'debug').mockImplementation(spyLogger);
    const r = await saveReferral({ visited: true });

    const res = await request(app.server)
      .get(`/r/recruiter/${r.id}`)
      .set('Referer', 'https://www.linkedin.com/')
      .set('X-Forwarded-For', '203.0.113.1');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(recruiterUrl);

    await new Promise((r) => setTimeout(r, 100)); // wait for onResponse async tasks

    expect(spyLogger).toHaveBeenCalledTimes(1);
    expect(spyLogger).toHaveBeenCalledWith(
      { referralId: r.id },
      'No referral found or referral already marked as visited',
    );
  });

  it('should not do anything if referral status is not pending', async () => {
    jest.spyOn(logger, 'debug').mockImplementation(spyLogger);
    const r = await saveReferral({ status: UserReferralStatus.Rejected });

    const res = await request(app.server)
      .get(`/r/recruiter/${r.id}`)
      .set('Referer', 'https://www.linkedin.com/')
      .set('X-Forwarded-For', '203.0.113.1');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(recruiterUrl);

    await new Promise((r) => setTimeout(r, 100)); // wait for onResponse async tasks

    expect(spyLogger).toHaveBeenCalledTimes(1);
    expect(spyLogger).toHaveBeenCalledWith(
      { referralId: r.id },
      'No referral found or referral already marked as visited',
    );

    const referral = await getReferral(r.id);
    expect(referral?.visited).toBe(false);
  });
});
