import {
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  testQueryErrorCode,
} from './helpers';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import { Archive } from '../src/entity/Archive';
import { ArchiveItem } from '../src/entity/ArchiveItem';
import { ArticlePost } from '../src/entity/posts/ArticlePost';
import { SharePost } from '../src/entity/posts/SharePost';
import { Keyword } from '../src/entity/Keyword';
import { PostKeyword } from '../src/entity/PostKeyword';
import { Source } from '../src/entity/Source';
import { User } from '../src/entity/user/User';
import {
  ArchivePeriodType,
  ArchiveRankingType,
  ArchiveScopeType,
  ArchiveSubjectType,
  materializePeriodArchives,
} from '../src/common/archive';

let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;

const marchPeriodStart = new Date('2026-03-01T00:00:00.000Z');
beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(() => new MockContext(con));
  client = state.client;
});

beforeEach(async () => {
  jest.resetAllMocks();

  await saveFixtures(con, Source, [
    {
      id: 'source-a',
      name: 'Source A',
      image: 'https://daily.dev/source-a.jpg',
      handle: 'source-a',
      private: false,
      active: true,
    },
    {
      id: 'source-b',
      name: 'Source B',
      image: 'https://daily.dev/source-b.jpg',
      handle: 'source-b',
      private: false,
      active: true,
    },
  ]);

  await saveFixtures(con, User, [
    {
      id: 'author-good',
      name: 'Good Author',
      email: 'good@author.dev',
      image: 'https://daily.dev/author-good.jpg',
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
      infoConfirmed: true,
      reputation: 42,
    },
    {
      id: 'author-low',
      name: 'Low Author',
      email: 'low@author.dev',
      image: 'https://daily.dev/author-low.jpg',
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
      infoConfirmed: true,
      reputation: 10,
    },
  ]);

  await saveFixtures(con, Keyword, [
    { value: 'webdev', status: 'allow', occurrences: 100 },
    { value: 'backend', status: 'allow', occurrences: 50 },
  ]);

  await saveFixtures(con, ArticlePost, [
    {
      id: 'post-1',
      shortId: 'post1',
      title: 'Webdev 1',
      url: 'https://daily.dev/post-1',
      image: 'https://daily.dev/post-1.jpg',
      sourceId: 'source-a',
      authorId: 'author-good',
      upvotes: 15,
      createdAt: new Date('2026-03-10T10:00:00.000Z'),
      visible: true,
      private: false,
      deleted: false,
      banned: false,
    },
    {
      id: 'post-2',
      shortId: 'post2',
      title: 'Webdev 2',
      url: 'https://daily.dev/post-2',
      image: 'https://daily.dev/post-2.jpg',
      sourceId: 'source-a',
      authorId: 'author-good',
      upvotes: 12,
      createdAt: new Date('2026-03-09T10:00:00.000Z'),
      visible: true,
      private: false,
      deleted: false,
      banned: false,
    },
    {
      id: 'post-3',
      shortId: 'post3',
      title: 'Webdev 3',
      url: 'https://daily.dev/post-3',
      image: 'https://daily.dev/post-3.jpg',
      sourceId: 'source-b',
      authorId: 'author-good',
      upvotes: 10,
      createdAt: new Date('2026-03-08T10:00:00.000Z'),
      visible: true,
      private: false,
      deleted: false,
      banned: false,
    },
    {
      id: 'post-4',
      shortId: 'post4',
      title: 'Backend 1',
      url: 'https://daily.dev/post-4',
      image: 'https://daily.dev/post-4.jpg',
      sourceId: 'source-a',
      authorId: 'author-good',
      upvotes: 20,
      createdAt: new Date('2026-03-11T10:00:00.000Z'),
      visible: true,
      private: false,
      deleted: false,
      banned: false,
    },
    {
      id: 'post-5',
      shortId: 'post5',
      title: 'Below Threshold',
      url: 'https://daily.dev/post-5',
      image: 'https://daily.dev/post-5.jpg',
      sourceId: 'source-a',
      authorId: 'author-good',
      upvotes: 9,
      createdAt: new Date('2026-03-07T10:00:00.000Z'),
      visible: true,
      private: false,
      deleted: false,
      banned: false,
    },
    {
      id: 'post-6',
      shortId: 'post6',
      title: 'Low Reputation Author',
      url: 'https://daily.dev/post-6',
      image: 'https://daily.dev/post-6.jpg',
      sourceId: 'source-a',
      authorId: 'author-low',
      upvotes: 30,
      createdAt: new Date('2026-03-06T10:00:00.000Z'),
      visible: true,
      private: false,
      deleted: false,
      banned: false,
    },
    {
      id: 'post-7',
      shortId: 'post7',
      title: 'Wrong Month',
      url: 'https://daily.dev/post-7',
      image: 'https://daily.dev/post-7.jpg',
      sourceId: 'source-a',
      authorId: 'author-good',
      upvotes: 50,
      createdAt: new Date('2026-04-02T10:00:00.000Z'),
      visible: true,
      private: false,
      deleted: false,
      banned: false,
    },
  ]);

  await saveFixtures(con, SharePost, [
    {
      id: 'post-8',
      shortId: 'post8',
      title: 'Wrong Type',
      url: 'https://daily.dev/post-8',
      image: 'https://daily.dev/post-8.jpg',
      sourceId: 'source-b',
      authorId: 'author-good',
      upvotes: 100,
      createdAt: new Date('2026-03-05T10:00:00.000Z'),
      visible: true,
      private: false,
      deleted: false,
      banned: false,
    },
  ]);

  await saveFixtures(con, PostKeyword, [
    { postId: 'post-1', keyword: 'webdev', status: 'allow' },
    { postId: 'post-2', keyword: 'webdev', status: 'allow' },
    { postId: 'post-3', keyword: 'webdev', status: 'allow' },
    { postId: 'post-4', keyword: 'backend', status: 'allow' },
    { postId: 'post-5', keyword: 'webdev', status: 'allow' },
    { postId: 'post-6', keyword: 'webdev', status: 'allow' },
    { postId: 'post-7', keyword: 'webdev', status: 'allow' },
    { postId: 'post-8', keyword: 'webdev', status: 'allow' },
  ]);
});

