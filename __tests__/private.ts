import appFunc from '../src';
import { FastifyInstance } from 'fastify';
import { saveFixtures } from './helpers';
import { Feed, Source, User, UserPersonalizedDigest } from '../src/entity';
import { sourcesFixture } from './fixture/source';
import request from 'supertest';
import { usersFixture } from './fixture/user';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import { DisallowHandle } from '../src/entity/DisallowHandle';
import { DayOfWeek } from '../src/common';
import { ContentLanguage } from '../src/types';

let app: FastifyInstance;
let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
  app = await appFunc();
  return app.ready();
});

const createDefaultUser = async () => {
  await con
    .getRepository(User)
    .save({ ...usersFixture[0], twitter: 'leeTwitter' });
};

afterAll(() => app.close());

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, Source, sourcesFixture);
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

  it('should handle when experience level is empty on email signup (if username is provided)', async () => {
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
    expect(body).toEqual({ status: 'failed', reason: 'MISSING_FIELDS' });
  });

  it('should add new user when experience level is empty on sso signup (if username is not provided)', async () => {
    const { body } = await request(app.server)
      .post('/p/newUser')
      .set('Content-type', 'application/json')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send({
        id: usersFixture[0].id,
        name: usersFixture[0].name,
        image: usersFixture[0].image,
        email: 'randomNewEmail@gmail.com',
      })
      .expect(200);
    expect(body).toEqual({ status: 'ok', userId: usersFixture[0].id });
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
        experienceLevel: 'LESS_THAN_1_YEAR',
      })
      .expect(200);

    expect(body.status).toEqual('ok');
    expect(body.userId).not.toEqual(usersFixture[0].id);
  });

  it('should handle existing username', async () => {
    await createDefaultUser();
    const { body } = await request(app.server)
      .post('/p/newUser')
      .set('Content-type', 'application/json')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send({
        id: '100',
        name: usersFixture[0].name,
        image: usersFixture[0].image,
        username: usersFixture[0].username,
        email: 'randomNewEmail@gmail.com',
        experienceLevel: 'LESS_THAN_1_YEAR',
      })
      .expect(200);

    expect(body).toEqual({ status: 'failed', reason: 'USERNAME_EMAIL_EXISTS' });
  });

  it('should handle existing username with different case', async () => {
    await createDefaultUser();
    const { body } = await request(app.server)
      .post('/p/newUser')
      .set('Content-type', 'application/json')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send({
        id: '100',
        name: usersFixture[0].name,
        image: usersFixture[0].image,
        username: usersFixture[0].username.toUpperCase(),
        email: 'randomNewEmail@gmail.com',
        experienceLevel: 'LESS_THAN_1_YEAR',
      })
      .expect(200);

    expect(body).toEqual({ status: 'failed', reason: 'USERNAME_EMAIL_EXISTS' });
  });

  it('should handle disallowed username', async () => {
    await con.getRepository(DisallowHandle).save({ value: 'disallow' });
    const { body } = await request(app.server)
      .post('/p/newUser')
      .set('Content-type', 'application/json')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send({
        id: usersFixture[0].id,
        name: usersFixture[0].name,
        image: usersFixture[0].image,
        username: 'disallow',
        email: 'randomNewEmail@gmail.com',
        experienceLevel: 'LESS_THAN_1_YEAR',
      })
      .expect(200);

    expect(body).toEqual({ status: 'failed', reason: 'USERNAME_EMAIL_EXISTS' });
  });

  it('should not allow dashes in handle', async () => {
    const { body } = await request(app.server)
      .post('/p/newUser')
      .set('Content-type', 'application/json')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send({
        id: usersFixture[0].id,
        name: usersFixture[0].name,
        image: usersFixture[0].image,
        username: 'h-ello',
        email: 'randomNewEmail@gmail.com',
        experienceLevel: 'LESS_THAN_1_YEAR',
      })
      .expect(200);

    expect(body).toEqual({ status: 'failed', reason: 'USERNAME_EMAIL_EXISTS' });
  });

  it('should not allow slashes in handle', async () => {
    const { body } = await request(app.server)
      .post('/p/newUser')
      .set('Content-type', 'application/json')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send({
        id: usersFixture[0].id,
        name: usersFixture[0].name,
        image: usersFixture[0].image,
        username: 'h/ello',
        email: 'randomNewEmail@gmail.com',
        experienceLevel: 'LESS_THAN_1_YEAR',
      })
      .expect(200);

    expect(body).toEqual({ status: 'failed', reason: 'USERNAME_EMAIL_EXISTS' });
  });

  it('should not allow short handle', async () => {
    const { body } = await request(app.server)
      .post('/p/newUser')
      .set('Content-type', 'application/json')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send({
        id: usersFixture[0].id,
        name: usersFixture[0].name,
        image: usersFixture[0].image,
        username: 'he',
        email: 'randomNewEmail@gmail.com',
        experienceLevel: 'LESS_THAN_1_YEAR',
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
        id: '100',
        name: usersFixture[0].name,
        image: usersFixture[0].image,
        username: 'randomName',
        email: usersFixture[0].email,
        experienceLevel: 'LESS_THAN_1_YEAR',
      })
      .expect(200);

    expect(body).toEqual({ status: 'failed', reason: 'USERNAME_EMAIL_EXISTS' });
  });

  it('should handle existing email with different case', async () => {
    await createDefaultUser();
    await con
      .getRepository(User)
      .update({ email: usersFixture[0].email }, { email: 'Ido@daily.dev' });
    const { body } = await request(app.server)
      .post('/p/newUser')
      .set('Content-type', 'application/json')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send({
        id: '100',
        name: usersFixture[0].name,
        image: usersFixture[0].image,
        username: 'randomName',
        email: 'iDO@daily.dev',
        experienceLevel: 'LESS_THAN_1_YEAR',
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
        email: usersFixture[0].email.toUpperCase(),
        experienceLevel: 'LESS_THAN_1_YEAR',
      })
      .expect(200);

    expect(body).toEqual({ status: 'ok', userId: usersFixture[0].id });

    const users = await con.getRepository(User).find({ order: { id: 'ASC' } });
    expect(users.length).toEqual(2);
    expect(users[0].id).toEqual(usersFixture[0].id);
    expect(users[0].email).toEqual(usersFixture[0].email);
    expect(users[0].infoConfirmed).toBeTruthy();
    expect(users[0].createdAt).not.toBeNull();
  });

  it('should allow underscore in username', async () => {
    const { body } = await request(app.server)
      .post('/p/newUser')
      .set('Content-type', 'application/json')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send({
        id: usersFixture[0].id,
        name: usersFixture[0].name,
        image: usersFixture[0].image,
        username: 'h_ello',
        email: usersFixture[0].email,
        experienceLevel: 'LESS_THAN_1_YEAR',
      })
      .expect(200);

    expect(body).toEqual({ status: 'ok', userId: usersFixture[0].id });
  });

  it('should add a new user with false info confirmed if data is incomplete', async () => {
    const { body } = await request(app.server)
      .post('/p/newUser')
      .set('Content-type', 'application/json')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send({
        id: usersFixture[0].id,
        name: usersFixture[0].name,
        image: usersFixture[0].image,
        email: usersFixture[0].email,
      })
      .expect(200);

    expect(body).toEqual({ status: 'ok', userId: usersFixture[0].id });

    const users = await con.getRepository(User).find({ order: { id: 'ASC' } });
    expect(users.length).toEqual(2);
    expect(users[0].id).toEqual(usersFixture[0].id);
    expect(users[0].infoConfirmed).toBeFalsy();
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
        experienceLevel: 'LESS_THAN_1_YEAR',
      })
      .expect(200);

    expect(body).toEqual({ status: 'ok', userId: usersFixture[0].id });

    const users = await con.getRepository(User).find({ order: { id: 'ASC' } });
    expect(users.length).toEqual(2);
    expect(users[0].id).toEqual(usersFixture[0].id);
    expect(users[0].github).toEqual(usersFixture[0].github);
  });

  it('should ignore GitHub handle if it already exists', async () => {
    await con
      .getRepository(User)
      .save({ ...usersFixture[1], github: usersFixture[0].github });

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
        experienceLevel: 'LESS_THAN_1_YEAR',
      })
      .expect(200);

    expect(body).toEqual({ status: 'ok', userId: usersFixture[0].id });

    const users = await con.getRepository(User).find({ order: { id: 'ASC' } });
    expect(users.length).toEqual(3);
    expect(users[0].id).toEqual(usersFixture[0].id);
    expect(users[0].github).toEqual(null);
  });

  it('should add a new user with Twitter handle', async () => {
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
        twitter: usersFixture[0].twitter,
        experienceLevel: 'LESS_THAN_1_YEAR',
      })
      .expect(200);

    expect(body).toEqual({ status: 'ok', userId: usersFixture[0].id });

    const users = await con.getRepository(User).find({ order: { id: 'ASC' } });
    expect(users[0].id).toEqual(usersFixture[0].id);
    expect(users[0].twitter).toEqual(usersFixture[0].twitter);
  });

  it('should ignore Twitter handle if it already exists', async () => {
    await con
      .getRepository(User)
      .save({ ...usersFixture[1], twitter: usersFixture[0].twitter });

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
        twitter: usersFixture[0].twitter,
        experienceLevel: 'LESS_THAN_1_YEAR',
      })
      .expect(200);

    expect(body).toEqual({ status: 'ok', userId: usersFixture[0].id });

    const users = await con.getRepository(User).find({ order: { id: 'ASC' } });
    expect(users.length).toEqual(3);
    expect(users[0].id).toEqual(usersFixture[0].id);
    expect(users[0].twitter).toEqual(null);
  });

  it('should add new user with referral', async () => {
    await con.getRepository(User).save({ ...usersFixture[1] });

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
        referral: usersFixture[1].id,
        experienceLevel: 'LESS_THAN_1_YEAR',
      })
      .expect(200);

    expect(body).toEqual({ status: 'ok', userId: usersFixture[0].id });

    const users = await con.getRepository(User).find({ order: { id: 'ASC' } });
    expect(users.length).toEqual(3);
    expect(users[0].id).toEqual(usersFixture[0].id);
    expect(users[0].referralId).toEqual(usersFixture[1].id);
  });

  it('should add new user with referralId', async () => {
    await con.getRepository(User).save({ ...usersFixture[1] });

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
        referralId: usersFixture[1].id,
        experienceLevel: 'LESS_THAN_1_YEAR',
      })
      .expect(200);

    expect(body).toEqual({ status: 'ok', userId: usersFixture[0].id });

    const users = await con.getRepository(User).find({ order: { id: 'ASC' } });
    expect(users.length).toEqual(3);
    expect(users[0].id).toEqual(usersFixture[0].id);
    expect(users[0].referralId).toEqual(usersFixture[1].id);
    expect(users[0].referralOrigin).toEqual('squad');
  });

  it('should add new user with referralOrigin', async () => {
    await con.getRepository(User).save({ ...usersFixture[1] });

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
        referralId: usersFixture[1].id,
        referralOrigin: 'knightcampaign',
        experienceLevel: 'LESS_THAN_1_YEAR',
      })
      .expect(200);

    expect(body).toEqual({ status: 'ok', userId: usersFixture[0].id });

    const users = await con.getRepository(User).find({ order: { id: 'ASC' } });
    expect(users.length).toEqual(3);
    expect(users[0].id).toEqual(usersFixture[0].id);
    expect(users[0].referralId).toEqual(usersFixture[1].id);
    expect(users[0].referralOrigin).toEqual('knightcampaign');
  });

  it('should add a new user with experienceLevel', async () => {
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
        experienceLevel: 'foo',
      })
      .expect(200);

    expect(body).toEqual({ status: 'ok', userId: usersFixture[0].id });

    const users = await con.getRepository(User).find({ order: { id: 'ASC' } });
    expect(users[0].id).toEqual(usersFixture[0].id);
    expect(users[0].experienceLevel).toEqual('foo');
  });

  it('should subscribe to personalized digest', async () => {
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
        experienceLevel: 'LESS_THAN_1_YEAR',
      })
      .expect(200);

    expect(body).toEqual({ status: 'ok', userId: usersFixture[0].id });

    const personalizedDigest = await con
      .getRepository(UserPersonalizedDigest)
      .findOneBy({
        userId: usersFixture[0].id,
      });
    expect(personalizedDigest).toMatchObject({
      preferredDay: DayOfWeek.Wednesday,
      preferredHour: 8,
      variation: 1,
    });
  });

  it('should add a new user with language', async () => {
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
        experienceLevel: 'foo',
        language: ContentLanguage.English,
      })
      .expect(200);

    expect(body).toEqual({ status: 'ok', userId: usersFixture[0].id });

    const users = await con.getRepository(User).find({ order: { id: 'ASC' } });
    expect(users[0].id).toEqual(usersFixture[0].id);
    expect(users[0].language).toEqual(ContentLanguage.English);
  });

  it('should not add a new user with invalid language', async () => {
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
        experienceLevel: 'foo',
        language: 'klingon',
      })
      .expect(200);

    expect(body).toEqual({ status: 'failed', reason: 'MISSING_FIELDS' });
  });

  it('should add feed for the new user', async () => {
    const { body } = await request(app.server)
      .post('/p/newUser')
      .set('Content-type', 'application/json')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send({
        id: usersFixture[0].id,
        name: usersFixture[0].name,
        image: usersFixture[0].image,
        username: usersFixture[0].username,
        email: usersFixture[0].email.toUpperCase(),
        experienceLevel: 'LESS_THAN_1_YEAR',
      })
      .expect(200);

    expect(body).toEqual({ status: 'ok', userId: usersFixture[0].id });

    const users = await con.getRepository(User).find({ order: { id: 'ASC' } });
    expect(users.length).toEqual(2);
    expect(users[0].id).toEqual(usersFixture[0].id);
    expect(users[0].email).toEqual(usersFixture[0].email);
    expect(users[0].infoConfirmed).toBeTruthy();
    expect(users[0].createdAt).not.toBeNull();

    const feed = await con
      .getRepository(Feed)
      .findOneBy({ id: usersFixture[0].id });
    expect(feed).not.toBeNull();
    expect(feed!.id).toEqual(usersFixture[0].id);
    expect(feed!.userId).toEqual(usersFixture[0].id);
  });
});

