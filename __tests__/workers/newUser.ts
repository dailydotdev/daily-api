import { Connection, getConnection } from 'typeorm';

import { expectSuccessfulBackground } from '../helpers';
import worker from '../../src/workers/newUser';
import { User } from '../../src/entity';

let con: Connection;

beforeAll(async () => {
  con = await getConnection();
});

it('should save a new user', async () => {
  await expectSuccessfulBackground(worker, {
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