afterAll(async () => disposeGraphQLTesting(state));

describe('materializePeriodArchives', () => {
  it('should materialize monthly global, tag, and source archives for the last closed month', async () => {
    await materializePeriodArchives({
      con,
      now: new Date('2026-04-15T00:00:00.000Z'),
      periodType: ArchivePeriodType.Month,
    });

    const archives = await con.getRepository(Archive).find({
      select: ['id', 'scopeType', 'scopeId', 'periodType', 'periodStart'],
      order: {
        scopeType: 'ASC',
        scopeId: 'ASC',
      },
    });

    expect(archives).toHaveLength(3);
    expect(archives).toMatchObject([
      {
        id: expect.any(String),
        scopeType: ArchiveScopeType.Global,
        scopeId: null,
        periodType: ArchivePeriodType.Month,
        periodStart: marchPeriodStart,
      },
      {
        id: expect.any(String),
        scopeType: ArchiveScopeType.Source,
        scopeId: 'source-a',
        periodType: ArchivePeriodType.Month,
        periodStart: marchPeriodStart,
      },
      {
        id: expect.any(String),
        scopeType: ArchiveScopeType.Tag,
        scopeId: 'webdev',
        periodType: ArchivePeriodType.Month,
        periodStart: marchPeriodStart,
      },
    ]);

    const sourceArchive = archives.find(
      (archive) => archive.scopeType === ArchiveScopeType.Source,
    );

    expect(sourceArchive).toBeDefined();
    if (!sourceArchive) {
      throw new Error('Expected source archive to exist');
    }

    const sourceItems = await con.getRepository(ArchiveItem).find({
      select: ['rank', 'subjectId'],
      where: { archiveId: sourceArchive.id },
      order: { rank: 'ASC' },
    });

    expect(sourceItems).toEqual([
      { rank: 1, subjectId: 'post-6' },
      { rank: 2, subjectId: 'post-4' },
      { rank: 3, subjectId: 'post-1' },
      { rank: 4, subjectId: 'post-2' },
    ]);
  });

  it('should keep an existing archive immutable on rerun', async () => {
    await materializePeriodArchives({
      con,
      now: new Date('2026-04-15T00:00:00.000Z'),
      periodType: ArchivePeriodType.Month,
    });

    const existingArchive = await con.getRepository(Archive).findOneBy({
      subjectType: ArchiveSubjectType.Post,
      rankingType: ArchiveRankingType.Best,
      scopeType: ArchiveScopeType.Tag,
      scopeId: 'webdev',
      periodType: ArchivePeriodType.Month,
      periodStart: marchPeriodStart,
    });

    expect(existingArchive).toBeDefined();
    if (!existingArchive) {
      throw new Error('Expected existing archive to exist');
    }

    await saveFixtures(con, ArticlePost, [
      {
        id: 'post-9',
        shortId: 'post9',
        title: 'New Webdev Winner',
        url: 'https://daily.dev/post-9',
        image: 'https://daily.dev/post-9.jpg',
        sourceId: 'source-a',
        authorId: 'author-good',
        upvotes: 200,
        createdAt: new Date('2026-03-12T10:00:00.000Z'),
        visible: true,
        private: false,
        deleted: false,
        banned: false,
      },
    ]);

    await saveFixtures(con, PostKeyword, [
      { postId: 'post-9', keyword: 'webdev', status: 'allow' },
    ]);

    await materializePeriodArchives({
      con,
      now: new Date('2026-04-20T00:00:00.000Z'),
      periodType: ArchivePeriodType.Month,
    });

    const rerunArchive = await con.getRepository(Archive).findOneBy({
      subjectType: ArchiveSubjectType.Post,
      rankingType: ArchiveRankingType.Best,
      scopeType: ArchiveScopeType.Tag,
      scopeId: 'webdev',
      periodType: ArchivePeriodType.Month,
      periodStart: marchPeriodStart,
    });

    expect(rerunArchive).toMatchObject({
      id: existingArchive.id,
      createdAt: existingArchive.createdAt,
    });

    const rerunItems = await con.getRepository(ArchiveItem).find({
      select: ['rank', 'subjectId'],
      where: { archiveId: existingArchive.id },
      order: { rank: 'ASC' },
    });

    expect(rerunItems).toEqual([
      { rank: 1, subjectId: 'post-6' },
      { rank: 2, subjectId: 'post-1' },
      { rank: 3, subjectId: 'post-2' },
      { rank: 4, subjectId: 'post-3' },
    ]);
  });
});

