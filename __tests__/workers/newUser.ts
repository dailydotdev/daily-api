import { Connection, getConnection } from 'typeorm';
import { FastifyInstance } from 'fastify';
import appFunc from '../../src/background';
import { expectSuccessfulBackground } from '../helpers';
import worker from '../../src/workers/newUser';
import { User } from '../../src/entity';

let con: Connection;
let app: FastifyInstance;

beforeAll(async () => {
  con = await getConnection();
  app = await appFunc();
  return app.ready();
});

it('should save a new user', async () => {
  await expectSuccessfulBackground(app, worker, {
    id: 'abc',
    name: 'Ido',
    email: 'ido@acme.com',
    image: 'https://daily.dev/image.jpg',
    createdAt: new Date(2021, 7, 11),
  });
  const users = await con.getRepository(User).find();
  expect(users.length).toEqual(1);
  expect(users[0]).toMatchSnapshot();
});
