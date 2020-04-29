import { DeepPartial } from 'typeorm';
import { Post } from '../../src/entity';

export const postsFixture: DeepPartial<Post>[] = [
  {
    id: 'p1',
    title: 'P1',
    url: 'http://p1.com',
    timeDecay: 0,
    score: 0,
    sourceId: 'a',
  },
  {
    id: 'p2',
    title: 'P2',
    url: 'http://p2.com',
    timeDecay: 0,
    score: 0,
    sourceId: 'b',
  },
  {
    id: 'p3',
    title: 'P3',
    url: 'http://p3.com',
    timeDecay: 0,
    score: 0,
    sourceId: 'c',
  },
  {
    id: 'p4',
    title: 'P4',
    url: 'http://p4.com',
    timeDecay: 0,
    score: 0,
    sourceId: 'a',
  },
  {
    id: 'p5',
    title: 'P5',
    url: 'http://p5.com',
    timeDecay: 0,
    score: 0,
    sourceId: 'b',
  },
];
