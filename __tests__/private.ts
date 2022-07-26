import { Connection, getConnection } from 'typeorm';
import appFunc from '../src';
import { FastifyInstance } from 'fastify';
import { saveFixtures } from './helpers';
import {
  COMMUNITY_PICKS_SOURCE,
  Post,
  Source,
  Submission,
  SubmissionStatus,
  User,
} from '../src/entity';
import { sourcesFixture } from './fixture/source';
import request from 'supertest';
import { randomUUID } from 'crypto';

let app: FastifyInstance;
let con: Connection;

beforeAll(async () => {
  con = await getConnection();
  app = await appFunc();
  return app.ready();
});

const createDefaultUser = async () => {
  await con.getRepository(User).save({
    id: '1',
    name: 'Lee',
    image: 'https://daily.dev/lee.jpg',
    twitter: 'leeTwitter',
  });
};

const createDefaultSubmission = async (id: string = randomUUID()) => {
  const repo = con.getRepository(Submission);
  await repo.save(
    repo.create({ id, url: 'http://sample.article/test', userId: '1' }),
  );
};

afterAll(() => app.close());

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, Source, sourcesFixture);
});

describe('POST /p/newPost', () => {
  it('should return not found when not authorized', () => {
    return request(app.server).post('/p/newPost').expect(404);
  });

  it('should save a new post with basic information', async () => {
    const { body } = await request(app.server)
      .post('/p/newPost')
      .set('Content-type', 'application/json')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send({
        id: 'p1',
        title: 'Title',
        url: 'https://post.com',
        publicationId: 'a',
      })
      .expect(200);
    const posts = await con.getRepository(Post).find();
    expect(posts.length).toEqual(1);
    expect(body).toEqual({ status: 'ok', postId: posts[0].id });
    expect(posts[0]).toMatchSnapshot({
      createdAt: expect.any(Date),
      metadataChangedAt: expect.any(Date),
      score: expect.any(Number),
      id: expect.any(String),
      shortId: expect.any(String),
    });
  });

  it('should save a new post with the relevant scout id and update submission', async () => {
    const uuid = randomUUID();
    await saveFixtures(con, Source, [
      {
        id: COMMUNITY_PICKS_SOURCE,
        name: 'Community recommendations',
        image: 'sample.image.com',
      },
    ]);
    await createDefaultUser();
    await createDefaultSubmission(uuid);
    const { body } = await request(app.server)
      .post('/p/newPost')
      .set('Content-type', 'application/json')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send({
        id: 'p1',
        title: 'Title',
        url: 'https://post.com',
        publicationId: COMMUNITY_PICKS_SOURCE,
        submissionId: uuid,
      })
      .expect(200);
    const posts = await con.getRepository(Post).find();
    expect(posts.length).toEqual(1);
    expect(body).toEqual({ status: 'ok', postId: posts[0].id });
    expect(posts[0].scoutId).toEqual('1');
    const submissions = await con.getRepository(Submission).find();
    const [submission] = submissions;
    expect(submissions.length).toEqual(1);
    expect(submission.id).toEqual(uuid);
    expect(submission.status).toEqual(SubmissionStatus.Accepted);
  });

  it('should save a new post with the relevant keywords', async () => {
    const uuid = randomUUID();
    await saveFixtures(con, Source, [
      {
        id: COMMUNITY_PICKS_SOURCE,
        name: 'Community recommendations',
        image: 'sample.image.com',
      },
    ]);
    await createDefaultUser();
    await createDefaultSubmission(uuid);
    const { body } = await request(app.server)
      .post('/p/newPost')
      .set('Content-type', 'application/json')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send({
        id: 'p1',
        title: 'Title',
        url: 'https://post.com',
        publicationId: COMMUNITY_PICKS_SOURCE,
        submissionId: uuid,
        keywords: ['open-source-software', 'no-code', 'mongodb'],
      })
      .expect(200);
    const posts = await con.getRepository(Post).find();
    expect(posts.length).toEqual(1);
    expect(body).toEqual({ status: 'ok', postId: posts[0].id });
    expect(posts[0].scoutId).toEqual('1');
    expect(posts[0].tagsStr).toEqual(
      'open-source,nocode,open-source-software,no-code,mongodb',
    );
  });

  it('should not accept post with same author and scout', async () => {
    const uuid = randomUUID();
    await createDefaultUser();
    await createDefaultSubmission(uuid);
    const { body } = await request(app.server)
      .post('/p/newPost')
      .set('Content-type', 'application/json')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send({
        id: 'p1',
        title: 'Title',
        url: 'https://post.com',
        publicationId: 'a',
        submissionId: uuid,
        creatorTwitter: 'leeTwitter',
      })
      .expect(200);
    expect(body).toEqual({
      status: 'failed',
      reason: 'SCOUT_IS_AUTHOR',
    });
    const submissions = await con.getRepository(Submission).find();
    const [submission] = submissions;
    expect(submissions.length).toEqual(1);
    expect(submission.id).toEqual(uuid);
    expect(submission.status).toEqual(SubmissionStatus.Rejected);
    expect(submission.reason).toEqual('SCOUT_IS_AUTHOR');
  });

  it('should handle empty body', async () => {
    const { body } = await request(app.server)
      .post('/p/newPost')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send()
      .expect(200);
    const posts = await con.getRepository(Post).find();
    expect(posts.length).toEqual(0);
    expect(body).toEqual({ status: 'failed', reason: 'MISSING_FIELDS' });
  });
});

describe('POST /p/rejectPost', () => {
  it('should return not found when not authorized', () => {
    return request(app.server).post('/p/rejectPost').expect(404);
  });

  it('should update submission to rejected', async () => {
    const uuid = randomUUID();
    await createDefaultUser();
    await createDefaultSubmission(uuid);
    const { body } = await request(app.server)
      .post('/p/rejectPost')
      .set('Content-type', 'application/json')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send({ submissionId: uuid })
      .expect(200);
    const submissions = await con.getRepository(Submission).find();
    const [submission] = submissions;
    expect(submissions.length).toEqual(1);
    expect(body).toEqual({ status: 'ok', submissionId: submission.id });
    expect(submission.id).toEqual(uuid);
    expect(submission.status).toEqual(SubmissionStatus.Rejected);
  });

  it('should not update already approved post', async () => {
    const uuid = randomUUID();
    await createDefaultUser();
    const repo = con.getRepository(Submission);
    await repo.save({
      id: uuid,
      url: 'http://sample.article/test',
      userId: '1',
      status: SubmissionStatus.Accepted,
    });
    const { body } = await request(app.server)
      .post('/p/rejectPost')
      .set('Content-type', 'application/json')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send({ submissionId: uuid })
      .expect(200);
    const submissions = await con.getRepository(Submission).find();
    const [submission] = submissions;
    expect(submissions.length).toEqual(1);
    expect(body).toEqual({ status: 'ok', submissionId: submission.id });
    expect(submission.id).toEqual(uuid);
    expect(submission.status).toEqual(SubmissionStatus.Accepted);
  });

  it('should handle empty body', async () => {
    const { body } = await request(app.server)
      .post('/p/rejectPost')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send()
      .expect(200);
    expect(body).toEqual({ status: 'failed', reason: 'missing submission id' });
  });
});
