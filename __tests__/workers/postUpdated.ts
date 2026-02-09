import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/postUpdated';
import {
  ArticlePost,
  COMMUNITY_PICKS_SOURCE,
  CollectionPost,
  FreeformPost,
  Keyword,
  NotificationAttachmentType,
  NotificationAttachmentV2,
  Post,
  PostKeyword,
  PostOrigin,
  PostQuestion,
  PostRelation,
  PostType,
  SharePost,
  Source,
  Submission,
  SubmissionStatus,
  UNKNOWN_SOURCE,
  User,
  WelcomePost,
  YouTubePost,
} from '../../src/entity';
import { PostRelationType } from '../../src/entity/posts/PostRelation';
import { sourcesFixture } from '../fixture/source';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { randomUUID } from 'crypto';
import { usersFixture } from '../fixture/user';
import { SubmissionFailErrorMessage } from '../../src/errors';
import { videoPostsFixture } from '../fixture/post';
import { PostCodeSnippet } from '../../src/entity/posts/PostCodeSnippet';
import { downloadJsonFile } from '../../src/common/googleCloud';
import {
  PostCodeSnippetJsonFile,
  PostCodeSnippetLanguage,
} from '../../src/types';
import { insertCodeSnippetsFromUrl } from '../../src/common/post';
import { generateShortId } from '../../src/ids';
import contentPublishedChannelsFixture from '../fixture/contentPublishedChannels.json';

jest.mock('../../src/common/googleCloud', () => ({
  ...(jest.requireActual('../../src/common/googleCloud') as Record<
    string,
    unknown
  >),
  downloadJsonFile: jest.fn(),
}));

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, ArticlePost, [
    {
      id: 'p1',
      shortId: 'p1',
      url: 'http://p1.com',
      score: 0,
      metadataChangedAt: new Date('01-05-2020 12:00:00'),
      sourceId: 'a',
      visible: false,
      createdAt: new Date('01-05-2020 12:00:00'),
      origin: PostOrigin.Squad,
    },
  ]);
  await saveFixtures(con, FreeformPost, [
    {
      id: 'p2',
      shortId: 'p2',
      title: 'freeform post',
      score: 0,
      metadataChangedAt: new Date('01-05-2020 12:00:00'),
      sourceId: 'squad',
      visible: true,
      createdAt: new Date('01-05-2020 12:00:00'),
      type: PostType.Freeform,
      origin: PostOrigin.UserGenerated,
    },
  ]);
});

const createDefaultSubmission = async (id: string = randomUUID()) => {
  const repo = con.getRepository(Submission);
  await repo.save(
    repo.create({ id, url: 'http://sample.article/test', userId: '1' }),
  );
};

const createDefaultUser = async () => {
  await con
    .getRepository(User)
    .save({ ...usersFixture[0], twitter: 'leeTwitter' });
};

const createDefaultKeywords = async () => {
  const repo = con.getRepository(Keyword);
  await repo.insert({
    value: 'mongodb',
    status: 'allow',
  });
  await repo.insert({
    value: 'alpinejs',
    status: 'allow',
  });
  await repo.insert({
    value: 'ab-testing',
    status: 'allow',
  });
  await repo.insert({
    value: 'alpine',
    status: 'synonym',
    synonym: 'alpinejs',
  });
  await repo.insert({
    value: 'a-b-testing',
    status: 'synonym',
    synonym: 'ab-testing',
  });
};

const DEFAULT_QUESTIONS = [
  'What is the one thing you need to truly understand neural networks?',
  'How do neural networks learn?',
  'What is the process of training a neural network?',
];

const createDefaultQuestions = async (postId: string) => {
  const repo = con.getRepository(PostQuestion);
  await repo.save(DEFAULT_QUESTIONS.map((question) => ({ postId, question })));
};

const createSharedPost = async (id = 'sp1') => {
  const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
  await con.getRepository(SharePost).save({
    ...post,
    id,
    shortId: `short-${id}`,
    sharedPostId: 'p1',
    type: PostType.Share,
    visible: false,
  });
};

it('should not update if the database updated date is newer', async () => {
  await expectSuccessfulBackground(worker, {
    id: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
    post_id: 'p1',
    updated_at: new Date('01-05-1990 12:00:00'),
  });
  const post = await con.getRepository(ArticlePost).findOneBy({ id: 'p1' });
  expect(post.metadataChangedAt).toEqual(new Date('2020-01-05T12:00:00.000Z'));
});

it('should not update if the post is not a squad origin', async () => {
  await con
    .getRepository(ArticlePost)
    .update({ id: 'p1' }, { origin: PostOrigin.CommunityPicks });
  await expectSuccessfulBackground(worker, {
    id: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
    post_id: 'p1',
    updated_at: new Date('01-05-1990 12:00:00'),
  });
  const post = await con.getRepository(ArticlePost).findOneBy({ id: 'p1' });
  expect(post.metadataChangedAt).toEqual(new Date('2020-01-05T12:00:00.000Z'));
});

it(`should not update if the post object doesn't have ID`, async () => {
  await con
    .getRepository(ArticlePost)
    .update({ id: 'p1' }, { origin: PostOrigin.CommunityPicks });
  await expectSuccessfulBackground(worker, {
    id: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
    updated_at: new Date('01-05-1990 12:00:00'),
  });
  const post = await con.getRepository(ArticlePost).findOneBy({ id: 'p1' });
  expect(post.metadataChangedAt).toEqual(new Date('2020-01-05T12:00:00.000Z'));
});

it(`should not update if the post changed URL already exists`, async () => {
  await con.getRepository(ArticlePost).insert({
    id: 'p3',
    shortId: 'p3',
    url: 'http://p3.com',
    sourceId: 'a',
  });
  await expectSuccessfulBackground(worker, {
    id: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
    post_id: 'p1',
    url: 'http://p3.com',
    updated_at: new Date('01-05-2023 12:00:00'),
  });
  const post = await con.getRepository(ArticlePost).findOneBy({ id: 'p1' });
  expect(post.url).toEqual('http://p1.com');
  expect(post.metadataChangedAt).toEqual(new Date('2020-01-05T12:00:00.000Z'));
});

it('should update the post and keep it invisible if title is missing', async () => {
  await expectSuccessfulBackground(worker, {
    id: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
    post_id: 'p1',
    updated_at: new Date('01-05-2023 12:00:00'),
  });
  const post = await con.getRepository(ArticlePost).findOneBy({ id: 'p1' });
  expect(post.metadataChangedAt).toEqual(new Date('2023-01-05T12:00:00.000Z'));
  expect(post.visible).toEqual(false);
  expect(post.flags.visible).toEqual(false);
});

it('should update the post and make it visible if title is available', async () => {
  await expectSuccessfulBackground(worker, {
    id: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
    post_id: 'p1',
    updated_at: new Date('01-05-2023 12:00:00'),
    title: 'test',
  });
  const post = await con.getRepository(ArticlePost).findOneBy({ id: 'p1' });
  expect(post.metadataChangedAt).toEqual(new Date('2023-01-05T12:00:00.000Z'));
  expect(post.visible).toEqual(true);
  expect(post.flags.visible).toEqual(true);
  expect(post.visibleAt).toEqual(new Date('2023-01-05T12:00:00.000Z'));
  expect(post.title).toEqual('test');
});

it('should update all the post related shared posts to visible', async () => {
  await createSharedPost();
  await createSharedPost('sp2');
  await expectSuccessfulBackground(worker, {
    id: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
    post_id: 'p1',
    updated_at: new Date('01-05-2023 12:00:00'),
    title: 'test',
  });
  const post = await con.getRepository(ArticlePost).findOneBy({ id: 'p1' });
  expect(post.metadataChangedAt).toEqual(new Date('2023-01-05T12:00:00.000Z'));
  expect(post.visible).toEqual(true);
  expect(post.flags.visible).toEqual(true);
  expect(post.visibleAt).toEqual(new Date('2023-01-05T12:00:00.000Z'));
  expect(post.title).toEqual('test');
  const sharedPost = await con
    .getRepository(SharePost)
    .findOneBy({ id: 'sp1' });
  expect(sharedPost.visible).toEqual(true);
  expect(sharedPost.flags.visible).toEqual(true);
  expect(sharedPost.visibleAt).toEqual(new Date('2023-01-05T12:00:00.000Z'));
  const sharedPost2 = await con
    .getRepository(SharePost)
    .findOneBy({ id: 'sp2' });
  expect(sharedPost2?.visible).toEqual(true);
  expect(sharedPost2?.flags.visible).toEqual(true);
  expect(sharedPost2?.visibleAt).toEqual(new Date('2023-01-05T12:00:00.000Z'));
});

it('should update post and not modify keywords', async () => {
  await createDefaultUser();
  await createDefaultKeywords();
  await con
    .getRepository(Post)
    .update({ id: 'p1' }, { tagsStr: 'mongodb, alpinejs' });
  await expectSuccessfulBackground(worker, {
    id: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
    post_id: 'p1',
    title: 'New title',
    extra: {
      keywords: ['mongodb', 'alpinejs'],
    },
  });
  const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
  expect(post.title).toEqual('New title');
  const tagsArray = post.tagsStr.split(',');
  ['mongodb', 'alpinejs'].forEach((item) => {
    expect(tagsArray).toContain(item);
  });
  const postKeywords = await con.getRepository(PostKeyword).find({
    where: {
      postId: 'p1',
    },
  });
  expect(postKeywords.length).toEqual(2);
});

