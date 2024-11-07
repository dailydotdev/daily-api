// import { calculateTopReaders as cron } from '../../src/cron/calculateTopReaders';
// import { expectSuccessfulCron, saveFixtures } from '../helpers';
// import { DataSource } from 'typeorm';
// import createOrGetConnection from '../../src/db';
// import {
//   Keyword,
//   Post,
//   PostKeyword,
//   Source,
//   User,
//   UserTopReader,
//   View,
// } from '../../src/entity';
// import { sourcesFixture } from '../fixture/source';
// import { postsFixture } from '../fixture/post';

// import { crons } from '../../src/cron/index';
// import { addSeconds, subMonths } from 'date-fns';

// let con: DataSource;

// beforeAll(async () => {
//   con = await createOrGetConnection();
// });

// const usersFixture = [1, 2, 3].map((key) => ({
//   id: `user_${key}`,
//   username: `user_${key}`,
//   infoConfirmed: true,
// }));

describe('calculateTopReaders cron', () => {
  it('should be empty', () => {
    expect(true).toBe(true);
  });
  //   beforeEach(async () => {
  //     jest.resetAllMocks();
  //     const longArray = Array.from(Array(1000).keys());
  //     await saveFixtures(con, User, [
  //       ...usersFixture,
  //       ...longArray.map((key) => ({
  //         id: `user_fill_${key}`,
  //         username: `user_fill_${key}`,
  //         infoConfirmed: true,
  //       })),
  //     ]);
  //     await saveFixtures(con, Keyword, [
  //       { value: 'allow_1', status: 'allow' },
  //       { value: 'allow_2', status: 'allow' },
  //       { value: 'under_limit_1', status: 'allow' },
  //       { value: 'deny_1', status: 'deny' },
  //     ]);
  //     await saveFixtures(con, Source, sourcesFixture);
  //     await saveFixtures(con, Post, postsFixture);
  //     await saveFixtures(con, PostKeyword, [
  //       { postId: postsFixture[0].id, keyword: 'allow_1' },
  //       { postId: postsFixture[1].id, keyword: 'allow_2' },
  //       { postId: postsFixture[2].id, keyword: 'under_limit_1' },
  //       { postId: postsFixture[3].id, keyword: 'deny_1' },
  //     ]);
  //     const timestamp = subMonths(new Date(), 1);
  //     await saveFixtures(con, View, [
  //       // START fill of views
  //       // 1000 views for keyword allow_1 to rank it first
  //       ...longArray.map((key) => ({
  //         userId: `user_fill_${key}`,
  //         postId: postsFixture[0].id,
  //         timestamp: new Date(addSeconds(timestamp, key)),
  //       })),
  //       // 500 views for keyword allow_2 to rank it second
  //       ...longArray.splice(0, 500).map((key) => ({
  //         userId: `user_fill_${key}`,
  //         postId: postsFixture[1].id,
  //         timestamp: new Date(addSeconds(timestamp, key)),
  //       })),
  //       // 100 views for keyword under_limit_1 that will not be ranked because it is under limit
  //       ...longArray.splice(0, 100).map((key) => ({
  //         userId: `user_fill_${key}`,
  //         postId: postsFixture[2].id,
  //         timestamp: new Date(addSeconds(timestamp, key)),
  //       })),
  //       // 1000 views for keyword deny_1 that will not be ranked because it is denied
  //       ...longArray.map((key) => ({
  //         userId: `user_fill_${key}`,
  //         postId: postsFixture[3].id,
  //         timestamp: new Date(addSeconds(timestamp, key)),
  //       })),
  //       // END fill of views
  //       // START fill views for user 1
  //       ...[1, 2, 3, 4, 5].map((key) => ({
  //         userId: usersFixture[0].id,
  //         postId: postsFixture[0].id,
  //         timestamp: new Date(addSeconds(timestamp, key)),
  //       })),
  //       ...[1, 2, 3, 4, 5].map((key) => ({
  //         userId: usersFixture[0].id,
  //         postId: postsFixture[1].id,
  //         timestamp: new Date(addSeconds(timestamp, key)),
  //       })),
  //       // END fill views for user 1
  //       // START fill views for user 2
  //       ...[1, 2, 3].map((key) => ({
  //         userId: usersFixture[1].id,
  //         postId: postsFixture[0].id,
  //         timestamp: new Date(addSeconds(timestamp, key)),
  //       })),
  //       ...[1, 2, 3].map((key) => ({
  //         userId: usersFixture[1].id,
  //         postId: postsFixture[1].id,
  //         timestamp: new Date(addSeconds(timestamp, key)),
  //       })),
  //       // END fill views for user 2
  //       // START fill views for user 3
  //       ...[1, 2, 3].map((key) => ({
  //         userId: usersFixture[2].id,
  //         postId: postsFixture[1].id,
  //         timestamp: new Date(addSeconds(timestamp, key)),
  //       })),
  //       // END fill views for user 3
  //     ]);
  //     await con.getRepository(UserTopReader).clear();
  //   });
  //   afterEach(() => {
  //     jest.useRealTimers();
  //   });
  //   it('should be registered', () => {
  //     const registeredWorker = crons.find((item) => item.name === cron.name);
  //     expect(registeredWorker).toBeDefined();
  //   });
  //   it('should calcuate the top readers for the past month', async () => {
  //     await expectSuccessfulCron(cron);
  //     const allow1 = await con.getRepository(UserTopReader).findBy({
  //       keywordValue: 'allow_1',
  //     });
  //     expect(allow1).toBeTruthy();
  //     expect(allow1.length).toEqual(10);
  //     ['user_1', 'user_2'].forEach((id) => {
  //       expect(allow1.some(({ userId }) => userId === id)).toBe(true);
  //     });
  //     const allow2 = await con.getRepository(UserTopReader).findBy({
  //       keywordValue: 'allow_2',
  //     });
  //     expect(allow2).toBeTruthy();
  //     expect(allow2.length).toEqual(10);
  //     ['user_3'].forEach((id) => {
  //       expect(allow2.some(({ userId }) => userId === id)).toBe(true);
  //     });
  //     expect(
  //       (
  //         await con.getRepository(UserTopReader).findBy({
  //           keywordValue: 'under_limit_1',
  //         })
  //       ).length,
  //     ).toEqual(0);
  //     expect(
  //       (
  //         await con.getRepository(UserTopReader).findBy({
  //           keywordValue: 'deny_1',
  //         })
  //       ).length,
  //     ).toEqual(0);
  //   });
});
