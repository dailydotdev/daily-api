import '../src/config';
import { Connection, createConnection } from 'typeorm';

let con: Connection;

const cleanDatabase = async (): Promise<void> => {
  await Promise.all(
    con.entityMetadatas.map((entity) =>
      con.getRepository(entity.name).delete({}),
    ),
  );
};

beforeAll(async () => {
  con = await createConnection();
});

afterEach(() => cleanDatabase());

afterAll(() => con.close());
