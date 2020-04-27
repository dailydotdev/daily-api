import '../src/config';
import { Connection } from 'typeorm';
import { createOrGetConnection } from '../src/db';

let con: Connection;

const cleanDatabase = async (): Promise<void> => {
  await Promise.all(
    con.entityMetadatas.map((entity) =>
      con.getRepository(entity.name).delete({}),
    ),
  );
};

beforeAll(async () => {
  con = await createOrGetConnection();
});

afterEach(() => cleanDatabase());

afterAll(() => con.close());
