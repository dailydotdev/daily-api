import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/postUpdated';
import {
  ArticlePost,
  COMMUNITY_PICKS_SOURCE,
  FreeformPost,
  Keyword,
  Post,
  PostKeyword,
  PostOrigin,
  PostQuestion,
  PostType,
  SharePost,
  Source,
  Submission,
  SubmissionStatus,
  User,
  WelcomePost,
} from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { randomUUID } from 'crypto';
import { usersFixture } from '../fixture/user';
import { SubmissionFailErrorMessage } from '../../src/errors';

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
  expect(posts[2].contentCuration).toStrictEqual(['news', 'story', 'release']);
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
});
