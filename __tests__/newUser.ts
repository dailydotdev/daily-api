import { Connection, getConnection } from 'typeorm';
import { PubSub } from '@google-cloud/pubsub';
import { FastifyInstance } from 'fastify';
import appFunc from '../src';
import { mockMessage } from './helpers';
import worker from '../src/workers/newUser';
import { User } from '../src/entity';

let con: Connection;
let app: FastifyInstance;

beforeAll(async () => {
  con = await getConnection();
  app = await appFunc();
  return app.ready();
});

it('should save a new user', async () => {
  const message = mockMessage({
    id: 'abc',
    name: 'Ido',
    email: 'ido@acme.com',
    image: 'https://daily.dev/image.jpg',
  });

  await worker.handler(message, con, app.log, new PubSub());
  expect(message.ack).toBeCalledTimes(1);
  const users = await con.getRepository(User).find();
  expect(users.length).toEqual(1);
  expect(users[0]).toMatchSnapshot();
});
