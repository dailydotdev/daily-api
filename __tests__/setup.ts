import '../src/config';
import { Connection } from 'typeorm';
import { createOrGetConnection } from '../src/db';

let con: Connection;

const cleanDatabase = async (): Promise<void> => {
  for (const entity of con.entityMetadatas) {
    const repository = await con.getRepository(entity.name);
    await repository.query(`TRUNCATE TABLE "${entity.tableName}" CASCADE;`);
  }
};

beforeAll(async () => {
  con = await createOrGetConnection();
});

afterEach(() => cleanDatabase());

afterAll(() => con.close());
