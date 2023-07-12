import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/sourcePrivacyUpdated';
import { Post, Source } from '../../src/entity';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { postsFixture } from '../fixture/post';
import { sourcesFixture } from '../fixture/source';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, Source, sourcesFixture);
  await con.getRepository(Post).save(postsFixture[0]);
});

it('should change post privacy on source privacy update', async () => {
  await expectSuccessfulBackground(worker, {
    source: { id: 'a', private: true },
  });
  const post = await con
    .getRepository(Post)
    .findOneBy({ id: postsFixture[0].id });
  expect(post.private).toEqual(true);
  expect(post.flags.private).toEqual(true);
});
