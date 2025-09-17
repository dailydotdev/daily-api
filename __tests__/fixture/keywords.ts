import { DeepPartial } from 'typeorm';
import { Keyword, KeywordStatus } from '../../src/entity';
import { postsFixture } from './post';

export const keywordsFixture: DeepPartial<Keyword>[] = [
  {
    value: 'webdev',
    occurrences: 100,
    status: KeywordStatus.Allow,
    flags: {
      title: 'Web Development',
      roadmap: 'frontend',
      onboarding: true,
      description:
        "Explore the world of web development with resources covering HTML, CSS, JavaScript, and web frameworks. This category offers tutorials, tips, and best practices for building responsive and interactive web applications. Whether you're a frontend developer, backend engineer, or full-stack developer, you'll find  content to help you stay updated with the latest web development technologies and techniques.",
    },
  },
  { value: 'development', occurrences: 200, status: KeywordStatus.Allow },
  { value: 'fullstack', occurrences: 300, status: KeywordStatus.Allow },
  { value: 'rust', occurrences: 5, status: KeywordStatus.Allow },
  { value: 'golang', occurrences: 10, status: KeywordStatus.Allow },
  {
    value: 'web-development',
    occurrences: 100,
    status: KeywordStatus.Synonym,
    synonym: 'webdev',
  },
  { value: 'politics', occurrences: 100, status: KeywordStatus.Deny },
  { value: 'pending' },
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
          status: KeywordStatus.Allow,
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
