import '../src/config';
import createOrGetConnection from '../src/db';
import { ioRedisPool, redisPubSub, singleRedisClient } from '../src/redis';

let con;

const cleanDatabase = async (): Promise<void> => {
  for (const entity of con.entityMetadatas) {
    const repository = con.getRepository(entity.name);
    if (repository.metadata.tableType === 'view') continue;
    await repository.query(`DELETE FROM "${entity.tableName}";`);

    for (const column of entity.primaryColumns) {
      if (column.generationStrategy === 'increment') {
        await repository.query(
          `ALTER SEQUENCE ${entity.tableName}_${column.databaseName}_seq RESTART WITH 1`,
        );
      }
    }
  }
};

beforeAll(async () => {
  con = await createOrGetConnection();
});

afterEach(cleanDatabase);

afterAll(async () => {
  await con.close();
  singleRedisClient.disconnect();
  redisPubSub.getPublisher().disconnect();
  redisPubSub.getSubscriber().disconnect();
  await ioRedisPool.end();
});
