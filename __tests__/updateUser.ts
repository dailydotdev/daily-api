import { Connection, getConnection } from 'typeorm';
import { FastifyInstance } from 'fastify';
import { PubSub } from '@google-cloud/pubsub';

import appFunc from '../src';
import { mockMessage } from './helpers';
import worker from '../src/workers/updateUser';
import { User } from '../src/entity';

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
  });

  const message = mockMessage({
    user: {
      id: 'abc',
      name: 'ido',
      email: 'ido@acme.com',
      image: 'https://daily.dev/image.jpg',
    },
    newProfile: {
      name: 'Ido',
      image: 'https://daily.dev/image.jpg',
      username: 'idoshamun',
      twitter: 'idoshamun',
      github: 'idoshamun',
    },
  });

  await worker.handler(message, con, app.log, new PubSub());
  expect(message.ack).toBeCalledTimes(1);
  const users = await con.getRepository(User).find();
  expect(users.length).toEqual(1);
  expect(users[0]).toMatchSnapshot();
});

it('should ack message if user does not exist', async () => {
  const message = mockMessage({
    user: {
      id: 'abc',
      name: 'ido',
      email: 'ido@acme.com',
      image: 'https://daily.dev/image.jpg',
    },
    newProfile: {
      name: 'Ido',
    },
  });

  await worker.handler(message, con, app.log, new PubSub());
  expect(message.ack).toBeCalledTimes(1);
  const users = await con.getRepository(User).find();
  expect(users.length).toEqual(0);
});
