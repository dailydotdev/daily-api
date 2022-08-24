import { Connection, getConnection } from 'typeorm';
import appFunc from '../src';
import { FastifyInstance } from 'fastify';
import { saveFixtures } from './helpers';
import {
  COMMUNITY_PICKS_SOURCE,
  Keyword,
  Post,
  Source,
  Submission,
  SubmissionStatus,
  User,
} from '../src/entity';
import { sourcesFixture } from './fixture/source';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { usersFixture } from './fixture/user';

let app: FastifyInstance;
let con: Connection;

beforeAll(async () => {
  con = await getConnection();
  app = await appFunc();
  return app.ready();
});

const createDefaultUser = async () => {
  await con
    .getRepository(User)
    .save({ ...usersFixture[0], twitter: 'leeTwitter' });
};

const createDefaultSubmission = async (id: string = randomUUID()) => {
  const repo = con.getRepository(Submission);
  await repo.save(
    repo.create({ id, url: 'http://sample.article/test', userId: '1' }),
  );
};

const createDefaultKeywords = async () => {
  const repo = con.getRepository(Keyword);
  await repo.insert({
    value: 'mongodb',
    status: 'allow',
  });
  await repo.insert({
    value: 'alpinejs',
    status: 'allow',
  });
  await repo.insert({
    value: 'ab-testing',
    status: 'allow',
  });
  await repo.insert({
    value: 'alpine',
    status: 'synonym',
    synonym: 'alpinejs',
  });
  await repo.insert({
    value: 'a-b-testing',
    status: 'synonym',
    synonym: 'ab-testing',
  });
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
    await createDefaultKeywords();
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
        keywords: ['alpine', 'a-b-testing', 'mongodb'],
      })
      .expect(200);
    const posts = await con.getRepository(Post).find();
    expect(posts.length).toEqual(1);
    expect(body).toEqual({ status: 'ok', postId: posts[0].id });
    expect(posts[0].scoutId).toEqual('1');
    expect(posts[0].tagsStr).toEqual('mongodb,alpinejs,ab-testing');
    const keywords = await con.getRepository(Keyword).find({
      where: {
        value: 'alpine',
      },
    });
    // since I am adding a post which has `alpine`
    // as a tag, occurences of `alpine` in the db
    // should increase from 1 to 2
    expect(keywords[0].occurrences).toEqual(2);
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

describe('POST /p/newUser', () => {
  it('should return not found when not authorized', () => {
    return request(app.server).post('/p/newUser').expect(404);
  });

  it('should handle empty body', async () => {
    const { body } = await request(app.server)
      .post('/p/newUser')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send()
      .expect(200);
    expect(body).toEqual({ status: 'failed', reason: 'MISSING_FIELDS' });
  });

  it('should handle existing user ID', async () => {
    await createDefaultUser();
    const { body } = await request(app.server)
      .post('/p/newUser')
      .set('Content-type', 'application/json')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send({
        id: usersFixture[0].id,
        name: usersFixture[0].name,
        image: usersFixture[0].image,
        username: 'randomName',
        email: 'randomNewEmail@gmail.com',
      })
      .expect(200);

    expect(body).toEqual({ status: 'failed', reason: 'USER_EXISTS' });
  });

  it('should handle existing username', async () => {
    await createDefaultUser();
    const { body } = await request(app.server)
      .post('/p/newUser')
      .set('Content-type', 'application/json')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send({
        id: usersFixture[0].id,
        name: usersFixture[0].name,
        image: usersFixture[0].image,
        username: usersFixture[0].username,
        email: 'randomNewEmail@gmail.com',
      })
      .expect(200);

    expect(body).toEqual({ status: 'failed', reason: 'USERNAME_EMAIL_EXISTS' });
  });

  it('should handle existing email', async () => {
    await createDefaultUser();
    const { body } = await request(app.server)
      .post('/p/newUser')
      .set('Content-type', 'application/json')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send({
        id: usersFixture[0].id,
        name: usersFixture[0].name,
        image: usersFixture[0].image,
        username: 'randomName',
        email: usersFixture[0].email,
      })
      .expect(200);

    expect(body).toEqual({ status: 'failed', reason: 'USERNAME_EMAIL_EXISTS' });
  });

  it('should add a new user', async () => {
    const { body } = await request(app.server)
      .post('/p/newUser')
      .set('Content-type', 'application/json')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send({
        id: usersFixture[0].id,
        name: usersFixture[0].name,
        image: usersFixture[0].image,
        username: usersFixture[0].username,
        email: usersFixture[0].email,
      })
      .expect(200);

    expect(body).toEqual({ status: 'ok', userId: usersFixture[0].id });

    const users = await con.getRepository(User).find();
    expect(users.length).toEqual(1);
    expect(users[0].id).toEqual(usersFixture[0].id);
  });

  it('should add a new user with GitHub handle', async () => {
    const { body } = await request(app.server)
      .post('/p/newUser')
      .set('Content-type', 'application/json')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send({
        id: usersFixture[0].id,
        name: usersFixture[0].name,
        image: usersFixture[0].image,
        username: usersFixture[0].username,
        email: usersFixture[0].email,
        github: usersFixture[0].github,
      })
      .expect(200);

    expect(body).toEqual({ status: 'ok', userId: usersFixture[0].id });

    const users = await con.getRepository(User).find();
    expect(users.length).toEqual(1);
    expect(users[0].id).toEqual(usersFixture[0].id);
    expect(users[0].github).toEqual(usersFixture[0].github);
  });
});

describe('POST /p/checkUsername', () => {
  it('should return unauthorized when token is missing', () => {
    return request(app.server).get('/p/checkUsername').expect(401);
  });

  it('should handle when username query is empty', async () => {
    return request(app.server)
      .get('/p/checkUsername')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send()
      .expect(400);
  });

  it('should return correct response if exists', async () => {
    await createDefaultUser();
    const { body } = await request(app.server)
      .get('/p/checkUsername?search=idoshamun')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send()
      .expect(200);

    expect(body).toEqual({ isTaken: true });
  });

  it('should return correct response if username is available for use', async () => {
    await createDefaultUser();
    const { body } = await request(app.server)
      .get('/p/checkUsername?search=sshanzel')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send()
      .expect(200);

    expect(body).toEqual({ isTaken: false });
  });
});

describe('POST /p/updateUserEmail', () => {
  it('should return unauthorized when token is missing', () => {
    return request(app.server).post('/p/updateUserEmail').expect(401);
  });

  it('should handle when id is empty', async () => {
    const { body } = await request(app.server)
      .post('/p/updateUserEmail')
      .set('Content-type', 'application/json')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send({})
      .expect(200);
    expect(body).toEqual({ status: 'failed', reason: 'MISSING_FIELDS' });
  });

  it('should handle when email is empty', async () => {
    const { body } = await request(app.server)
      .post('/p/updateUserEmail')
      .set('Content-type', 'application/json')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send({ id: '1' })
      .expect(200);
    expect(body).toEqual({ status: 'failed', reason: 'MISSING_FIELDS' });
  });

  it('should return correct response if exists', async () => {
    const newEmail = 'somenewemail@gmail.com';
    await createDefaultUser();
    const { body } = await request(app.server)
      .post('/p/updateUserEmail')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send({
        id: usersFixture[0].id,
        email: newEmail,
      })
      .expect(200);

    expect(body).toEqual({ status: 'ok', userId: usersFixture[0].id });

    const user = await con
      .getRepository(User)
      .findOne({ id: usersFixture[0].id });
    expect(user.email).toBe(newEmail);
  });
});
