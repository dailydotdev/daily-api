import { Connection, getConnection } from 'typeorm';
import { FastifyInstance } from 'fastify';

import appFunc from '../../src/background';
import { expectSuccessfulBackground } from '../helpers';
import worker from '../../src/workers/updateUser';
import { User } from '../../src/entity';

let con: Connection;
let app: FastifyInstance;

beforeAll(async () => {
  con = await getConnection();
  app = await appFunc();
  return app.ready();
});

it('should update an existing user', async () => {
  await con.getRepository(User).save({
    id: 'abc',
    name: 'ido',
    image: 'https://daily.dev/image.jpg',
    profileConfirmed: true,
    createdAt: new Date(2021, 7, 11),
  });

  await expectSuccessfulBackground(app, worker, {
    user: {
      id: 'abc',
      name: 'ido',
      email: 'ido@acme.com',
      image: 'https://daily.dev/image.jpg',
      createdAt: new Date(2021, 7, 11),
    },
    newProfile: {
      name: 'Ido',
      image: 'https://daily.dev/image.jpg',
      username: 'idoshamun',
      twitter: 'idoshamun',
      github: 'idoshamun',
    },
  });
  const users = await con.getRepository(User).find();
  expect(users.length).toEqual(1);
  expect(users[0]).toMatchSnapshot();
});

it('should create user if does not exist', async () => {
  await expectSuccessfulBackground(app, worker, {
    user: {
      id: 'abc',
      name: 'ido',
      email: 'ido@acme.com',
      image: 'https://daily.dev/image.jpg',
      createdAt: new Date(2021, 7, 11),
    },
    newProfile: {
      name: 'Ido',
      image: 'https://daily.dev/image.jpg',
      username: 'idoshamun',
      twitter: 'idoshamun',
      github: 'idoshamun',
      createdAt: new Date(2021, 7, 11),
    },
  });
  const users = await con.getRepository(User).find();
  expect(users.length).toEqual(1);
  expect(users[0]).toMatchSnapshot();
});