describe('archive queries', () => {
  const archiveQuery = `
    query Archive(
      $subjectType: String!
      $rankingType: String!
      $scopeType: String!
      $scopeId: String
      $periodType: String!
      $year: Int!
      $month: Int
    ) {
      archive(
        subjectType: $subjectType
        rankingType: $rankingType
        scopeType: $scopeType
        scopeId: $scopeId
        periodType: $periodType
        year: $year
        month: $month
      ) {
        id
        scopeType
        scopeId
        periodType
        periodStart
        keyword {
          value
        }
        items {
          rank
          post {
            id
            title
          }
        }
      }
    }
  `;

  const archiveIndexQuery = `
    query ArchiveIndex(
      $subjectType: String!
      $rankingType: String!
      $scopeType: String!
      $scopeId: String
      $periodType: String
      $year: Int
    ) {
      archiveIndex(
        subjectType: $subjectType
        rankingType: $rankingType
        scopeType: $scopeType
        scopeId: $scopeId
        periodType: $periodType
        year: $year
      ) {
        id
        scopeType
        scopeId
        periodType
        periodStart
      }
    }
  `;

  beforeEach(async () => {
    await materializePeriodArchives({
      con,
      now: new Date('2026-04-15T00:00:00.000Z'),
      periodType: ArchivePeriodType.Month,
    });
  });

  it('should return a materialized monthly tag archive with ranked posts', async () => {
    const res = await client.query(archiveQuery, {
      variables: {
        subjectType: ArchiveSubjectType.Post,
        rankingType: ArchiveRankingType.Best,
        scopeType: ArchiveScopeType.Tag,
        scopeId: 'webdev',
        periodType: ArchivePeriodType.Month,
        year: 2026,
        month: 3,
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.archive).toEqual({
      id: expect.any(String),
      scopeType: ArchiveScopeType.Tag,
      scopeId: 'webdev',
      periodType: ArchivePeriodType.Month,
      periodStart: marchPeriodStart.toISOString(),
      keyword: { value: 'webdev' },
      items: [
        {
          rank: 1,
          post: { id: 'post-6', title: 'Low Reputation Author' },
        },
        {
          rank: 2,
          post: { id: 'post-1', title: 'Webdev 1' },
        },
        {
          rank: 3,
          post: { id: 'post-2', title: 'Webdev 2' },
        },
        {
          rank: 4,
          post: { id: 'post-3', title: 'Webdev 3' },
        },
      ],
    });
  });

  it('should return only published archives from archiveIndex', async () => {
    const res = await client.query(archiveIndexQuery, {
      variables: {
        subjectType: ArchiveSubjectType.Post,
        rankingType: ArchiveRankingType.Best,
        scopeType: ArchiveScopeType.Tag,
        scopeId: 'webdev',
        periodType: ArchivePeriodType.Month,
        year: 2026,
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.archiveIndex).toEqual([
      {
        id: expect.any(String),
        scopeType: ArchiveScopeType.Tag,
        scopeId: 'webdev',
        periodType: ArchivePeriodType.Month,
        periodStart: marchPeriodStart.toISOString(),
      },
    ]);
  });

  it('should validate that tag archives require a scopeId', async () =>
    testQueryErrorCode(
      client,
      {
        query: archiveQuery,
        variables: {
          subjectType: ArchiveSubjectType.Post,
          rankingType: ArchiveRankingType.Best,
          scopeType: ArchiveScopeType.Tag,
          periodType: ArchivePeriodType.Month,
          year: 2026,
          month: 3,
        },
      },
      'GRAPHQL_VALIDATION_FAILED',
      'scopeId is required for non-global scopes',
    ));

  it('should validate that yearly archives do not accept a month', async () =>
    testQueryErrorCode(
      client,
      {
        query: archiveQuery,
        variables: {
          subjectType: ArchiveSubjectType.Post,
          rankingType: ArchiveRankingType.Best,
          scopeType: ArchiveScopeType.Global,
          periodType: ArchivePeriodType.Year,
          year: 2026,
          month: 3,
        },
      },
      'GRAPHQL_VALIDATION_FAILED',
      'month must not be set for yearly archives',
    ));
});
