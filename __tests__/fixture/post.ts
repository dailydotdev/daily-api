import { DeepPartial } from 'typeorm';
import { Post, PostKeyword, PostTag } from '../../src/entity';

const now = new Date();

export const postsFixture: DeepPartial<Post>[] = [
  {
    id: 'p1',
    shortId: 'sp1',
    title: 'P1',
    url: 'http://p1.com',
    canonicalUrl: 'http://p1c.com',
    score: 0,
    sourceId: 'a',
    createdAt: now,
    tagsStr: 'javascript,webdev',
  },
  {
    id: 'p2',
    shortId: 'sp2',
    title: 'P2',
    url: 'http://p2.com',
    score: 7,
    sourceId: 'b',
    createdAt: new Date(now.getTime() - 1000),
  },
  {
    id: 'p3',
    shortId: 'sp3',
    title: 'P3',
    url: 'http://p3.com',
    score: 4,
    sourceId: 'c',
    createdAt: new Date(now.getTime() - 2000),
  },
  {
    id: 'p4',
    shortId: 'sp4',
    title: 'P4',
    url: 'http://p4.com',
    score: 3,
    sourceId: 'a',
    createdAt: new Date(now.getTime() - 3000),
    tagsStr: 'backend,data,javascript',
  },
  {
    id: 'p5',
    shortId: 'sp5',
    title: 'P5',
    url: 'http://p5.com',
    score: 10,
    sourceId: 'b',
    createdAt: new Date(now.getTime() - 4000),
    tagsStr: 'html,javascript',
  },
  {
    id: 'p6',
    shortId: 'sp6',
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

export const postKeywordsFixture: DeepPartial<PostKeyword>[] = [
  {
    postId: postsFixture[0].id,
    keyword: 'webdev',
  },
  {
    postId: postsFixture[0].id,
    keyword: 'javascript',
  },
  {
    postId: postsFixture[3].id,
    keyword: 'backend',
  },
  {
    postId: postsFixture[3].id,
    keyword: 'javascript',
  },
  {
    postId: postsFixture[3].id,
    keyword: 'data',
  },
  {
    postId: postsFixture[4].id,
    keyword: 'html',
  },
  {
    postId: postsFixture[4].id,
    keyword: 'javascript',
  },
];