describe('POST /p/checkUsername', () => {
  it('should return unauthorized when token is missing', () => {
    return request(app.server).get('/p/checkUsername').expect(404);
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

  it('should normalize to lowercase and find duplicates', async () => {
    await createDefaultUser();
    const { body } = await request(app.server)
      .get('/p/checkUsername?search=IdoShamun')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send()
      .expect(200);

    expect(body).toEqual({ isTaken: true });
  });

  it('should return correct response if disallowed handle', async () => {
    await con.getRepository(DisallowHandle).save({ value: 'disallow' });
    const { body } = await request(app.server)
      .get('/p/checkUsername?search=disallow')
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
    return request(app.server).post('/p/updateUserEmail').expect(404);
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

  it('should handle when email exists', async () => {
    await saveFixtures(con, User, usersFixture);
    const { body } = await request(app.server)
      .post('/p/updateUserEmail')
      .set('Content-type', 'application/json')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send({ id: '1', email: usersFixture[1].email.toUpperCase() })
      .expect(200);
    expect(body).toEqual({ status: 'failed', reason: 'EMAIL_EXISTS' });
  });

  it("should return correct response if user doesn't exist", async () => {
    const newEmail = 'somenewemail@gmail.com';
    const { body } = await request(app.server)
      .post('/p/updateUserEmail')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send({
        id: usersFixture[0].id,
        email: newEmail,
      })
      .expect(200);

    expect(body).toEqual({ status: 'failed', reason: 'USER_DOESNT_EXIST' });

    const users = await con.getRepository(User).find();
    expect(users.length).toBe(1);
  });

  it('should return correct response if exists', async () => {
    await createDefaultUser();
    const { body } = await request(app.server)
      .post('/p/updateUserEmail')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send({
        id: usersFixture[0].id,
        email: 'SomeNeweMail@gmail.com',
      })
      .expect(200);

    expect(body).toEqual({ status: 'ok', userId: usersFixture[0].id });

    const user = await con
      .getRepository(User)
      .findOneBy({ id: usersFixture[0].id });
    expect(user.email).toBe('somenewemail@gmail.com');
  });
});
