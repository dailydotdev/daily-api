import { DeepPartial } from 'typeorm';
import { Keyword } from '../../src/entity';
import { postsFixture } from './post';

export const keywordsFixture: DeepPartial<Keyword>[] = [
  { value: 'webdev', occurrences: 100, status: 'allow' },
  { value: 'development', occurrences: 200, status: 'allow' },
  { value: 'fullstack', occurrences: 300, status: 'allow' },
  { value: 'rust', occurrences: 5, status: 'allow' },
  { value: 'golang', occurrences: 10, status: 'allow' },
  {
    value: 'web-development',
    occurrences: 100,
    status: 'synonym',
    synonym: 'webdev',
  },
  { value: 'politics', occurrences: 100, status: 'deny' },
  { value: 'pending' },
  { value: 'javascript', occurrences: 57, status: 'allow' },
];

export const postRecommendedKeywordsFixture = postsFixture.reduce(
  (acc, item) => {
    const keywordsInPost = item.tagsStr?.split(',') || [];

    keywordsInPost.forEach((keyword) => {
      const keywordItem = acc.find((item) => item.value === keyword);

      if (!keywordItem) {
        acc.push({
          value: keyword,
          occurrences: 1,
          status: 'allow',
          createdAt: new Date(),
          updatedAt: new Date(),
          flags: {},
        });
      } else {
        keywordItem.occurrences += 1;
      }
    });

    return acc;
  },
  [] as Keyword[],
);