it('should update post and modify keywords', async () => {
  await createDefaultUser();
  await createDefaultKeywords();
  await con
    .getRepository(Post)
    .update({ id: 'p1' }, { tagsStr: 'mongodb, alpinejs' });
  await expectSuccessfulBackground(worker, {
    id: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
    post_id: 'p1',
    title: 'New title',
    extra: {
      keywords: ['mongodb', 'ab-testing'],
    },
  });
  const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
  expect(post.title).toEqual('New title');
  const tagsArray = post.tagsStr.split(',');
  ['mongodb', 'ab-testing'].forEach((item) => {
    expect(tagsArray).toContain(item);
  });
  const postKeywords = await con.getRepository(PostKeyword).find({
    where: {
      postId: 'p1',
    },
  });
  expect(postKeywords.length).toEqual(2);
});

it(`should not update if the post is a welcome post`, async () => {
  await con.getRepository(WelcomePost).save({
    id: 'wp1',
    shortId: 'wp1',
    score: 0,
    metadataChangedAt: new Date('01-05-2020 12:00:00'),
    sourceId: 'a',
    visible: false,
    createdAt: new Date('01-05-2020 12:00:00'),
    origin: PostOrigin.Squad,
  });
  await expectSuccessfulBackground(worker, {
    id: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
    post_id: 'wp1',
    updated_at: new Date('01-05-1990 12:00:00'),
  });
  const post = await con.getRepository(ArticlePost).findOneBy({ id: 'p1' });
  expect(post.metadataChangedAt).toEqual(new Date('2020-01-05T12:00:00.000Z'));
});

it('should update freeform post and only modify allowed fields', async () => {
  await createDefaultKeywords();
  const description = 'description';
  const summary = 'summary';
  await expectSuccessfulBackground(worker, {
    id: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
    post_id: 'p2',
    updated_at: new Date('01-05-2023 12:00:00'),
    title: 'test',
    url: 'https://test.com',
    extra: {
      // Sending this, as it should avoid it for freeform
      site_twitter: 'text',
      canonical_url: 'https://test.com/canon',
      content_curation: ['news', 'story', 'release'],
      read_time: 12,
      keywords: ['mongodb', 'alpinejs'],
      description,
      summary,
    },
    content_type: PostType.Freeform,
  });
  const post = await con.getRepository(FreeformPost).findOneBy({ id: 'p2' });
  expect(post.metadataChangedAt).toEqual(new Date('2023-01-05T12:00:00.000Z'));
  expect(post.visible).toEqual(true);
  expect(post.flags.visible).toEqual(true);
  expect(post.visibleAt).toEqual(new Date('2023-01-05T12:00:00.000Z'));
  expect(post.contentCuration).toEqual(['news', 'story', 'release']);
  expect(post.yggdrasilId).toEqual('f99a445f-e2fb-48e8-959c-e02a17f5e816');
  expect(post.title).toEqual('freeform post');
  expect(post.summary).toEqual(summary);
  expect(post.description).toEqual(description);
  const tagsArray = post.tagsStr.split(',');
  ['mongodb', 'alpinejs'].forEach((item) => {
    expect(tagsArray).toContain(item);
  });
  expect(post.readTime).toEqual(12);
});

it('should save keywords without special characters', async () => {
  await createDefaultUser();
  await con
    .createQueryBuilder()
    .insert()
    .into(Keyword)
    .values([
      { value: 'abc', status: 'allow' },
      { value: 'ab', status: 'allow' },
      { value: 'a1-b2', status: 'allow' },
      { value: 'a_1.net', status: 'allow' },
      { value: '#c', status: 'allow' },
      { value: 'a-b', status: 'allow' },
      { value: '__', status: 'allow' },
    ])
    .execute();

  await expectSuccessfulBackground(worker, {
    id: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
    post_id: 'p1',
    title: 'New title',
    extra: {
      keywords: [
        'abc',
        'a b ',
        'a1-b2',
        "'a1-b2'",
        'a_1.net',
        '#c',
        'a-b?',
        '_ツ_',
        '?',
        "a'b",
      ],
    },
  });
  const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
  expect(post.title).toEqual('New title');
  const tagsArray = post.tagsStr.split(',');
  ['abc', 'ab', 'a1-b2', 'a_1.net', '#c', 'a-b', '__'].forEach((item) => {
    expect(tagsArray).toContain(item);
  });
});

it('should save a new post with the relevant content curation', async () => {
  await createDefaultKeywords();
  await expectSuccessfulBackground(worker, {
    id: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
    post_id: 'p1',
    updated_at: new Date('01-05-2023 12:00:00'),
    title: 'test',
    extra: {
      content_curation: ['news', 'story', 'release'],
    },
  });
  const post = await con.getRepository(ArticlePost).findOneBy({ id: 'p1' });
  expect(post.metadataChangedAt).toEqual(new Date('2023-01-05T12:00:00.000Z'));
  expect(post.visible).toEqual(true);
  expect(post.flags.visible).toEqual(true);
  expect(post.visibleAt).toEqual(new Date('2023-01-05T12:00:00.000Z'));
  expect(post.title).toEqual('test');
  expect(post.contentCuration).toEqual(['news', 'story', 'release']);
});

it('should save a new post with basic information', async () => {
  await expectSuccessfulBackground(worker, {
    id: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
    title: 'Title',
    url: 'https://post.com',
    source_id: 'a',
    order: 0,
  });
  const posts = await con.getRepository(Post).find();
  expect(posts.length).toEqual(4);
  expect(posts[3]).toMatchSnapshot({
    visible: true,
    visibleAt: expect.any(Date),
    createdAt: expect.any(Date),
    metadataChangedAt: expect.any(Date),
    score: expect.any(Number),
    id: expect.any(String),
    slug: expect.any(String),
    shortId: expect.any(String),
    contentCuration: expect.any(Array),
    contentMeta: expect.any(Object),
    sourceId: 'a',
    title: 'Title',
    showOnFeed: true,
    language: 'en',
    contentQuality: expect.any(Object),
    statsUpdatedAt: expect.any(Date),
  });
});

it('should save a new post with with non-default language', async () => {
  await expectSuccessfulBackground(worker, {
    id: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
    title: 'Title',
    url: 'https://post.com',
    source_id: 'a',
    order: 0,
    language: 'nb',
  });
  const posts = await con.getRepository(Post).find();
  expect(posts.length).toEqual(4);
  expect(posts[3]).toMatchObject({
    sourceId: 'a',
    title: 'Title',
    showOnFeed: true,
    language: 'nb',
  });
});

it('should set show on feed to true when order is missing', async () => {
  await expectSuccessfulBackground(worker, {
    id: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
    title: 'Title',
    url: 'https://post.com',
    source_id: 'a',
  });
  const posts = await con.getRepository(Post).find();
  expect(posts.length).toEqual(4);
  expect(posts[2].showOnFeed).toEqual(true);
});

it('should save a new post with showOnFeed information', async () => {
  await expectSuccessfulBackground(worker, {
    id: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
    title: 'Title',
    url: 'https://post.com',
    source_id: 'a',
    order: 1,
  });
  const posts = await con.getRepository(Post).find();
  expect(posts.length).toEqual(4);
  expect(posts[3].showOnFeed).toEqual(false);
});

it('should save a new post with content curation', async () => {
  await expectSuccessfulBackground(worker, {
    id: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
    title: 'Title',
    url: 'https://post.com',
    source_id: 'a',
    extra: {
      content_curation: ['news', 'story', 'release'],
    },
  });
  const posts = await con.getRepository(Post).find();
  expect(posts.length).toEqual(4);
  const post = await con
    .getRepository(Post)
    .findOneBy({ yggdrasilId: 'f99a445f-e2fb-48e8-959c-e02a17f5e816' });
  expect(post?.contentCuration).toIncludeSameMembers([
    'news',
    'story',
    'release',
  ]);
});

it('save a post as public if source is public', async () => {
  await expectSuccessfulBackground(worker, {
    id: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
    title: 'Title',
    url: 'https://post.com',
    source_id: 'a',
  });
  const posts = await con.getRepository(Post).find();
  expect(posts.length).toEqual(4);
  expect(posts[2].private).toEqual(false);
  expect(posts[3].flags.private).toEqual(false);
});

it('save a post as private if source is private', async () => {
  await expectSuccessfulBackground(worker, {
    id: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
    title: 'Title',
    url: 'https://post.com',
    source_id: 'p',
  });
  const posts = await con.getRepository(Post).find();
  expect(posts.length).toEqual(4);
  expect(posts[3].private).toBe(true);
  expect(posts[3].flags.private).toBe(true);
});

it('should save a new post with recommendation and quality signals', async () => {
  await expectSuccessfulBackground(worker, {
    id: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
    title: 'Title',
    url: 'https://post.com',
    source_id: 'a',
    content_quality: {
      specificity: 'high',
      intent: 'tutorial',
      substance_depth: 'deep',
      title_content_alignment: 'aligned',
      self_promotion_score: 0.25,
    },
  });
  const posts = await con.getRepository(Post).find();
  expect(posts.length).toEqual(4);
  const post = posts[3];
  expect(post.contentQuality.specificity).toEqual('high');
  expect(post.contentQuality.intent).toEqual('tutorial');
  expect(post.contentQuality.substance_depth).toEqual('deep');
  expect(post.contentQuality.title_content_alignment).toEqual('aligned');
  expect(post.contentQuality.self_promotion_score).toEqual(0.25);
});

it('do not save post if source can not be found', async () => {
  await expectSuccessfulBackground(worker, {
    id: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
    title: 'Title',
    url: 'https://post.com',
    source_id: 'source-does-not-exist-on-the-api',
  });
  const post = await con.getRepository(Post).findOne({
    where: {
      id: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
    },
  });
  expect(post).toBeNull();
});

