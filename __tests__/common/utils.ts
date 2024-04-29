import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { ArticlePost, Post, PostTag, Source } from '../../src/entity';
import {
  parseDate,
  removeEmptyValues,
  removeSpecialCharacters,
  uniqueifyArray,
  updateFlagsStatement,
} from '../../src/common';
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

describe('removeSpecialCharacters', () => {
  it('should remove all occurrences of special characters from a string', () => {
    const actual = removeSpecialCharacters(
      `'?a.!@#-$%^&*()_"+b1ツ'?a.!@#-$%^&*()_"+b1ツ`,
    );
    expect(actual).toEqual('a.#-_b1a.#-_b1');
  });
});

describe('uniqueifyArray', () => {
  it('should remove duplicates from a array of strings', () => {
    const actual = uniqueifyArray(['a', 'b', 'a', 'c']);
    expect(actual).toEqual(['a', 'b', 'c']);
  });
});

describe('removeEmptyValues', () => {
  it('should remove empty values from a array of strings', () => {
    const actual = removeEmptyValues(['a', 'b', '', 'c', '']);
    expect(actual).toEqual(['a', 'b', 'c']);
  });
});

describe('parseDate', () => {
  it('should return undefined for falsy values', () => {
    expect(parseDate(undefined as unknown as Date)).toBeUndefined();
    expect(parseDate(null as unknown as Date)).toBeUndefined();
    expect(parseDate('')).toBeUndefined();
  });

  it('should return undefined for invalid Date string', () => {
    expect(parseDate('55-22 Date')).toBeUndefined();
  });

  it('should return undefined for Date before UNIX time', () => {
    expect(parseDate('0001-01-01T00:00:00Z')).toBeUndefined();
  });

  it('should return undefined for invalid Date', () => {
    expect(parseDate(new Date('55-22 Date'))).toBeUndefined();
  });

  it('should return Date for valid Date string', () => {
    expect(parseDate('2020-01-01T00:00:00Z')).toEqual(
      new Date('2020-01-01T00:00:00Z'),
    );
  });

  it('should return Date for valid Date', () => {
    expect(parseDate(new Date('2020-01-01T00:00:00Z'))).toEqual(
      new Date('2020-01-01T00:00:00Z'),
    );
  });
});
