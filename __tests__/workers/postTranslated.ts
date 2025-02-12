import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { Post, PostType, SharePost, Source, User } from '../../src/entity';
import { postTranslated as worker } from '../../src/workers/postTranslated';
import { postsFixture } from '../fixture/post';
import { typedWorkers } from '../../src/workers';
import { expectSuccessfulTypedBackground, saveFixtures } from '../helpers';
import { sourcesFixture, usersFixture } from '../fixture';
import { ContentLanguage } from '../../src/types';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, Post, postsFixture);
  await saveFixtures(con, User, usersFixture);
  await saveFixtures(con, SharePost, [
    {
      id: 'sp1',
      shortId: 'ssp1',
      title: 'sp1',
      score: 1,
      sourceId: 'a',
      tagsStr: 'javascript,webdev',
      type: PostType.Share,
      sharedPostId: 'p1',
      contentCuration: ['c1', 'c2'],
      authorId: usersFixture[0].id,
    },
  ]);
});

describe('postTranslated', () => {
  it('should be registered', () => {
    const registeredWorker = typedWorkers.find(
      (item) => item.subscription === worker.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should update post translation', async () => {
    expect(
      (await con.getRepository(Post).findOneByOrFail({ id: 'p1' })).translation,
    ).toEqual({});

    await expectSuccessfulTypedBackground(worker, {
      id: 'p1',
      language: ContentLanguage.German,
      translations: {
        title: 'new title',
      },
    });

    expect(
      (await con.getRepository(Post).findOneByOrFail({ id: 'p1' })).translation,
    ).toEqual({
      de: {
        title: 'new title',
      },
    });
  });

  it('should update multiple translations', async () => {
    expect(
      (await con.getRepository(Post).findOneByOrFail({ id: 'p1' })).translation,
    ).toEqual({});

    await expectSuccessfulTypedBackground(worker, {
      id: 'p1',
      language: ContentLanguage.German,
      translations: {
        title: 'new title',
        smartTitle: `smart title's @re cool#$%`,
      },
    });

    expect(
      (await con.getRepository(Post).findOneByOrFail({ id: 'p1' })).translation,
    ).toEqual({
      de: {
        title: 'new title',
        smartTitle: `smart title's @re cool#$%`,
      },
    });
  });

  it('should handle titles with special characters', async () => {
    expect(
      (await con.getRepository(Post).findOneByOrFail({ id: 'p1' })).translation,
    ).toEqual({});

    await expectSuccessfulTypedBackground(worker, {
      id: 'p1',
      language: ContentLanguage.German,
      translations: {
        title: `new title #"!#%&/()=?'"\`\\ƒ∂∞€€é∂ßä`,
      },
    });

    expect(
      (await con.getRepository(Post).findOneByOrFail({ id: 'p1' })).translation,
    ).toEqual({
      de: {
        title: `new title #"!#%&/()=?'"\`\\ƒ∂∞€€é∂ßä`,
      },
    });
  });

  it('should not update post translation if language is invalid', async () => {
    expect(
      (await con.getRepository(Post).findOneByOrFail({ id: 'p1' })).translation,
    ).toEqual({});

    await expectSuccessfulTypedBackground(worker, {
      id: 'p1',
      language: 'invalid' as ContentLanguage,
      translations: {
        title: 'new title',
      },
    });

    expect(
      (await con.getRepository(Post).findOneByOrFail({ id: 'p1' })).translation,
    ).toEqual({});
  });

  it('should not remove existing translations', async () => {
    await con
      .getRepository(Post)
      .update(
        { id: 'p1' },
        { translation: { es: { title: 'spanish title' } } },
      );

    await expectSuccessfulTypedBackground(worker, {
      id: 'p1',
      language: ContentLanguage.German,
      translations: {
        title: 'new title',
      },
    });

    expect(
      (await con.getRepository(Post).findOneByOrFail({ id: 'p1' })).translation,
    ).toEqual({
      es: {
        title: 'spanish title',
      },
      de: {
        title: 'new title',
      },
    });
  });

  it('should update old translations', async () => {
    await con
      .getRepository(Post)
      .update({ id: 'p1' }, { translation: { de: { title: 'old title' } } });

    await expectSuccessfulTypedBackground(worker, {
      id: 'p1',
      language: ContentLanguage.German,
      translations: {
        title: 'new title',
      },
    });

    expect(
      (await con.getRepository(Post).findOneByOrFail({ id: 'p1' })).translation,
    ).toEqual({
      de: {
        title: 'new title',
      },
    });
  });

  it('should not remove other existing translations', async () => {
    await con
      .getRepository(Post)
      .update({ id: 'p1' }, { translation: { de: { title: 'old title' } } });

    await expectSuccessfulTypedBackground(worker, {
      id: 'p1',
      language: ContentLanguage.German,
      translations: {
        smartTitle: `smart title's @re cool#$%`,
      },
    });

    expect(
      (await con.getRepository(Post).findOneByOrFail({ id: 'p1' })).translation,
    ).toEqual({
      de: {
        title: 'old title',
        smartTitle: `smart title's @re cool#$%`,
      },
    });
  });

  it('should render titleHtml when post is a share post', async () => {
    const postId = 'sp1';
    expect(
      (await con.getRepository(Post).findOneByOrFail({ id: postId }))
        .translation,
    ).toEqual({});

    await expectSuccessfulTypedBackground(worker, {
      id: postId,
      language: ContentLanguage.German,
      translations: {
        title: 'new title',
      },
    });

    expect(
      (await con.getRepository(Post).findOneByOrFail({ id: postId }))
        .translation,
    ).toEqual({
      de: {
        title: 'new title',
        titleHtml: '<p>new title</p>',
      },
    });
  });

  it('should render titleHtml with mentions when post is a share post', async () => {
    const postId = 'sp1';
    expect(
      (await con.getRepository(Post).findOneByOrFail({ id: postId }))
        .translation,
    ).toEqual({});

    await expectSuccessfulTypedBackground(worker, {
      id: postId,
      language: ContentLanguage.German,
      translations: {
        title: 'new title and mention @ghost!',
      },
    });

    expect(
      (await con.getRepository(Post).findOneByOrFail({ id: postId }))
        .translation,
    ).toEqual({
      de: {
        title: 'new title and mention @ghost!',
        titleHtml:
          '<p>new title and mention <a href="http://localhost:5002/ghost" data-mention-id="404" data-mention-username="ghost">@ghost</a>!</p>',
      },
    });
  });
});
