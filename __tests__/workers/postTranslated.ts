import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { Post, Source } from '../../src/entity';
import { postTranslated as worker } from '../../src/workers/postTranslated';
import { postsFixture } from '../fixture/post';
import { typedWorkers } from '../../src/workers';
import { expectSuccessfulTypedBackground, saveFixtures } from '../helpers';
import { sourcesFixture } from '../fixture';
import { ContentLanguage } from '../../src/types';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, Post, postsFixture);
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
});
