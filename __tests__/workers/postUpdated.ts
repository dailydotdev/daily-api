import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/postUpdated';
import {
  ArticlePost,
  COMMUNITY_PICKS_SOURCE,
  CollectionPost,
  FreeformPost,
  Keyword,
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
  expect(post.tagsStr).toEqual('abc,ab,a1-b2,a_1.net,#c,a-b,__');
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
  expect(posts.length).toEqual(3);
  expect(posts[2]).toMatchSnapshot({
    visible: true,
    visibleAt: expect.any(Date),
    createdAt: expect.any(Date),
    metadataChangedAt: expect.any(Date),
    score: expect.any(Number),
    id: expect.any(String),
    shortId: expect.any(String),
    contentCuration: expect.any(Array),
    sourceId: 'a',
    title: 'Title',
    showOnFeed: true,
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
  expect(posts.length).toEqual(3);
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
  expect(posts.length).toEqual(3);
  expect(posts[2].showOnFeed).toEqual(false);
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
  expect(posts.length).toEqual(3);
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
  expect(posts.length).toEqual(3);
  expect(posts[2].private).toEqual(false);
  expect(posts[2].flags.private).toEqual(false);
});

it('save a post as private if source is private', async () => {
  await expectSuccessfulBackground(worker, {
    id: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
    title: 'Title',
    url: 'https://post.com',
    source_id: 'p',
  });
  const posts = await con.getRepository(Post).find();
  expect(posts.length).toEqual(3);
  expect(posts[2].private).toBe(true);
  expect(posts[2].flags.private).toBe(true);
});

it('should save a new post with the relevant scout id and update submission', async () => {
  const uuid = randomUUID();
  await saveFixtures(con, Source, [
    {
      id: COMMUNITY_PICKS_SOURCE,
      name: 'Community recommendations',
      image: 'sample.image.com',
    },
  ]);
  await createDefaultUser();
  await createDefaultSubmission(uuid);
  await expectSuccessfulBackground(worker, {
    id: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
    title: 'Title',
    url: 'https://post.com',
    source_id: COMMUNITY_PICKS_SOURCE,
    submission_id: uuid,
  });

  const post = await con
    .getRepository(ArticlePost)
    .findOneBy({ url: 'https://post.com' });
  expect(post.scoutId).toEqual('1');
  const submissions = await con.getRepository(Submission).find();
  const [submission] = submissions;
  expect(submissions.length).toEqual(1);
  expect(submission.id).toEqual(uuid);
  expect(submission.status).toEqual(SubmissionStatus.Accepted);
});

it('should save a new post with the relevant keywords', async () => {
  const uuid = randomUUID();
  await saveFixtures(con, Source, [
    {
      id: COMMUNITY_PICKS_SOURCE,
      name: 'Community recommendations',
      image: 'sample.image.com',
    },
  ]);
  await createDefaultUser();
  await createDefaultSubmission(uuid);
  await createDefaultKeywords();
  await expectSuccessfulBackground(worker, {
    id: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
    title: 'Title',
    url: `https://post.com/${uuid}`,
    source_id: COMMUNITY_PICKS_SOURCE,
    submission_id: uuid,
    extra: {
      keywords: ['alpine', 'a-b-testing', 'mongodb'],
    },
  });
  const posts = await con.getRepository(Post).find();
  expect(posts.length).toEqual(3);
  expect(posts[2].scoutId).toEqual('1');
  expect(posts[2].tagsStr).toEqual('mongodb,alpinejs,ab-testing');
  const keywords = await con.getRepository(Keyword).find({
    where: {
      value: 'alpine',
    },
  });
  // since I am adding a post which has `alpine`
  // as a tag, occurences of `alpine` in the db
  // should increase from 1 to 2
  expect(keywords[0].occurrences).toEqual(2);
});

it('should not accept post with same author and scout', async () => {
  const uuid = randomUUID();
  await createDefaultUser();
  await createDefaultSubmission(uuid);
  await expectSuccessfulBackground(worker, {
    id: 'f99a445f-e2fb-48e8-959c-e02a17f5e816',
    title: 'Title',
    url: 'https://post.com',
    source_id: 'a',
    submission_id: uuid,
    extra: {
      creator_twitter: 'leeTwitter',
    },
  });
  const submissions = await con.getRepository(Submission).find();
  const [submission] = submissions;
  expect(submissions.length).toEqual(1);
  expect(submission.id).toEqual(uuid);
  expect(submission.status).toEqual(SubmissionStatus.Rejected);
  expect(submission.reason).toEqual('SCOUT_IS_AUTHOR');
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
    await con.getRepository(Source).save({
      id: UNKNOWN_SOURCE,
      name: 'Unknown',
      handle: UNKNOWN_SOURCE,
    });
  });

  it('should create a new collection post', async () => {
    await expectSuccessfulBackground(worker, {
      id: '7ec0bccb-e41f-4c77-a3b4-fe19d20b3874',
      post_id: undefined,
      title: 'New title',
      image: 'http://image.com',
      readTime: 10,
      content_type: PostType.Collection,
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
      sourceId: 'unknown',
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
    expect(postRelations).toMatchObject([
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