it('should save post if source_id is not passed but post exists', async () => {
  const newPostId = await generateShortId();

  const newPost = await con.getRepository(FreeformPost).save({
    id: newPostId,
    shortId: newPostId,
    title: 'Post title',
    content: 'Post content',
    yggdrasilId: '9bdf5876-847b-4ea7-82dc-0bcd1b2da49a',
    visible: true,
    sourceId: 'a',
  });

  const existingPost = await con.getRepository(FreeformPost).findOneOrFail({
    where: {
      id: newPost.id,
    },
  });

  await expectSuccessfulBackground(worker, {
    id: '9bdf5876-847b-4ea7-82dc-0bcd1b2da49a',
    post_id: undefined,
    content_type: PostType.Freeform,
  });

  const post = await con.getRepository(FreeformPost).findOne({
    where: {
      id: existingPost.id,
    },
  });

  expect(post).not.toBeNull();
  expect(post!.metadataChangedAt.getTime()).toBeGreaterThan(
    existingPost.metadataChangedAt.getTime(),
  );
});

it('should update submission to rejected', async () => {
  const uuid = randomUUID();
  await createDefaultUser();
  await createDefaultSubmission(uuid);
  await expectSuccessfulBackground(worker, {
    id: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
    title: 'Title',
    url: 'https://post.com',
    source_id: 'a',
    submission_id: uuid,
    reject_reason: SubmissionFailErrorMessage.PAYWALL,
  });
  const submissions = await con.getRepository(Submission).find();
  const [submission] = submissions;
  expect(submissions.length).toEqual(1);
  expect(submission.id).toEqual(uuid);
  expect(submission.status).toEqual(SubmissionStatus.Rejected);
});

it('should not update already approved post', async () => {
  const uuid = randomUUID();
  await createDefaultUser();
  const repo = con.getRepository(Submission);
  await repo.save({
    id: uuid,
    url: 'http://sample.article/test',
    userId: '1',
    status: SubmissionStatus.Accepted,
  });
  await expectSuccessfulBackground(worker, {
    id: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
    title: 'Title',
    url: 'https://post.com',
    source_id: 'a',
    submission_id: uuid,
    reject_reason: SubmissionFailErrorMessage.PAYWALL,
  });
  const submissions = await con.getRepository(Submission).find();
  const [submission] = submissions;
  expect(submissions.length).toEqual(1);
  expect(submission.id).toEqual(uuid);
  expect(submission.status).toEqual(SubmissionStatus.Accepted);
});

describe('on post create', () => {
  beforeEach(async () => {
    await createDefaultUser();
  });

  describe('when data includes questions', () => {
    it('creates a question record each one', async () => {
      const uuid = randomUUID();
      await createDefaultSubmission(uuid);

      // pre-check
      const questionsBefore = await con.getRepository(PostQuestion).find();
      expect(questionsBefore.length).toEqual(0);

      await expectSuccessfulBackground(worker, {
        id: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
        title: 'With questions',
        url: `https://post.com/${uuid}`,
        source_id: 'a',
        submission_id: uuid,
        extra: {
          questions: DEFAULT_QUESTIONS,
        },
      });

      const post = await con
        .getRepository(Post)
        .findOneBy({ title: 'With questions' });
      const questionsAfter = await con
        .getRepository(PostQuestion)
        .findBy({ postId: post.id });
      expect(questionsAfter.length).toEqual(3);
      expect(questionsAfter.map((q) => q.question)).toEqual(
        expect.arrayContaining(DEFAULT_QUESTIONS),
      );
    });
  });

  describe('when data does not include questions', () => {
    it('does not fail', async () => {
      const uuid = randomUUID();
      await createDefaultSubmission(uuid);

      await expectSuccessfulBackground(worker, {
        id: 'f99a445f-e2fb-48e8-959c-e02a17f5e817',
        title: 'Without questions',
        url: `https://post.com/${uuid}`,
        source_id: 'a',
        submission_id: uuid,
      });

      const questions = await con.getRepository(PostQuestion).find();
      expect(questions.length).toEqual(0);
    });
  });

  it('should save content meta', async () => {
    const uuid = randomUUID();
    await createDefaultSubmission(uuid);

    const postBefore = await con.getRepository(Post).findOneBy({
      yggdrasilId: 'f99a445f-e2fb-48e8-959c-e02a17f5e817',
    });
    expect(postBefore).toBeNull();

    await expectSuccessfulBackground(worker, {
      id: 'f99a445f-e2fb-48e8-959c-e02a17f5e817',
      title: 'Without questions',
      url: `https://post.com/${uuid}`,
      source_id: 'a',
      submission_id: uuid,
      meta: {
        scraped_html: '<html>test</html>',
        cleaned_trafilatura_xml: '<xml>test</xml>',
      },
    });

    const post = await con.getRepository(Post).findOneBy({
      yggdrasilId: 'f99a445f-e2fb-48e8-959c-e02a17f5e817',
    });
    expect(post).not.toBeNull();
    expect(post?.contentMeta).toMatchObject({
      scraped_html: '<html>test</html>',
      cleaned_trafilatura_xml: '<xml>test</xml>',
    });
  });

  it('should default to empty content meta', async () => {
    const uuid = randomUUID();
    await createDefaultSubmission(uuid);

    const postBefore = await con.getRepository(Post).findOneBy({
      yggdrasilId: 'f99a445f-e2fb-48e8-959c-e02a17f5e817',
    });
    expect(postBefore).toBeNull();

    await expectSuccessfulBackground(worker, {
      id: 'f99a445f-e2fb-48e8-959c-e02a17f5e817',
      title: 'Without questions',
      url: `https://post.com/${uuid}`,
      source_id: 'a',
      submission_id: uuid,
    });

    const post = await con.getRepository(Post).findOneBy({
      yggdrasilId: 'f99a445f-e2fb-48e8-959c-e02a17f5e817',
    });
    expect(post).not.toBeNull();
    expect(post?.contentMeta).toStrictEqual({});
  });

  it('should save content meta for freeform', async () => {
    const uuid = randomUUID();
    await createDefaultSubmission(uuid);

    const postBefore = await con.getRepository(Post).findOneBy({
      yggdrasilId: 'f99a445f-e2fb-48e8-959c-e02a17f5e817',
    });
    expect(postBefore).toBeNull();

    await expectSuccessfulBackground(worker, {
      id: 'f99a445f-e2fb-48e8-959c-e02a17f5e817',
      title: 'Without questions',
      url: `https://post.com/${uuid}`,
      source_id: 'a',
      submission_id: uuid,
      meta: {
        scraped_html: '<html>test</html>',
        cleaned_trafilatura_xml: '<xml>test</xml>',
      },
      content_type: PostType.Freeform,
    });

    const post = await con.getRepository(Post).findOneBy({
      yggdrasilId: 'f99a445f-e2fb-48e8-959c-e02a17f5e817',
    });
    expect(post).not.toBeNull();
    expect(post?.contentMeta).toMatchObject({
      scraped_html: '<html>test</html>',
      cleaned_trafilatura_xml: '<xml>test</xml>',
    });
  });

  it('should save content quality', async () => {
    const uuid = randomUUID();
    await createDefaultSubmission(uuid);

    const postBefore = await con.getRepository(Post).findOneBy({
      yggdrasilId: 'f99a445f-e2fb-48e8-959c-e02a17f5e817',
    });
    expect(postBefore).toBeNull();

    await expectSuccessfulBackground(worker, {
      id: 'f99a445f-e2fb-48e8-959c-e02a17f5e817',
      title: 'Without questions',
      url: `https://post.com/${uuid}`,
      source_id: 'a',
      submission_id: uuid,
      content_quality: {
        is_ai_probability: 0.52,
      },
    });

    const post = await con.getRepository(Post).findOneBy({
      yggdrasilId: 'f99a445f-e2fb-48e8-959c-e02a17f5e817',
    });
    expect(post).not.toBeNull();
    expect(post?.contentQuality).toMatchObject({
      is_ai_probability: 0.52,
    });
  });

  it('should default to empty content quality', async () => {
    const uuid = randomUUID();
    await createDefaultSubmission(uuid);

    const postBefore = await con.getRepository(Post).findOneBy({
      yggdrasilId: 'f99a445f-e2fb-48e8-959c-e02a17f5e817',
    });
    expect(postBefore).toBeNull();

    await expectSuccessfulBackground(worker, {
      id: 'f99a445f-e2fb-48e8-959c-e02a17f5e817',
      title: 'Without questions',
      url: `https://post.com/${uuid}`,
      source_id: 'a',
      submission_id: uuid,
    });

    const post = await con.getRepository(Post).findOneBy({
      yggdrasilId: 'f99a445f-e2fb-48e8-959c-e02a17f5e817',
    });
    expect(post).not.toBeNull();
    expect(post?.contentQuality).toStrictEqual({});
  });

  describe('post code snippets', () => {
    it('should create post with code snippets', async () => {
      (
        downloadJsonFile as jest.MockedFunction<typeof downloadJsonFile>
      ).mockResolvedValueOnce({
        snippets: [
          'while (true) {\n    /* remove this */\n}',
          'const a = 1;\n\nconsole.log(a)',
        ],
      });

      const uuid = randomUUID();

      await expectSuccessfulBackground(worker, {
        id: uuid,
        title: `Title ${uuid}`,
        url: `http://example.com/posts/${uuid}`,
        source_id: 'a',
        meta: {
          stored_code_snippets: `gs://bucket/${uuid}.json`,
        },
      });

      const post = await con.getRepository(ArticlePost).findOneByOrFail({
        yggdrasilId: uuid,
      });

      const codeSnippets = await con.getRepository(PostCodeSnippet).find({
        where: {
          postId: post.id,
        },
        order: {
          order: 'ASC',
        },
      });
      expect(codeSnippets.length).toEqual(2);
      expect(codeSnippets).toMatchObject([
        {
          content: 'while (true) {\n    /* remove this */\n}',
          contentHash: 'ee1cdee8c96afc016935ccde191e021d3327ee79',
          createdAt: expect.any(Date),
          language: PostCodeSnippetLanguage.Plain,
          order: 0,
          postId: post.id,
        },
        {
          content: 'const a = 1;\n\nconsole.log(a)',
          contentHash: 'c1d469fbdc2d504110e247b6f754075d1cda2cce',
          createdAt: expect.any(Date),
          language: PostCodeSnippetLanguage.Plain,
          order: 1,
          postId: post.id,
        },
      ]);
    });

    it('should ignore duplicate code snippets', async () => {
      (
        downloadJsonFile as jest.MockedFunction<typeof downloadJsonFile>
      ).mockResolvedValueOnce({
        snippets: [
          'while (true) {\n    /* remove this */\n}',
          'const a = 1;\n\nconsole.log(a)',
          'const a = 1;\n\nconsole.log(a)',
        ],
      });

      const uuid = randomUUID();

      await expectSuccessfulBackground(worker, {
        id: uuid,
        title: `Title ${uuid}`,
        url: `http://example.com/posts/${uuid}`,
        source_id: 'a',
        meta: {
          stored_code_snippets: `gs://bucket/${uuid}.json`,
        },
      });

      const post = await con.getRepository(ArticlePost).findOneByOrFail({
        yggdrasilId: uuid,
      });

      const codeSnippets = await con.getRepository(PostCodeSnippet).find({
        where: {
          postId: post.id,
        },
        order: {
          order: 'ASC',
        },
      });
      expect(codeSnippets.length).toEqual(2);
      expect(codeSnippets).toMatchObject([
        {
          content: 'while (true) {\n    /* remove this */\n}',
          contentHash: 'ee1cdee8c96afc016935ccde191e021d3327ee79',
          createdAt: expect.any(Date),
          language: PostCodeSnippetLanguage.Plain,
          order: 0,
          postId: post.id,
        },
        {
          content: 'const a = 1;\n\nconsole.log(a)',
          contentHash: 'c1d469fbdc2d504110e247b6f754075d1cda2cce',
          createdAt: expect.any(Date),
          language: PostCodeSnippetLanguage.Plain,
          order: 1,
          postId: post.id,
        },
      ]);
    });
  });

  describe('post alt_title translation', () => {
    it('should create post with alt_title translation', async () => {
      const uuid = randomUUID();

      const postBefore = await con.getRepository(Post).findOneBy({
        yggdrasilId: uuid,
      });
      expect(postBefore).toBeNull();

      await expectSuccessfulBackground(worker, {
        id: uuid,
        content_type: PostType.Article,
        alt_title: 'Alt title',
        source_id: 'a',
      });

      const createdPost = await con.getRepository(ArticlePost).findOneBy({
        yggdrasilId: uuid,
      });

      expect(createdPost).not.toBeNull();
      expect(createdPost?.translation).toEqual({
        en: {
          smartTitle: 'Alt title',
        },
      });
    });
  });
});

