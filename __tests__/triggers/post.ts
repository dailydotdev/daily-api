import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { saveFixtures } from '../helpers';
import {
  ArticlePost,
  Source,
  SharePost,
  Post,
  SourceType,
} from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { postsFixture } from '../fixture/post';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, ArticlePost, postsFixture);
});

it('should set tags str of shared post on insert and update', async () => {
  await con.getRepository(SharePost).insert({
    id: 'sp',
    shortId: 'sp',
    title: 'T',
    sharedPostId: 'p1',
    sourceId: postsFixture[0].sourceId,
  });
  const obj = await con.getRepository(Post).findOneBy({ id: 'sp' });
  expect(obj.tagsStr).toEqual(postsFixture[0].tagsStr);
  await con.getRepository(ArticlePost).update({ id: 'p1' }, { tagsStr: 'a,b' });
  // Make sure only sp gets affected
  const obj2 = await con
    .getRepository(Post)
    .find({ where: { tagsStr: 'a,b' }, order: { id: 'ASC' }, select: ['id'] });
  expect(obj2.map((x) => x.id)).toEqual(['p1', 'sp']);
});

it('should set tags str of shared post on update when original post had no tags', async () => {
  await con.getRepository(SharePost).insert({
    id: 'sp',
    shortId: 'sp',
    title: 'T',
    sharedPostId: 'p2',
    sourceId: postsFixture[0].sourceId,
  });
  const obj = await con.getRepository(Post).findOneBy({ id: 'sp' });
  expect(obj.tagsStr).toBeFalsy();
  await con.getRepository(ArticlePost).update({ id: 'p2' }, { tagsStr: 'a,b' });
  // Make sure only sp gets affected
  const obj2 = await con
    .getRepository(Post)
    .find({ where: { tagsStr: 'a,b' }, order: { id: 'ASC' }, select: ['id'] });
  expect(obj2.map((x) => x.id)).toEqual(['p2', 'sp']);
});

describe('trigger increment_source_views_count', () => {
  it('should update source total views', async () => {
    const repo = con.getRepository(Source);
    const source = await repo.findOneByOrFail({ id: 'a' });
    expect(source.flags.totalViews).toEqual(undefined);

    await con.getRepository(Post).update({ id: 'p1' }, { views: 1 });

    const updatedSource = await repo.findOneByOrFail({ id: 'a' });
    expect(updatedSource.flags.totalViews).toEqual(1);
  });

  it('should update squad total views', async () => {
    const repo = con.getRepository(Source);
    await repo.update({ id: 'a' }, { type: SourceType.Squad });
    const source = await repo.findOneByOrFail({ id: 'a' });
    expect(source.flags.totalViews).toEqual(undefined);

    await con.getRepository(Post).update({ id: 'p1' }, { views: 1 });

    const updatedSource = await repo.findOneByOrFail({ id: 'a' });
    expect(updatedSource.flags.totalViews).toEqual(1);
  });
});
