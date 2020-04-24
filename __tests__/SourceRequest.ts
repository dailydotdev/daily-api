import { Connection, getConnection } from 'typeorm';

import { notifySourceRequest } from '../src/pubsub';
import { SourceRequest } from '../src/entity';

jest.mock('../src/pubsub', () => ({
  ...jest.requireActual('../src/pubsub'),
  notifySourceRequest: jest.fn(),
}));

let con: Connection;

beforeAll(async () => {
  con = await getConnection();
});

it('should notify pubsub when creating source request', async () => {
  const req = new SourceRequest();
  req.userId = '1';
  req.sourceUrl = 'http://mysource.com';
  await con.getRepository(SourceRequest).save(req);
  expect(notifySourceRequest).toBeCalledWith('new', req);
});