describe('on post update', () => {
  beforeEach(async () => {
    await createDefaultUser();
  });

  describe('without existing questions for the post', () => {
    it('creates a question record for each one', async () => {
      const postId = 'p1';

      // pre-check
      const questionsBefore = await con
        .getRepository(PostQuestion)
        .findBy({ postId });
      expect(questionsBefore.length).toEqual(0);

      await expectSuccessfulBackground(worker, {
        id: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
        post_id: postId,
        title: 'New title',
        extra: {
          questions: DEFAULT_QUESTIONS,
        },
      });

      const questionsAfter = await con
        .getRepository(PostQuestion)
        .findBy({ postId });
      expect(questionsAfter.length).toEqual(3);
    });
  });

  describe('with existing questions for the post', () => {
    it('does not create new question records', async () => {
      const postId = 'p1';
      await createDefaultQuestions(postId);

      // pre-check
      const questionsBefore = await con
        .getRepository(PostQuestion)
        .findBy({ postId });
      expect(questionsBefore.length).toEqual(3);

      await expectSuccessfulBackground(worker, {
        id: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
        post_id: postId,
        title: 'New title',
        extra: {
          questions: ['foo', 'bar', 'baz'],
        },
      });

      const questionsAfter = await con
        .getRepository(PostQuestion)
        .findBy({ postId });
      expect(questionsAfter.length).toEqual(3);
      expect(questionsAfter.map((q) => q.question)).toEqual(
        expect.arrayContaining(DEFAULT_QUESTIONS),
      );
    });
  });

  it('should resolve post id from yggdrasil id when post id is missing', async () => {
    const postId = 'p1';

    const existingPost = await con.getRepository(ArticlePost).save({
      id: postId,
      title: 'Post title',
      yggdrasilId: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
    });

    expect(existingPost).not.toBeNull();
    expect(existingPost.title).toEqual('Post title');

    await expectSuccessfulBackground(worker, {
      id: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
      post_id: undefined,
      title: 'New title 2',
    });

    const updatedPost = await con.getRepository(ArticlePost).findOneBy({
      id: postId,
    });
    expect(updatedPost!.title).toEqual('New title 2');
  });

  it('should retain visible state when title is present', async () => {
    const postId = 'p1';

    const existingPost = await con.getRepository(ArticlePost).save({
      id: postId,
      title: 'Post title',
      yggdrasilId: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
      visible: true,
    });

    expect(existingPost).not.toBeNull();
    expect(existingPost.visible).toEqual(true);

    await expectSuccessfulBackground(worker, {
      id: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
      post_id: undefined,
      title: 'New title 2',
    });

    const updatedPost = await con.getRepository(ArticlePost).findOneBy({
      id: postId,
    });
    expect(updatedPost!.visible).toEqual(true);
  });

  it('should not make post invisible once when visible', async () => {
    const postId = 'p1';

    const existingPost = await con.getRepository(ArticlePost).save({
      id: postId,
      title: 'Post title',
      yggdrasilId: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
      visible: true,
    });

    expect(existingPost).not.toBeNull();
    expect(existingPost.visible).toEqual(true);

    await expectSuccessfulBackground(worker, {
      id: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
      post_id: postId,
    });

    const updatedPost = await con.getRepository(ArticlePost).findOneBy({
      id: postId,
    });
    expect(updatedPost!.visible).toEqual(true);
  });

  it('should replace content meta', async () => {
    const postId = 'p1';

    const existingPost = await con.getRepository(ArticlePost).save({
      id: postId,
      yggdrasilId: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
      contentMeta: {
        scraped_html: '<html>test</html>',
        cleaned_trafilatura_xml: '<xml>test</xml>',
      },
    });

    expect(existingPost).not.toBeNull();

    await expectSuccessfulBackground(worker, {
      id: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
      post_id: postId,
      meta: {
        scraped_html: '<html>test2</html>',
        cleaned_trafilatura_xml: '<xml>test2</xml>',
      },
    });

    const updatedPost = await con.getRepository(ArticlePost).findOneBy({
      id: postId,
    });

    expect(existingPost).not.toBeNull();
    expect(updatedPost?.contentMeta).toMatchObject({
      scraped_html: '<html>test2</html>',
      cleaned_trafilatura_xml: '<xml>test2</xml>',
    });
  });

  it('should persist channels in content meta', async () => {
    const postId = 'p1';

    await con.getRepository(ArticlePost).save({
      id: postId,
      yggdrasilId: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
    });

    await expectSuccessfulBackground(worker, {
      id: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
      post_id: postId,
      meta: {
        channels: ['devops', 'tools'],
      },
    });

    const updatedPost = await con.getRepository(ArticlePost).findOneBy({
      id: postId,
    });

    expect(updatedPost?.contentMeta).toMatchObject({
      channels: ['devops', 'tools'],
    });
  });

  it('should consume content published fixture with channels', async () => {
    const payload = contentPublishedChannelsFixture;

    await expectSuccessfulBackground(worker, payload);

    const updatedPost = await con.getRepository(ArticlePost).findOneBy({
      id: payload.post_id,
    });

    expect(updatedPost?.contentMeta).toMatchObject({
      channels: ['devops', 'tools'],
    });
  });

  it('should not update empty content meta when meta is empty', async () => {
    const postId = 'p1';

    const existingPost = await con.getRepository(ArticlePost).save({
      id: postId,
      yggdrasilId: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
      contentMeta: {
        scraped_html: '<html>test2</html>',
        cleaned_trafilatura_xml: '<xml>test2</xml>',
      },
    });

    expect(existingPost).not.toBeNull();

    await expectSuccessfulBackground(worker, {
      id: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
      post_id: postId,
    });

    const updatedPost = await con.getRepository(ArticlePost).findOneBy({
      id: postId,
    });
    expect(updatedPost).not.toBeNull();
    expect(updatedPost?.contentMeta).toMatchObject({
      scraped_html: '<html>test2</html>',
      cleaned_trafilatura_xml: '<xml>test2</xml>',
    });
  });

  it('should replace content meta for freeform', async () => {
    const postId = 'ff-cm-p1';

    const existingPost = await con.getRepository(FreeformPost).save({
      id: postId,
      shortId: postId,
      type: PostType.Freeform,
      yggdrasilId: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
      contentMeta: {
        scraped_html: '<html>test</html>',
        cleaned_trafilatura_xml: '<xml>test</xml>',
      },
      sourceId: 'a',
    });

    expect(existingPost).not.toBeNull();

    await expectSuccessfulBackground(worker, {
      id: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
      post_id: postId,
      content_type: PostType.Freeform,
      meta: {
        scraped_html: '<html>test2</html>',
        cleaned_trafilatura_xml: '<xml>test2</xml>',
      },
    });

    const updatedPost = await con.getRepository(FreeformPost).findOneBy({
      id: postId,
    });

    expect(updatedPost).not.toBeNull();
    expect(updatedPost?.contentMeta).toMatchObject({
      scraped_html: '<html>test2</html>',
      cleaned_trafilatura_xml: '<xml>test2</xml>',
    });
  });

  it('should replace content quality', async () => {
    const postId = 'p1';

    const existingPost = await con.getRepository(ArticlePost).save({
      id: postId,
      yggdrasilId: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
      contentQuality: {
        is_ai_probability: 0.52,
        is_clickbait_probability: 0.42,
      },
    });

    expect(existingPost).not.toBeNull();

    await expectSuccessfulBackground(worker, {
      id: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
      post_id: postId,
      content_quality: {
        is_ai_probability: 0.72,
        is_clickbait_probability: 0.62,
      },
    });

    const updatedPost = await con.getRepository(ArticlePost).findOneBy({
      id: postId,
    });

    expect(existingPost).not.toBeNull();
    expect(updatedPost?.contentQuality).toMatchObject({
      is_ai_probability: 0.72,
      is_clickbait_probability: 0.62,
    });
  });

  it('should not replace manual_clickbait_probability if manual_clickbait_probability is set', async () => {
    const postId = 'p1';

    const existingPost = await con.getRepository(ArticlePost).save({
      id: postId,
      yggdrasilId: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
      contentQuality: {
        is_ai_probability: 0.52,
        is_clickbait_probability: 0.42,
        manual_clickbait_probability: 1,
      },
    });

    expect(existingPost).not.toBeNull();

    await expectSuccessfulBackground(worker, {
      id: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
      post_id: postId,
      content_quality: {
        is_ai_probability: 0.72,
        is_clickbait_probability: 0.62,
      },
    });

    const updatedPost = await con.getRepository(ArticlePost).findOneBy({
      id: postId,
    });

    expect(existingPost).not.toBeNull();
    expect(updatedPost?.contentQuality).toMatchObject({
      is_ai_probability: 0.72,
      is_clickbait_probability: 0.62,
      manual_clickbait_probability: 1,
    });
  });

  it('should not update empty content quality when field is empty', async () => {
    const postId = 'p1';

    const existingPost = await con.getRepository(ArticlePost).save({
      id: postId,
      yggdrasilId: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
      contentQuality: {
        is_ai_probability: 0.52,
      },
    });

    expect(existingPost).not.toBeNull();

    await expectSuccessfulBackground(worker, {
      id: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
      post_id: postId,
    });

    const updatedPost = await con.getRepository(ArticlePost).findOneBy({
      id: postId,
    });
    expect(updatedPost).not.toBeNull();
    expect(updatedPost?.contentQuality).toMatchObject({
      is_ai_probability: 0.52,
    });
  });

  it('should update post with recommendation and quality signals', async () => {
    const postId = 'p1';

    await con.getRepository(ArticlePost).save({
      id: postId,
      yggdrasilId: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
    });

    await expectSuccessfulBackground(worker, {
      id: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
      post_id: postId,
      content_quality: {
        specificity: 'medium',
        intent: 'reference',
        substance_depth: 'surface',
        title_content_alignment: 'misaligned',
        self_promotion_score: 0.75,
      },
    });

    const updatedPost = await con.getRepository(ArticlePost).findOneBy({
      id: postId,
    });

    expect(updatedPost?.contentQuality.specificity).toEqual('medium');
    expect(updatedPost?.contentQuality.intent).toEqual('reference');
    expect(updatedPost?.contentQuality.substance_depth).toEqual('surface');
    expect(updatedPost?.contentQuality.title_content_alignment).toEqual(
      'misaligned',
    );
    expect(updatedPost?.contentQuality.self_promotion_score).toEqual(0.75);
  });

  describe('vordr', () => {
    it('should vordr post based on title', async () => {
      const uuid = randomUUID();
      const postId = 'vordr3';
      await saveFixtures(con, Submission, [
        {
          id: uuid,
          url: 'http://vordr.com/test',
          userId: '1',
          flags: {
            vordr: false,
          },
        },
      ]);

      await con.getRepository(ArticlePost).save({
        id: postId,
        shortId: postId,
        url: 'https://post.com/scp1',
        title: 'Scouted title',
        visible: false,
        yggdrasilId: '90660dab-7cd1-49f0-8fe5-41c587ca837f',
        sourceId: COMMUNITY_PICKS_SOURCE,
        flags: {
          promoteToPublic: 1,
          showOnFeed: true,
        },
      });

      await expectSuccessfulBackground(worker, {
        id: '90660dab-7cd1-49f0-8fe5-41c587ca837f',
        post_id: postId,
        url: 'http://vordr.com/test',
        source_id: COMMUNITY_PICKS_SOURCE,
        title: 'Spam',
      });

      const updatedPost = await con.getRepository(ArticlePost).findOneByOrFail({
        id: postId,
      });

      expect(updatedPost.flags.vordr).toEqual(true);
      expect(updatedPost.flags.showOnFeed).toEqual(false);
      expect(updatedPost.flags.promoteToPublic).toEqual(1);
    });
  });

  describe('post code snippets', () => {
    const createPostWithCodeSnippets = async ({
      snippets,
    }: Pick<PostCodeSnippetJsonFile, 'snippets'>) => {
      (
        downloadJsonFile as jest.MockedFunction<typeof downloadJsonFile>
      ).mockResolvedValueOnce({
        snippets,
      });

      const uuid = randomUUID();
      const post = await con.getRepository(ArticlePost).save({
        id: 'pcs1',
        shortId: 'pcs1',
        yggdrasilId: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
        url: `http://example.com/posts/${uuid}`,
        sourceId: 'a',
      });
      await insertCodeSnippetsFromUrl({
        entityManager: con.manager,
        post: {
          id: post.id,
        },
        codeSnippetsUrl: `gs://bucket/${uuid}.json`,
      });

      return post;
    };

    it('should update post with code snippets', async () => {
      const existingPost = await createPostWithCodeSnippets({
        snippets: [
          'while (true) {\n    /* remove this */\n}',
          'const a = 1;\n\nconsole.log(a)',
        ],
      });
      expect(await con.getRepository(PostCodeSnippet).count()).toBe(2);

      (
        downloadJsonFile as jest.MockedFunction<typeof downloadJsonFile>
      ).mockResolvedValueOnce({
        snippets: [
          'while (false) {\n    /* remove that */\n}',
          'const b = 1;\n\nconsole.log(b)',
        ],
      });

      await expectSuccessfulBackground(worker, {
        id: existingPost.yggdrasilId,
        post_id: existingPost.id,
        meta: {
          stored_code_snippets: `gs://bucket/${existingPost.yggdrasilId}.json`,
        },
      });

      const post = await con.getRepository(ArticlePost).findOneByOrFail({
        id: existingPost.id,
      });

      const codeSnippets = await con.getRepository(PostCodeSnippet).find({
        where: {
          postId: post.id,
        },
        order: {
          order: 'ASC',
        },
      });
      expect(codeSnippets.length).toEqual(2);
      expect(codeSnippets).toMatchObject([
        {
          content: 'while (false) {\n    /* remove that */\n}',
          contentHash: '1274ca65aa00681606f7894a55143607057bf209',
          createdAt: expect.any(Date),
          language: PostCodeSnippetLanguage.Plain,
          order: 0,
          postId: post.id,
        },
        {
          content: 'const b = 1;\n\nconsole.log(b)',
          contentHash: '370e2729c7035b45c91b3f34fb76e3aafba4303f',
          createdAt: expect.any(Date),
          language: PostCodeSnippetLanguage.Plain,
          order: 1,
          postId: post.id,
        },
      ]);
    });

    it('should delete removed code snippets no and insert added ones', async () => {
      const existingPost = await createPostWithCodeSnippets({
        snippets: [
          'while (true) {\n    /* remove this */\n}',
          'const a = 1;\n\nconsole.log(a)',
        ],
      });
      expect(await con.getRepository(PostCodeSnippet).count()).toBe(2);

      (
        downloadJsonFile as jest.MockedFunction<typeof downloadJsonFile>
      ).mockResolvedValueOnce({
        snippets: [
          'const response = await fetch("https://example.com")',
          'const a = 1;\n\nconsole.log(a)',
          'const timer = setTimeout(console.log, 1000)',
          'const interval = setInterval(console.log, 200)',
        ],
      });

      await expectSuccessfulBackground(worker, {
        id: existingPost.yggdrasilId,
        post_id: existingPost.id,
        meta: {
          stored_code_snippets: `gs://bucket/${existingPost.yggdrasilId}.json`,
        },
      });

      const post = await con.getRepository(ArticlePost).findOneByOrFail({
        id: existingPost.id,
      });

      const codeSnippets = await con.getRepository(PostCodeSnippet).find({
        where: {
          postId: post.id,
        },
        order: {
          order: 'ASC',
        },
      });

      expect(codeSnippets.length).toEqual(4);
      expect(codeSnippets).toMatchObject([
        {
          content: 'const response = await fetch("https://example.com")',
          contentHash: '4b261b65a7d507fe8effedc225cbdb63af8e234e',
          createdAt: expect.any(Date),
          language: PostCodeSnippetLanguage.Plain,
          order: 0,
          postId: post.id,
        },
        {
          content: 'const a = 1;\n\nconsole.log(a)',
          contentHash: 'c1d469fbdc2d504110e247b6f754075d1cda2cce',
          createdAt: expect.any(Date),
          language: PostCodeSnippetLanguage.Plain,
          order: 1,
          postId: post.id,
        },
        {
          content: 'const timer = setTimeout(console.log, 1000)',
          contentHash: 'af7d49e07a60a5ac7d4727ce997ab845086b72bb',
          createdAt: expect.any(Date),
          language: PostCodeSnippetLanguage.Plain,
          order: 2,
          postId: post.id,
        },
        {
          content: 'const interval = setInterval(console.log, 200)',
          contentHash: 'b48a89bf7863a66a5aa62970b3485880d896419a',
          createdAt: expect.any(Date),
          language: PostCodeSnippetLanguage.Plain,
          order: 3,
          postId: post.id,
        },
      ]);
    });

    it('should delete all snippets if all are removed', async () => {
      const existingPost = await createPostWithCodeSnippets({
        snippets: [
          'while (true) {\n    /* remove this */\n}',
          'const a = 1;\n\nconsole.log(a)',
        ],
      });
      expect(await con.getRepository(PostCodeSnippet).count()).toBe(2);

      (
        downloadJsonFile as jest.MockedFunction<typeof downloadJsonFile>
      ).mockResolvedValueOnce({
        snippets: [],
      });

      await expectSuccessfulBackground(worker, {
        id: existingPost.yggdrasilId,
        post_id: existingPost.id,
        meta: {
          stored_code_snippets: `gs://bucket/${existingPost.yggdrasilId}.json`,
        },
      });

      const post = await con.getRepository(ArticlePost).findOneByOrFail({
        id: existingPost.id,
      });

      const codeSnippets = await con.getRepository(PostCodeSnippet).find({
        where: {
          postId: post.id,
        },
        order: {
          order: 'ASC',
        },
      });

      expect(codeSnippets.length).toEqual(0);
      expect(codeSnippets).toMatchObject([]);
    });

    it('should update snippets when order is changed', async () => {
      const existingPost = await createPostWithCodeSnippets({
        snippets: [
          'while (true) {\n    /* remove this */\n}',
          'const a = 1;\n\nconsole.log(a)',
        ],
      });
      expect(await con.getRepository(PostCodeSnippet).count()).toBe(2);

      (
        downloadJsonFile as jest.MockedFunction<typeof downloadJsonFile>
      ).mockResolvedValueOnce({
        snippets: [
          'const a = 1;\n\nconsole.log(a)',
          'while (true) {\n    /* remove this */\n}',
        ],
      });

      await expectSuccessfulBackground(worker, {
        id: existingPost.yggdrasilId,
        post_id: existingPost.id,
        meta: {
          stored_code_snippets: `gs://bucket/${existingPost.yggdrasilId}.json`,
        },
      });

      const post = await con.getRepository(ArticlePost).findOneByOrFail({
        id: existingPost.id,
      });

      const codeSnippets = await con.getRepository(PostCodeSnippet).find({
        where: {
          postId: post.id,
        },
        order: {
          order: 'ASC',
        },
      });
      expect(codeSnippets.length).toEqual(2);
      expect(codeSnippets).toMatchObject([
        {
          content: 'const a = 1;\n\nconsole.log(a)',
          contentHash: 'c1d469fbdc2d504110e247b6f754075d1cda2cce',
          createdAt: expect.any(Date),
          language: PostCodeSnippetLanguage.Plain,
          order: 0,
          postId: post.id,
        },
        {
          content: 'while (true) {\n    /* remove this */\n}',
          contentHash: 'ee1cdee8c96afc016935ccde191e021d3327ee79',
          createdAt: expect.any(Date),
          language: PostCodeSnippetLanguage.Plain,
          order: 1,
          postId: post.id,
        },
      ]);
    });
  });

  describe('post alt_title translation', () => {
    it('should update post with alt_title English translation', async () => {
      const postId = await generateShortId();
      const uuid = randomUUID();

      const existingPost = await con.getRepository(ArticlePost).save({
        id: postId,
        shortId: postId,
        type: PostType.Article,
        yggdrasilId: uuid,
        sourceId: 'a',
      });

      expect(existingPost).not.toBeNull();

      await expectSuccessfulBackground(worker, {
        id: uuid,
        post_id: postId,
        content_type: PostType.Article,
        alt_title: `Alt title's`,
      });

      const updatedPost = await con.getRepository(ArticlePost).findOneBy({
        id: postId,
      });

      expect(updatedPost).not.toBeNull();
      expect(updatedPost?.translation).toEqual({
        en: {
          smartTitle: `Alt title's`,
        },
      });
    });
    it('should not replace existing translations when updating post with alt_title', async () => {
      const postId = await generateShortId();
      const uuid = randomUUID();

      const existingPost = await con.getRepository(ArticlePost).save({
        id: postId,
        shortId: postId,
        type: PostType.Article,
        yggdrasilId: uuid,
        sourceId: 'a',
        translation: {
          en: {
            title: 'Post title',
            content: 'Post content',
          },
          de: {
            title: 'Post title DE',
          },
        },
      });

      expect(existingPost).not.toBeNull();

      await expectSuccessfulBackground(worker, {
        id: uuid,
        post_id: postId,
        content_type: PostType.Article,
        alt_title: 'Alt title',
      });

      const updatedPost = await con.getRepository(ArticlePost).findOneBy({
        id: postId,
      });

      expect(updatedPost).not.toBeNull();
      expect(updatedPost?.translation).toEqual({
        en: {
          title: 'Post title',
          content: 'Post content',
          smartTitle: 'Alt title',
        },
        de: {
          title: 'Post title DE',
        },
      });
    });
  });
});

