import { DeepPartial } from 'typeorm';
import {
  ArticlePost,
  PostKeyword,
  PostRelation,
  PostTag,
  PostType,
  SharePost,
} from '../../src/entity';
import { PostRelationType } from '../../src/entity/posts/PostRelation';

const now = new Date();

export const postsFixture: DeepPartial<ArticlePost | SharePost>[] = [
  {
    id: 'p1',
    shortId: 'sp1',
    title: 'P1',
    url: 'http://p1.com',
    canonicalUrl: 'http://p1c.com',
    image: 'https://daily.dev/image.jpg',
    score: 1,
    sourceId: 'a',
    createdAt: now,
    tagsStr: 'javascript,webdev',
    type: PostType.Article,
    contentCuration: ['c1', 'c2'],
  },
  {
    id: 'p2',
    shortId: 'sp2',
    title: 'P2',
    url: 'http://p2.com',
    image: 'https://daily.dev/image.jpg',
    score: 7,
    sourceId: 'b',
    createdAt: new Date(now.getTime() - 1000),
    type: PostType.Article,
    contentCuration: ['c1', 'c2'],
  },
  {
    id: 'p3',
    shortId: 'sp3',
    title: 'P3',
    url: 'http://p3.com',
    image: 'https://daily.dev/image.jpg',
    score: 4,
    sourceId: 'c',
    createdAt: new Date(now.getTime() - 2000),
    type: PostType.Article,
    contentCuration: ['c1', 'c2'],
  },
  {
    id: 'p4',
    shortId: 'sp4',
    title: 'P4',
    url: 'http://p4.com',
    image: 'https://daily.dev/image.jpg',
    score: 3,
    sourceId: 'a',
    createdAt: new Date(now.getTime() - 3000),
    tagsStr: 'backend,data,javascript',
    type: PostType.Article,
    contentCuration: ['c1', 'c2'],
  },
  {
    id: 'p5',
    shortId: 'sp5',
    title: 'P5',
    url: 'http://p5.com',
    image: 'https://daily.dev/image.jpg',
    score: 10,
    sourceId: 'b',
    createdAt: new Date(now.getTime() - 4000),
    tagsStr: 'html,javascript',
    type: PostType.Article,
    contentCuration: ['c1', 'c2'],
  },
  {
    id: 'p6',
    shortId: 'sp6',
    title: 'P6',
    url: 'http://p6.com',
    image: 'https://daily.dev/image.jpg',
    score: 10,
    sourceId: 'p',
    createdAt: new Date(now.getTime() - 5000),
    type: PostType.Article,
    private: true,
    contentCuration: ['c1', 'c2'],
  },
  {
    id: 'p7',
    shortId: 'sp7',
    title: 'P7',
    url: 'http://p7.com',
    image: 'https://daily.dev/image.jpg',
    score: 10,
    sourceId: 'p',
    createdAt: new Date(now.getTime() - 5000),
    type: PostType.Article,
    visible: false,
    contentCuration: ['c1', 'c2'],
  },
];

export const sharedPostsFixture: DeepPartial<ArticlePost | SharePost>[] = [
  {
    id: 'squadP1',
    shortId: 'squadP1',
    title: 'Squad 1',
    url: 'http://squad1.com',
    image: 'http://image/sp1',
    score: 10,
    sourceId: 'squad',
    createdAt: new Date(now.getTime() - 5000),
    type: PostType.Share,
    visible: true,
    sharedPostId: 'p1',
    private: true,
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

export const relatedPostsFixture: DeepPartial<PostRelation>[] = [
  {
    postId: postsFixture[0].id,
    relatedPostId: postsFixture[1].id,
    type: PostRelationType.Collection,
  },
  {
    postId: postsFixture[0].id,
    relatedPostId: postsFixture[2].id,
    type: PostRelationType.Collection,
  },
  {
    postId: postsFixture[0].id,
    relatedPostId: postsFixture[3].id,
    type: PostRelationType.Collection,
  },
  {
    postId: postsFixture[1].id,
    relatedPostId: postsFixture[2].id,
    type: PostRelationType.Collection,
  },
  {
    postId: postsFixture[1].id,
    relatedPostId: postsFixture[3].id,
    type: PostRelationType.Collection,
  },
  {
    postId: postsFixture[2].id,
    relatedPostId: postsFixture[3].id,
    type: PostRelationType.Collection,
  },
];
