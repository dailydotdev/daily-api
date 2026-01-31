import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/postDeletedSharedPostCleanup';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { Post, SharePost, Source } from '../../src/entity';
import { postsFixture, sharedPostsFixture } from '../fixture/post';
import { sourcesFixture } from '../fixture';
import { workers } from '../../src/workers';
import { DELETED_BY_WORKER } from '../../src/common';

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
  await saveFixtures(
    con,
    SharePost,
    sharedPostsFixture.map((item) => {
      return {
        ...item,
        id: `pdspc-nc-${item.id}`,
        shortId: `pdspcns1`,
        sharedPostId: `pdspc-p2`,
        title: null,
        titleHtml: null,
      };
    }),
  );
});

describe('postDeletedSharedPostCleanup worker', () => {
  it('should be registered', async () => {
    const worker =
      await import('../../src/workers/postDeletedSharedPostCleanup');

    const registeredWorker = workers.find(
      (item) => item.subscription === worker.default.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should set shared post with no commentary to not show on feed and be shadow banned if post gets deleted', async () => {
    await expectSuccessfulBackground(worker, {
      post: {
        id: 'pdspc-p2',
      },
    });
    const sharedPost = await con.getRepository(SharePost).findOneBy({
      id: 'pdspc-nc-squadP1',
    });
    expect(sharedPost?.sharedPostId).toBe('404');
    expect(sharedPost?.deleted).toBe(true);
    expect(sharedPost?.flags?.deletedBy).toBe(DELETED_BY_WORKER);
    expect(sharedPost?.showOnFeed).toBe(false);
    expect(sharedPost?.flags?.showOnFeed).toEqual(false);
  });

  it('should set shared post with commentary to not show on feed if post gets deleted', async () => {
    await expectSuccessfulBackground(worker, {
      post: {
        id: 'pdspc-p1',
      },
    });
    const sharedPost = await con.getRepository(SharePost).findOneBy({
      id: 'pdspc-squadP1',
    });
    expect(sharedPost?.sharedPostId).toBe('404');
    expect(sharedPost?.deleted).toBe(false);
    expect(sharedPost?.showOnFeed).toBe(false);
    expect(sharedPost?.flags?.showOnFeed).toEqual(false);
  });
});
