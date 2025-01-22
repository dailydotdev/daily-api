import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/postDeletedSharedPostCleanup';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { Post, SharePost, Source } from '../../src/entity';
import { postsFixture, sharedPostsFixture } from '../fixture/post';
import { sourcesFixture } from '../fixture';
import { typedWorkers, workers } from '../../src/workers';

let con: DataSource;
beforeEach(async () => {
  con = await createOrGetConnection();
  jest.resetAllMocks();
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(
    con,
    Post,
    postsFixture.map((item) => {
      return {
        ...item,
        id: `pdspc-${item.id}`,
        deleted: true,
      };
    }),
  );
  await saveFixtures(
    con,
    SharePost,
    sharedPostsFixture.map((item) => {
      return {
        ...item,
        id: `pdspc-${item.id}`,
        sharedPostId: `pdspc-p1`,
      };
    }),
  );
});

describe('postDeletedSharedPostCleanup worker', () => {
  it('should be registered', async () => {
    const worker = await import(
      '../../src/workers/postDeletedSharedPostCleanup'
    );

    const registeredWorker = workers.find(
      (item) => item.subscription === worker.default.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should set shared post to not show on feed if post gets deleted', async () => {
    await expectSuccessfulBackground(worker, {
      post: {
        id: 'pdspc-p1',
      },
    });
    const sharedPost = await con.getRepository(SharePost).findOneBy({
      id: 'pdspc-squadP1',
    });
    expect(sharedPost?.showOnFeed).toBe(false);
    expect(sharedPost?.flags?.showOnFeed).toEqual(false);
  });
});
