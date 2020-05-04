import { DeepPartial } from 'typeorm';
import { TagCount } from '../../src/entity';

export const tagCountsFixture: DeepPartial<TagCount>[] = [
  { tag: 'webdev', count: 100 },
  { tag: 'development', count: 200 },
  { tag: 'fullstack', count: 300 },
  { tag: 'rust', count: 5 },
  { tag: 'golang', count: 10 },
];
