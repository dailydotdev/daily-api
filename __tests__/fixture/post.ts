import { DeepPartial } from 'typeorm';
import { Post, PostTag } from '../../src/entity';

const now = new Date();

export const postsFixture: DeepPartial<Post>[] = [
  {
    id: 'p1',
    title: 'P1',
    url: 'http://p1.com',
    score: 0,
    sourceId: 'a',
    createdAt: now,
  },
  {
    id: 'p2',
    title: 'P2',
    url: 'http://p2.com',
    score: 7,
    sourceId: 'b',
    createdAt: new Date(now.getTime() - 1000),
  },
  {
    id: 'p3',
    title: 'P3',
    url: 'http://p3.com',
    score: 4,
    sourceId: 'c',
    createdAt: new Date(now.getTime() - 2000),
  },
  {
    id: 'p4',
    title: 'P4',
    url: 'http://p4.com',
    score: 3,
    sourceId: 'a',
    createdAt: new Date(now.getTime() - 3000),
  },
  {
    id: 'p5',
    title: 'P5',
    url: 'http://p5.com',
    score: 10,
    sourceId: 'b',
    createdAt: new Date(now.getTime() - 4000),
  },
  {
    id: 'p6',
    title: 'P6',
    url: 'http://p6.com',
    score: 10,
    sourceId: 'p',
    createdAt: new Date(now.getTime() - 5000),
  },
];

export const postTagsFixture: DeepPartial<PostTag>[] = [
  {
    postId: postsFixture[0].id,
    tag: 'webdev',
  },
  {
    postId: postsFixture[0].id,
    tag: 'javascript',
  },
  {
    postId: postsFixture[3].id,
    tag: 'backend',
  },
  {
    postId: postsFixture[3].id,
    tag: 'javascript',
  },
  {
    postId: postsFixture[3].id,
    tag: 'data',
  },
  {
    postId: postsFixture[4].id,
    tag: 'html',
  },
  {
    postId: postsFixture[4].id,
    tag: 'javascript',
  },
];
