import { DeepPartial } from 'typeorm';
import { Keyword } from '../../src/entity';

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
];