describe('on youtube post', () => {
  beforeEach(async () => {
    await saveFixtures(con, Source, [
      {
        id: UNKNOWN_SOURCE,
        name: 'Unknown',
        handle: UNKNOWN_SOURCE,
      },
    ]);
    await saveFixtures(con, YouTubePost, videoPostsFixture);

    await saveFixtures(con, ArticlePost, [
      {
        id: 'yt2',
        shortId: 'yt2',
        title: 'youtube post',
        score: 0,
        url: 'https://youtu.be/Oso6dYXw5lc',
        metadataChangedAt: new Date('01-05-2020 12:00:00'),
        sourceId: 'squad',
        visible: true,
        createdAt: new Date('01-05-2020 12:00:00'),
        type: PostType.Article,
        origin: PostOrigin.Squad,
        yggdrasilId: 'd1053f05-4d41-4fc7-885c-c0f7c841a7b6',
      },
      {
        id: 'HR6jmCxzE',
        shortId: 'HR6jmCxzE',
        title: 'Introducing daily.dev Search',
        score: 0,
        url: 'https://www.youtube.com/watch?v=T_AbQGe7fuU',
        metadataChangedAt: new Date('2023-12-11T13:28:31.470744'),
        canonicalUrl: 'https://www.youtube.com/watch?v=T_AbQGe7fuU',
        visible: true,
        createdAt: new Date('2023-12-11T13:28:31.476Z'),
        type: PostType.Article,
        origin: PostOrigin.Squad,
      },
    ]);

    await createDefaultKeywords();
  });

  it('should create a new video post', async () => {
    await expectSuccessfulBackground(worker, {
      id: 'a7edf0c8-aec7-4586-b411-b1dd431ce8d6',
      post_id: undefined,
      updated_at: new Date('01-05-2023 12:00:00'),
      source_id: 'a',
      title: 'test',
      url: 'https://youtu.be/FftMDvlYDIg',
      extra: {
        content_curation: ['news', 'story', 'release'],
        duration: 300,
        keywords: ['mongodb', 'alpinejs'],
        description: 'A description of a video',
        summary: 'A short summary of a video',
      },
      content_type: PostType.VideoYouTube,
    });

    const post = await con.getRepository(YouTubePost).findOneBy({
      yggdrasilId: 'a7edf0c8-aec7-4586-b411-b1dd431ce8d6',
    });

    expect(post).toMatchObject({
      type: 'video:youtube',
      title: 'test',
      sourceId: 'a',
      yggdrasilId: 'a7edf0c8-aec7-4586-b411-b1dd431ce8d6',
      url: 'https://youtu.be/FftMDvlYDIg',
      contentCuration: ['news', 'story', 'release'],
      readTime: 5,
      description: 'A description of a video',
      summary: 'A short summary of a video',
    });
  });

  it('should accept extended content curation values', async () => {
    await expectSuccessfulBackground(worker, {
      id: '7c8cbf2d-2c2a-4b32-9b1e-0f5b6cd02f9b',
      post_id: undefined,
      updated_at: new Date('01-05-2023 12:00:00'),
      source_id: 'a',
      title: 'test',
      url: 'https://youtu.be/FftMDvlYDIg',
      extra: {
        content_curation: ['drama', 'endorsement', 'hot_take'],
        duration: 300,
        keywords: ['mongodb', 'alpinejs'],
        description: 'A description of a video',
        summary: 'A short summary of a video',
      },
      content_type: PostType.VideoYouTube,
    });

    const post = await con.getRepository(YouTubePost).findOneBy({
      yggdrasilId: '7c8cbf2d-2c2a-4b32-9b1e-0f5b6cd02f9b',
    });

    expect(post?.contentCuration).toEqual([
      'drama',
      'endorsement',
      'hot_take',
    ]);
  });

  it('should create a new video post with minimum 1m duration', async () => {
    await expectSuccessfulBackground(worker, {
      id: 'a7edf0c8-aec7-4586-b411-b1dd431ce8d6',
      post_id: undefined,
      updated_at: new Date('01-05-2023 12:00:00'),
      source_id: 'a',
      title: 'test',
      url: 'https://youtu.be/FftMDvlYDIg',
      extra: {
        content_curation: ['news', 'story', 'release'],
        duration: 10,
        keywords: ['mongodb', 'alpinejs'],
        description: 'A description of a video',
        summary: 'A short summary of a video',
      },
      content_type: PostType.VideoYouTube,
    });

    const post = await con.getRepository(YouTubePost).findOneBy({
      yggdrasilId: 'a7edf0c8-aec7-4586-b411-b1dd431ce8d6',
    });

    expect(post.readTime).toEqual(1);
  });

  it('should update a video post', async () => {
    await expectSuccessfulBackground(worker, {
      id: '3cf9ba23-ff30-4578-b232-a98ea733ba0a',
      post_id: 'yt1',
      updated_at: new Date('01-05-2023 12:00:00'),
      source_id: 'a',
      extra: {
        content_curation: ['news', 'story', 'release'],
        duration: 300,
        keywords: ['mongodb', 'alpinejs'],
        description: 'A description of a video',
        summary: 'A short summary of a video',
      },
      content_type: PostType.VideoYouTube,
    });

    const post = await con.getRepository(YouTubePost).findOneBy({
      yggdrasilId: '3cf9ba23-ff30-4578-b232-a98ea733ba0a',
    });

    const tagsArray = post?.tagsStr.split(',');
    ['mongodb', 'alpinejs'].forEach((item) => {
      expect(tagsArray).toContain(item);
    });
    const postKeywords = await con.getRepository(PostKeyword).find({
      where: {
        postId: 'yt1',
      },
    });
    expect(postKeywords.length).toEqual(2);
    expect(post).toMatchObject({
      type: 'video:youtube',
      title: 'youtube post',
      sourceId: 'a',
      yggdrasilId: '3cf9ba23-ff30-4578-b232-a98ea733ba0a',
      url: 'https://youtu.be/T_AbQGe7fuU',
      contentCuration: ['news', 'story', 'release'],
      readTime: 5,
      description: 'A description of a video',
      summary: 'A short summary of a video',
      videoId: 'T_AbQGe7fuU',
    });
  });

  it('should update a real youtube video post', async () => {
    await expectSuccessfulBackground(worker, {
      id: '7922f432-f554-5967-80b5-932fe7320ac2',
      post_id: 'HR6jmCxzE',
      content_type: 'video:youtube',
      source_id: 'unknown',
      origin: 'squads',
      order: 0,
      url: 'https://www.youtube.com/watch?v=T_AbQGe7fuU',
      image: 'https://i.ytimg.com/vi/T_AbQGe7fuU/sddefault.jpg',
      title: 'Introducing daily.dev Search',
      published_at: '2023-11-07T12:04:12Z',
      updated_at: '2023-12-11T13:28:36.997703Z',
      extra: {
        channel_title: 'daily dev',
        comment_count: 3,
        content_curation: ['release'],
        description: 'Try it out: https://daily.dev/daily-dev-search',
        duration: 63,
        keywords: [
          'developer-tools',
          'search-recommendations',
          'daily-dev-search',
        ],
        like_count: 13,
        questions: [
          'What is daily.dev Search?',
          'How does search recommendations work on daily.dev?',
          'What are the benefits of using daily.dev Search?',
        ],
        summary:
          'Introducing daily.dev Search, a feature that allows users to dive deeper into topics they have read about on daily.dev. With search recommendations, users can easily find relevant content in their feeds.',
        view_count: 134,
        video_id: 'T_AbQGe7fuU',
      },
    });

    const post = await con.getRepository(YouTubePost).findOneBy({
      yggdrasilId: '7922f432-f554-5967-80b5-932fe7320ac2',
    });
    expect(post).not.toBeNull();
    expect(post).toMatchObject({
      contentCuration: ['release'],
      description: 'Try it out: https://daily.dev/daily-dev-search',
      readTime: 1,
      sourceId: 'unknown',
      summary:
        'Introducing daily.dev Search, a feature that allows users to dive deeper into topics they have read about on daily.dev. With search recommendations, users can easily find relevant content in their feeds.',
      title: 'Introducing daily.dev Search',
      type: 'video:youtube',
      url: 'https://www.youtube.com/watch?v=T_AbQGe7fuU',
      videoId: 'T_AbQGe7fuU',
      yggdrasilId: '7922f432-f554-5967-80b5-932fe7320ac2',
    });
  });

  it('should update the post type to youtube video when the post is a youtube video', async () => {
    const beforePost = await con.getRepository(ArticlePost).findOneBy({
      yggdrasilId: 'd1053f05-4d41-4fc7-885c-c0f7c841a7b6',
    });
    expect(beforePost?.type).toBe(PostType.Article);

    await expectSuccessfulBackground(worker, {
      id: 'd1053f05-4d41-4fc7-885c-c0f7c841a7b6',
      post_id: 'yt2',
      updated_at: new Date('01-05-2023 12:00:00'),
      source_id: 'squad',
      content_type: PostType.VideoYouTube,
      extra: {
        video_id: 'Oso6dYXw5lc',
      },
    });

    const post = await con.getRepository(YouTubePost).findOneBy({
      yggdrasilId: 'd1053f05-4d41-4fc7-885c-c0f7c841a7b6',
    });

    expect(post?.type).toBe(PostType.VideoYouTube);
    expect(post).toMatchObject({
      type: 'video:youtube',
      title: 'youtube post',
      sourceId: 'squad',
      yggdrasilId: 'd1053f05-4d41-4fc7-885c-c0f7c841a7b6',
      url: 'https://youtu.be/Oso6dYXw5lc',
      videoId: 'Oso6dYXw5lc',
    });
  });

  it('should update the post type when the post already has notification attachment', async () => {
    await con.getRepository(NotificationAttachmentV2).save({
      type: NotificationAttachmentType.Post,
      image: 'http://image.com/placeholder.jpg',
      referenceId: 'yt2',
      title: 'some title',
    });
    const beforePost = await con.getRepository(ArticlePost).findOneBy({
      yggdrasilId: 'd1053f05-4d41-4fc7-885c-c0f7c841a7b6',
    });
    expect(beforePost?.type).toBe(PostType.Article);

    await expectSuccessfulBackground(worker, {
      id: 'd1053f05-4d41-4fc7-885c-c0f7c841a7b6',
      post_id: 'yt2',
      updated_at: new Date('01-05-2023 12:00:00'),
      source_id: 'squad',
      content_type: PostType.VideoYouTube,
      extra: {
        video_id: 'Oso6dYXw5lc',
      },
      image: 'http://image.com',
    });

    const post = await con.getRepository(YouTubePost).findOneBy({
      yggdrasilId: 'd1053f05-4d41-4fc7-885c-c0f7c841a7b6',
    });

    expect(post?.type).toBe(PostType.VideoYouTube);
    expect(post).toMatchObject({
      type: 'video:youtube',
      title: 'youtube post',
      sourceId: 'squad',
      yggdrasilId: 'd1053f05-4d41-4fc7-885c-c0f7c841a7b6',
      url: 'https://youtu.be/Oso6dYXw5lc',
      videoId: 'Oso6dYXw5lc',
      image: 'http://image.com',
    });
  });

  it('should fallback to keywords_native if keywords is missing', async () => {
    await expectSuccessfulBackground(worker, {
      id: '3cf9ba23-ff30-4578-b232-a98ea733ba0a',
      post_id: 'yt1',
      updated_at: new Date('01-05-2023 12:00:00'),
      source_id: 'a',
      extra: {
        keywords_native: ['mongodb', 'alpinejs'],
      },
      content_type: PostType.VideoYouTube,
    });

    const post = await con.getRepository(YouTubePost).findOneBy({
      yggdrasilId: '3cf9ba23-ff30-4578-b232-a98ea733ba0a',
    });

    const tagsArray = post?.tagsStr.split(',');
    ['mongodb', 'alpinejs'].forEach((item) => {
      expect(tagsArray).toContain(item);
    });
    const postKeywords = await con.getRepository(PostKeyword).find({
      where: {
        postId: 'yt1',
      },
    });
    expect(postKeywords.length).toEqual(2);
  });
});

