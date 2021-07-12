import { Connection, getConnection } from 'typeorm';
import { Keyword, Post, PostKeyword, Source } from '../../src/entity';
import { saveFixtures } from '../helpers';
import { sourcesFixture } from '../fixture/source';
import { postsFixture } from '../fixture/post';

let con: Connection;

beforeAll(async () => {
  con = await getConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, Post, postsFixture);
});

it('should set the post keyword status on insert', async () => {
  await con
    .getRepository(Keyword)
    .insert([{ value: 'webdev', status: 'allow' }]);
  await con
    .getRepository(PostKeyword)
    .insert([{ postId: postsFixture[0].id, keyword: 'webdev' }]);
  const actual = await con
    .getRepository(PostKeyword)
    .findOne({ where: { keyword: 'webdev', postId: postsFixture[0].id } });
  expect(actual).toEqual({
    postId: postsFixture[0].id,
    keyword: 'webdev',
    status: 'allow',
  });
});

it('should set the post keyword status to null if keyword does not exist', async () => {
  await con
    .getRepository(PostKeyword)
    .insert([{ postId: postsFixture[0].id, keyword: 'webdev' }]);
  const actual = await con
    .getRepository(PostKeyword)
    .findOne({ where: { keyword: 'webdev', postId: postsFixture[0].id } });
  expect(actual).toEqual({
    postId: postsFixture[0].id,
    keyword: 'webdev',
    status: null,
  });
});

it('should update the post keyword status when keyword is inserted', async () => {
  await con
    .getRepository(PostKeyword)
    .insert([{ postId: postsFixture[0].id, keyword: 'webdev' }]);
  await con
    .getRepository(Keyword)
    .insert([{ value: 'webdev', status: 'allow' }]);
  const actual = await con
    .getRepository(PostKeyword)
    .findOne({ where: { keyword: 'webdev', postId: postsFixture[0].id } });
  expect(actual).toEqual({
    postId: postsFixture[0].id,
    keyword: 'webdev',
    status: 'allow',
  });
});

it('should update the post keyword status when keyword is updated', async () => {
  await con
    .getRepository(Keyword)
    .insert([{ value: 'webdev', status: 'deny' }]);
  await con
    .getRepository(PostKeyword)
    .insert([{ postId: postsFixture[0].id, keyword: 'webdev' }]);
  await con
    .getRepository(Keyword)
    .update({ value: 'webdev' }, { status: 'allow' });
  const actual = await con
    .getRepository(PostKeyword)
    .findOne({ where: { keyword: 'webdev', postId: postsFixture[0].id } });
  expect(actual).toEqual({
    postId: postsFixture[0].id,
    keyword: 'webdev',
    status: 'allow',
  });
});

it('should set the post keyword status on keyword delete', async () => {
  await con
    .getRepository(Keyword)
    .insert([{ value: 'webdev', status: 'allow' }]);
  await con
    .getRepository(PostKeyword)
    .insert([{ postId: postsFixture[0].id, keyword: 'webdev' }]);
  await con.getRepository(Keyword).delete({ value: 'webdev' });
  const actual = await con
    .getRepository(PostKeyword)
    .findOne({ where: { keyword: 'webdev', postId: postsFixture[0].id } });
  expect(actual).toEqual({
    postId: postsFixture[0].id,
    keyword: 'webdev',
    status: null,
  });
});
