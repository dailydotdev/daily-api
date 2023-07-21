import { expectSuccessfulBackground } from '../helpers';
import worker from '../../src/workers/experimentAllocated';
import { ioRedisPool } from '../../src/redis';

beforeEach(async () => {
  jest.resetAllMocks();
});

it('should update redis cache and limit items', async () => {
  await ioRedisPool.execute((client) =>
    client.hset('exp:u1', {
      e1: `v1:${new Date(2023, 5, 20).getTime()}`,
      e2: `v2:${new Date(2023, 5, 19).getTime()}`,
      e3: `v3:${new Date(2023, 5, 18).getTime()}`,
      e4: `v4:${new Date(2023, 5, 17).getTime()}`,
      e5: `v5:${new Date(2023, 5, 16).getTime()}`,
      e6: `v6:${new Date(2023, 5, 15).getTime()}`,
      e7: `v7:${new Date(2023, 5, 14).getTime()}`,
      e8: `v8:${new Date(2023, 5, 13).getTime()}`,
      e9: `v9:${new Date(2023, 5, 12).getTime()}`,
      e10: `v10:${new Date(2023, 5, 11).getTime()}`,
      e11: `v11:${new Date(2023, 5, 10).getTime()}`,
    }),
  );
  await expectSuccessfulBackground(worker, {
    user_id: 'u1',
    experiment_id: 'e11',
    variation_id: 'v20',
    server_timestamp: new Date(2023, 5, 21),
  });
  await new Promise((resolve) => setTimeout(resolve, 50));
  const expected = await ioRedisPool.execute((client) =>
    client.hgetall('exp:u1'),
  );
  expect(expected).toEqual({
    e11: `v20:${new Date(2023, 5, 21).getTime()}`,
    e1: `v1:${new Date(2023, 5, 20).getTime()}`,
    e2: `v2:${new Date(2023, 5, 19).getTime()}`,
    e3: `v3:${new Date(2023, 5, 18).getTime()}`,
    e4: `v4:${new Date(2023, 5, 17).getTime()}`,
    e5: `v5:${new Date(2023, 5, 16).getTime()}`,
    e6: `v6:${new Date(2023, 5, 15).getTime()}`,
    e7: `v7:${new Date(2023, 5, 14).getTime()}`,
    e8: `v8:${new Date(2023, 5, 13).getTime()}`,
    e9: `v9:${new Date(2023, 5, 12).getTime()}`,
  });
});

it('should handle empty cache', async () => {
  await expectSuccessfulBackground(worker, {
    user_id: 'u2',
    experiment_id: 'e1',
    variation_id: 'v1',
    server_timestamp: new Date(2023, 5, 21),
  });
  await new Promise((resolve) => setTimeout(resolve, 50));
  const expected = await ioRedisPool.execute((client) =>
    client.hgetall('exp:u2'),
  );
  expect(expected).toEqual({
    e1: `v1:${new Date(2023, 5, 21).getTime()}`,
  });
});
