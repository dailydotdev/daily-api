import { Connection, getConnection } from 'typeorm';
import appFunc from '../src';
import { FastifyInstance } from 'fastify';
import { saveFixtures } from './helpers';
import {
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

  it('should handle empty body', async () => {
    const { body } = await request(app.server)
      .post('/p/newPost')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send()
      .expect(200);
    const posts = await con.getRepository(Post).find();
    expect(posts.length).toEqual(0);
    expect(body).toEqual({ status: 'failed', reason: 'missing fields' });
  });
});

describe('POST /p/rejectPost', () => {
  const uuid = randomUUID();
  it('should return not found when not authorized', () => {
    return request(app.server).post('/p/rejectPost').expect(404);
  });

  it('should update submission to rejected', async () => {
    await con.getRepository(User).save({
      id: '1',
      name: 'Lee',
      image: 'https://daily.dev/lee.jpg',
    });
    const repo = con.getRepository(Submission);
    await repo.save(
      repo.create({ id: uuid, url: 'http://sample.article/test', userId: '1' }),
    );
    const { body } = await request(app.server)
      .post('/p/rejectPost')
      .set('Content-type', 'application/json')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send({ submissionId: uuid })
      .expect(200);
    const submissions = await repo.find();
    const [submission] = submissions;
    expect(submissions.length).toEqual(1);
    expect(body).toEqual({ status: 'ok', submissionId: submission.id });
    expect(submission.id).toEqual(uuid);
    expect(submission.status).toEqual(SubmissionStatus.Rejected);
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
