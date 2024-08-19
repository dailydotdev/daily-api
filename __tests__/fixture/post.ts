import { DeepPartial } from 'typeorm';
import {
  ArticlePost,
  PostKeyword,
  PostOrigin,
  PostRelation,
  PostTag,
  PostType,
  SharePost,
  YouTubePost,
} from '../../src/entity';
import { PostRelationType } from '../../src/entity/posts/PostRelation';

const now = new Date();

export const videoPostsFixture: DeepPartial<YouTubePost | SharePost>[] = [
  {
    id: 'yt1',
    shortId: 'yt1',
    title: 'youtube post',
    score: 0,
    url: 'https://youtu.be/T_AbQGe7fuU',
    videoId: 'T_AbQGe7fuU',
    metadataChangedAt: new Date('01-05-2020 12:00:00'),
    sourceId: 'a',
    visible: true,
    createdAt: new Date(now.getTime() - 3000),
    type: PostType.VideoYouTube,
    origin: PostOrigin.Crawler,
    yggdrasilId: '3cf9ba23-ff30-4578-b232-a98ea733ba0a',
  },
];

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
  {
    id: 'yt2',
    shortId: 'yt2',
    title: 'youtube post',
    score: 0,
    url: 'https://youtu.be/Oso6dYXw5lc',
    metadataChangedAt: new Date('01-05-2020 12:00:00'),
    sourceId: 'squad',
    visible: true,
    createdAt: new Date('01-05-2020 12:00:00'),
    type: PostType.Article,
    origin: PostOrigin.Squad,
    yggdrasilId: 'd1053f05-4d41-4fc7-885c-c0f7c841a7b6',
  },
];

export const vordrPostsFixture: DeepPartial<ArticlePost>[] = [
  {
    id: 'vordr1',
    shortId: 'svordr1',
    title: 'vordr1',
    url: 'http://vordr1.com',
    image: 'https://daily.dev/image.jpg',
    score: 10,
    sourceId: 'b',
    createdAt: new Date(new Date().getTime() - 4000),
    tagsStr: 'html,javascript',
    type: PostType.Article,
    contentCuration: ['c1', 'c2'],
    authorId: '2',
    flags: { vordr: true },
  },
  {
    id: 'vordr2',
    shortId: 'svordr2',
    title: 'vordr2',
    url: 'http://vordr2.com',
    image: 'https://daily.dev/image.jpg',
    score: 10,
    sourceId: 'b',
    createdAt: new Date(new Date().getTime() - 4000),
    tagsStr: 'html,javascript',
    type: PostType.Article,
    contentCuration: ['c1', 'c2'],
    authorId: '2',
    flags: { vordr: true },
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

export const postAuthorsFixture = [
  {
    id: 'author1',
    name: 'author1',
    image: 'https://daily.dev/ido.jpg',
  },
  {
    id: 'scout1',
    name: 'scout1',
    image: 'https://daily.dev/ido.jpg',
  },
  {
    id: 'author2',
    name: 'author2',
    image: 'https://daily.dev/ido.jpg',
  },
  {
    id: 'scout2',
    name: 'scout2',
    image: 'https://daily.dev/ido.jpg',
  },
  {
    id: 'author3',
    name: 'author3',
    image: 'https://daily.dev/ido.jpg',
  },
  {
    id: 'scout3',
    name: 'scout3',
    image: 'https://daily.dev/ido.jpg',
  },
  {
    id: 'author4',
    name: 'author4',
    image: 'https://daily.dev/ido.jpg',
  },
  {
    id: 'scout4',
    name: 'scout4',
    image: 'https://daily.dev/ido.jpg',
  },
  {
    id: 'author5',
    name: 'author5',
    image: 'https://daily.dev/ido.jpg',
  },
  {
    id: 'scout5',
    name: 'scout5',
    image: 'https://daily.dev/ido.jpg',
  },
  {
    id: 'author6',
    name: 'author6',
    image: 'https://daily.dev/ido.jpg',
  },
  {
    id: 'scout6',
    name: 'scout6',
    image: 'https://daily.dev/ido.jpg',
  },
  {
    id: 'author7',
    name: 'author7',
    image: 'https://daily.dev/ido.jpg',
  },
  {
    id: 'scout7',
    name: 'scout7',
    image: 'https://daily.dev/ido.jpg',
  },
];

export const contentUpdatedPost = {
  yggdrasilId: 'f30cdfd4-80cd-4955-bed1-0442dc5511bf',
  id: 'p4',
  slug: 'post-for-testing-p4',
  shortId: 'sp4',
  type: PostType.Article,
  title: 'Post for testing',
  createdAt: Date.now() - 1000,
  metadataChangedAt: Date.now(),
  sourceId: 'a',
  tagsStr: 'javascript,webdev,react',
  banned: false,
  private: false,
  visible: true,
  deleted: false,
  showOnFeed: true,
  visibleAt: Date.now(),
  origin: PostOrigin.Crawler,
  image: 'https://daily.dev/image.jpg',
  description: 'Post for testing',
  readTime: 5,
  summary: 'Post for testing',
  language: 'en',
  contentMeta: {},
  contentCuration: ['c1', 'c2'],
  contentQuality: {
    is_ai_probability: 0.9,
  },
  upvotes: 15,
  downvotes: 1,
  comments: 3,
  score: 10,
  flags: {},
  views: 100,
  authorId: '1',
  scoutId: null,
  sentAnalyticsReport: false,
  viewsThreshold: 0,
  tsv: null,
  statsUpdatedAt: 0,
  i18n: {},
};