describe('on collection post', () => {
  beforeEach(async () => {
    await con.getRepository(Source).save([
      {
        id: UNKNOWN_SOURCE,
        name: 'Unknown',
        handle: UNKNOWN_SOURCE,
      },
      {
        id: 'collections',
        name: 'Collections',
        handle: 'collections',
      },
    ]);
  });

  it('should create a new collection post', async () => {
    await expectSuccessfulBackground(worker, {
      id: '7ec0bccb-e41f-4c77-a3b4-fe19d20b3874',
      post_id: undefined,
      title: 'New title',
      image: 'http://image.com',
      readTime: 10,
      content_type: PostType.Collection,
      source_id: 'collections',
      extra: {
        description: 'New description',
        summary: 'New summary',
        content: '## New heading\n\n New content',
        origin_entries: [
          '3d5da6ec-b960-4ad8-8278-665a66b71c1f',
          '5a829977-189a-4ac9-85cc-9e822cc7c737',
        ],
        read_time: 10,
      },
    });

    const collection = await con.getRepository(CollectionPost).findOneBy({
      yggdrasilId: '7ec0bccb-e41f-4c77-a3b4-fe19d20b3874',
    });
    expect(collection).toMatchObject({
      type: 'collection',
      title: 'New title',
      sourceId: 'collections',
      yggdrasilId: '7ec0bccb-e41f-4c77-a3b4-fe19d20b3874',
      image: 'http://image.com',
      content: '## New heading\n\n New content',
      readTime: 10,
      description: 'New description',
      summary: 'New summary',
      contentHtml: '<h2>New heading</h2>\n<p>New content</p>\n',
    });
  });

  it('should add post relations', async () => {
    await con.getRepository(ArticlePost).save([
      {
        id: 'cp1',
        shortId: 'cp1',
        url: 'http://cp1.com',
        score: 0,
        metadataChangedAt: new Date('01-05-2020 12:00:00'),
        sourceId: 'a',
        visible: true,
        createdAt: new Date('01-05-2020 12:00:00'),
        origin: PostOrigin.Crawler,
        yggdrasilId: '3d5da6ec-b960-4ad8-8278-665a66b71c1f',
      },
      {
        id: 'cp2',
        shortId: 'cp2',
        url: 'http://cp2.com',
        score: 0,
        metadataChangedAt: new Date('01-05-2020 12:00:00'),
        sourceId: 'a',
        visible: true,
        createdAt: new Date('01-05-2020 12:00:00'),
        origin: PostOrigin.Crawler,
        yggdrasilId: '5a829977-189a-4ac9-85cc-9e822cc7c737',
      },
    ]);

    await expectSuccessfulBackground(worker, {
      id: '7ec0bccb-e41f-4c77-a3b4-fe19d20b3874',
      post_id: undefined,
      title: 'New title',
      content_type: PostType.Collection,
      source_id: 'collections',
      extra: {
        origin_entries: [
          '3d5da6ec-b960-4ad8-8278-665a66b71c1f',
          '5a829977-189a-4ac9-85cc-9e822cc7c737',
        ],
      },
    });

    const collection = await con.getRepository(Post).findOneBy({
      yggdrasilId: '7ec0bccb-e41f-4c77-a3b4-fe19d20b3874',
    });

    expect(collection).not.toBeNull();

    const postRelations = await con.getRepository(PostRelation).findBy({
      postId: collection!.id,
    });
    expect(postRelations.length).toEqual(2);
    expect(postRelations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          relatedPostId: 'cp1',
          postId: collection!.id,
          type: PostRelationType.Collection,
        }),
        expect.objectContaining({
          relatedPostId: 'cp2',
          postId: collection!.id,
          type: PostRelationType.Collection,
        }),
      ]),
    );
  });

  it('should update post relations to existing collection', async () => {
    await con.getRepository(ArticlePost).save([
      {
        id: 'cp1',
        shortId: 'cp1',
        url: 'http://cp1.com',
        score: 0,
        metadataChangedAt: new Date('01-05-2020 12:00:00'),
        sourceId: 'a',
        visible: true,
        createdAt: new Date('01-05-2020 12:00:00'),
        origin: PostOrigin.Crawler,
        yggdrasilId: '3d5da6ec-b960-4ad8-8278-665a66b71c1f',
      },
      {
        id: 'cp2',
        shortId: 'cp2',
        url: 'http://cp2.com',
        score: 0,
        metadataChangedAt: new Date('01-05-2020 12:00:00'),
        sourceId: 'a',
        visible: true,
        createdAt: new Date('01-05-2020 12:00:00'),
        origin: PostOrigin.Crawler,
        yggdrasilId: '5a829977-189a-4ac9-85cc-9e822cc7c737',
      },
    ]);

    await expectSuccessfulBackground(worker, {
      id: '7ec0bccb-e41f-4c77-a3b4-fe19d20b3874',
      post_id: undefined,
      title: 'New title',
      content_type: PostType.Collection,
      source_id: 'collections',
      extra: {
        origin_entries: ['3d5da6ec-b960-4ad8-8278-665a66b71c1f'],
      },
    });

    const collection = await con.getRepository(Post).findOneBy({
      yggdrasilId: '7ec0bccb-e41f-4c77-a3b4-fe19d20b3874',
    });

    expect(collection).not.toBeNull();

    const postRelations = await con.getRepository(PostRelation).findBy({
      postId: collection!.id,
    });
    expect(postRelations.length).toEqual(1);
    expect(postRelations).toMatchObject([
      {
        relatedPostId: 'cp1',
        postId: collection!.id,
        type: PostRelationType.Collection,
      },
    ]);

    await expectSuccessfulBackground(worker, {
      id: '7ec0bccb-e41f-4c77-a3b4-fe19d20b3874',
      post_id: collection!.id,
      title: 'New title',
      content_type: PostType.Collection,
      source_id: 'collections',
      extra: {
        origin_entries: [
          '3d5da6ec-b960-4ad8-8278-665a66b71c1f',
          '5a829977-189a-4ac9-85cc-9e822cc7c737',
        ],
      },
    });

    const postRelationsAfterUpdate = await con
      .getRepository(PostRelation)
      .findBy({
        postId: collection!.id,
      });
    expect(postRelationsAfterUpdate.length).toEqual(2);
    expect(postRelationsAfterUpdate).toMatchObject([
      {
        relatedPostId: 'cp1',
        postId: collection!.id,
        type: PostRelationType.Collection,
      },
      {
        relatedPostId: 'cp2',
        postId: collection!.id,
        type: PostRelationType.Collection,
      },
    ]);
  });

  it('should ignore non existant posts', async () => {
    await con.getRepository(ArticlePost).save([
      {
        id: 'cp1',
        shortId: 'cp1',
        url: 'http://cp1.com',
        score: 0,
        metadataChangedAt: new Date('01-05-2020 12:00:00'),
        sourceId: 'a',
        visible: true,
        createdAt: new Date('01-05-2020 12:00:00'),
        origin: PostOrigin.Crawler,
        yggdrasilId: '3d5da6ec-b960-4ad8-8278-665a66b71c1f',
      },
    ]);

    await expectSuccessfulBackground(worker, {
      id: '7ec0bccb-e41f-4c77-a3b4-fe19d20b3874',
      post_id: undefined,
      title: 'New title',
      content_type: PostType.Collection,
      source_id: 'collections',
      extra: {
        origin_entries: [
          '3d5da6ec-b960-4ad8-8278-665a66b71c1f',
          '5a829977-189a-4ac9-85cc-9e822cc7c737',
        ],
      },
    });

    const collection = await con.getRepository(Post).findOneBy({
      yggdrasilId: '7ec0bccb-e41f-4c77-a3b4-fe19d20b3874',
    });

    expect(collection).not.toBeNull();

    const postRelations = await con.getRepository(PostRelation).findBy({
      postId: collection!.id,
    });
    expect(postRelations.length).toEqual(1);
    expect(postRelations).toMatchObject([
      {
        relatedPostId: 'cp1',
        postId: collection!.id,
        type: PostRelationType.Collection,
      },
    ]);
  });

  it('should relate new post to collection', async () => {
    await expectSuccessfulBackground(worker, {
      id: '7ec0bccb-e41f-4c77-a3b4-fe19d20b3874',
      post_id: undefined,
      title: 'New title',
      content_type: PostType.Collection,
      source_id: 'collections',
      extra: {
        origin_entries: [
          '3d5da6ec-b960-4ad8-8278-665a66b71c1f',
          '5a829977-189a-4ac9-85cc-9e822cc7c737',
        ],
      },
    });

    const collection = await con.getRepository(Post).findOneBy({
      yggdrasilId: '7ec0bccb-e41f-4c77-a3b4-fe19d20b3874',
    });

    expect(collection).not.toBeNull();
    expect(await collection!.relatedPosts).toHaveLength(0);

    await expectSuccessfulBackground(worker, {
      id: '3d5da6ec-b960-4ad8-8278-665a66b71c1f',
      post_id: undefined,
      title: 'New title',
      content_type: PostType.Article,
      source_id: 'a',
      collections: ['7ec0bccb-e41f-4c77-a3b4-fe19d20b3874'],
    });

    const postRelations = await con.getRepository(PostRelation).findBy({
      postId: collection!.id,
    });

    expect(postRelations.length).toEqual(1);
    expect(postRelations).toMatchObject([
      {
        postId: collection!.id,
        type: PostRelationType.Collection,
      },
    ]);
  });

  it('should relate existing post to collection', async () => {
    await expectSuccessfulBackground(worker, {
      id: '7ec0bccb-e41f-4c77-a3b4-fe19d20b3874',
      post_id: undefined,
      title: 'New title',
      content_type: PostType.Collection,
      source_id: 'collections',
    });

    await con.getRepository(ArticlePost).save([
      {
        id: 'cp1',
        shortId: 'cp1',
        url: 'http://cp1.com',
        score: 0,
        metadataChangedAt: new Date('01-05-2020 12:00:00'),
        sourceId: 'a',
        visible: true,
        createdAt: new Date('01-05-2020 12:00:00'),
        origin: PostOrigin.Crawler,
        yggdrasilId: '3d5da6ec-b960-4ad8-8278-665a66b71c1f',
      },
    ]);

    const collection = await con.getRepository(Post).findOneBy({
      yggdrasilId: '7ec0bccb-e41f-4c77-a3b4-fe19d20b3874',
    });
    const post = await con.getRepository(ArticlePost).findOneBy({
      id: 'cp1',
    });

    expect(collection).not.toBeNull();
    expect(post).not.toBeNull();
    expect(await collection!.relatedPosts).toHaveLength(0);

    await expectSuccessfulBackground(worker, {
      id: '3d5da6ec-b960-4ad8-8278-665a66b71c1f',
      post_id: 'cp1',
      title: 'New title',
      content_type: PostType.Article,
      source_id: 'a',
      collections: ['7ec0bccb-e41f-4c77-a3b4-fe19d20b3874'],
    });

    const postRelations = await con.getRepository(PostRelation).findBy({
      postId: collection!.id,
    });

    expect(postRelations.length).toEqual(1);
    expect(postRelations).toMatchObject([
      {
        relatedPostId: 'cp1',
        postId: collection!.id,
        type: PostRelationType.Collection,
      },
    ]);
  });
});
