import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { ArticlePost, Post, PostTag, Source } from '../../src/entity';
import { updateFlagsStatement } from '../../src/common';
import { postTagsFixture, postsFixture } from '../fixture/post';
import { saveFixtures } from '../helpers';
import { sourcesFixture } from '../fixture/source';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, ArticlePost, postsFixture);
  await saveFixtures(con, PostTag, postTagsFixture);
  jest.clearAllMocks();
});

describe('updateFlagsStatement', () => {
  it('should update flags', async () => {
    const repo = con.getRepository(Post);
    await repo.save({
      id: 'p1',
      flags: { banned: true, private: false, visible: true },
    });
    const flagsUpdate = { banned: false, private: true };
    await repo.update(
      { id: 'p1' },
      {
        flags: updateFlagsStatement(flagsUpdate),
      },
    );
    const actual = await repo.findOneBy({ id: 'p1' });
    expect(actual?.flags).toMatchObject({
      banned: false,
      private: true,
      visible: true,
    });
  });

  it('should add new flags', async () => {
    const repo = con.getRepository(Post);
    await repo.save({
      id: 'p1',
      flags: { private: false },
    });
    const flagsUpdate = { banned: false };
    await repo.update(
      { id: 'p1' },
      {
        flags: updateFlagsStatement(flagsUpdate),
      },
    );
    const actual = await repo.findOneBy({ id: 'p1' });
    expect(actual?.flags).toMatchObject({ private: false, banned: false });
  });

  it('should not update with empty flags', async () => {
    const repo = con.getRepository(Post);
    await repo.save({
      id: 'p1',
      flags: { banned: true, private: false },
    });
    const flagsUpdate = {};
    await repo.update(
      { id: 'p1' },
      {
        flags: updateFlagsStatement(flagsUpdate),
      },
    );
    const actual = await repo.findOneBy({ id: 'p1' });
    expect(actual?.flags).toMatchObject({ banned: true, private: false });
  });
});
