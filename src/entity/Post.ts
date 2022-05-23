import {
  Column,
  Connection,
  Entity,
  EntityManager,
  In,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
} from 'typeorm';
import shortid from 'shortid';
import * as he from 'he';
import { PostTag } from './PostTag';
import { Source } from './Source';
import { User } from './User';
import { PostKeyword } from './PostKeyword';
import { Keyword } from './Keyword';
import { uniqueifyArray } from '../common';
import { validateAndApproveSubmission } from './Submission';

export type TocItem = { text: string; id?: string; children?: TocItem[] };
export type Toc = TocItem[];

@Entity()
export class Post {
  @PrimaryColumn({ type: 'text' })
  id: string;

  @Column({ length: 14 })
  @Index('IDX_post_shortid', { unique: true })
  shortId: string;

  @Column({ nullable: true })
  publishedAt?: Date;

  @Column({ default: () => 'now()' })
  @Index('IDX_post_createdAt', { synchronize: false })
  createdAt: Date;

  @Column({ default: () => 'now()' })
  @Index('IDX_post_metadataChangedAt')
  metadataChangedAt: Date;

  @Column({ type: 'text' })
  @Index()
  sourceId: string;

  @ManyToOne(() => Source, (source) => source.posts, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  source: Promise<Source>;

  @Column({ type: 'text' })
  @Index({ unique: true })
  url: string;

  @Column({ type: 'text', nullable: true })
  @Index({ unique: true })
  canonicalUrl?: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text', nullable: true })
  image?: string;

  @Column({ type: 'float', nullable: true })
  ratio?: number;

  @Column({ type: 'text', nullable: true })
  placeholder?: string;

  @Column({ default: false })
  tweeted: boolean;

  @Column({ default: 0 })
  @Index('IDX_post_views')
  views: number;

  @Column({ type: 'integer', default: 0 })
  @Index('IDX_post_score', { synchronize: false })
  score: number;

  @Column({ type: 'text', nullable: true })
  siteTwitter?: string;

  @Column({ type: 'text', nullable: true })
  creatorTwitter?: string;

  @Column({ nullable: true })
  readTime?: number;

  @OneToMany(() => PostTag, (tag) => tag.post, { lazy: true })
  tags: Promise<PostTag[]>;

  @OneToMany(() => PostKeyword, (keyword) => keyword.post, { lazy: true })
  keywords: Promise<PostKeyword[]>;

  @Column({ type: 'text', nullable: true })
  @Index('IDX_tags')
  tagsStr: string;

  @Column({ type: 'integer', default: 0 })
  @Index('IDX_post_upvotes')
  upvotes: number;

  @Column({ type: 'integer', default: 0 })
  @Index('IDX_post_comments')
  comments: number;

  @Column({ length: 36, nullable: true })
  scoutId: string | null;

  @ManyToOne(() => User, {
    lazy: true,
    onDelete: 'SET NULL',
  })
  scout: Promise<User>;

  @Column({ length: 36, nullable: true })
  @Index('IDX_post_author')
  authorId: string | null;

  @ManyToOne(() => User, {
    lazy: true,
    onDelete: 'SET NULL',
  })
  author: Promise<User>;

  @Column({ default: true })
  @Index('IDX_user_sentAnalyticsReport')
  sentAnalyticsReport: boolean;

  @Column({ default: 0 })
  @Index('IDX_post_viewsThreshold')
  viewsThreshold: number;

  @Column({ nullable: true })
  @Index('IDX_post_trending')
  trending?: number;

  @Column({ nullable: true })
  @Index('IDX_post_last_trending')
  lastTrending?: Date;

  @Column({ type: 'integer', nullable: true })
  @Index('IDX_post_discussion_score')
  discussionScore?: number;

  @Column({ default: false })
  @Index('IDX_post_banned')
  banned: boolean;

  @Column({ default: false })
  @Index('IDX_post_deleted')
  deleted: boolean;

  @Column({ nullable: true, type: 'tsvector', select: false })
  @Index('IDX_post_tsv')
  tsv: unknown;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'jsonb', nullable: true })
  toc: Toc | null;

  @Column({ type: 'text', nullable: true })
  summary: string | null;
}

export interface SearchPostsResult {
  id: string;
  title: string;
  highlight?: string;
}

export type PostStats = {
  numPosts: number;
  numPostViews: number;
  numPostUpvotes: number;
};

export const getAuthorPostStats = (
  con: Connection,
  authorId: string,
): Promise<PostStats> =>
  con
    .createQueryBuilder()
    .select('count(*)', 'numPosts')
    .addSelect('sum(post.views)', 'numPostViews')
    .addSelect('sum(post.upvotes)', 'numPostUpvotes')
    .from(Post, 'post')
    .where('post.authorId = :authorId or post.scoutId = :authorId', {
      authorId,
    })
    .andWhere({ deleted: false })
    .getRawOne<PostStats>();

export interface RejectPostData {
  submissionId: string;
  reason?: string;
}

export interface AddPostData {
  id: string;
  title: string;
  url: string;
  publicationId: string;
  publishedAt?: string | Date;
  createdAt?: Date;
  image?: string;
  ratio?: number;
  placeholder?: string;
  tags?: string[];
  siteTwitter?: string;
  creatorTwitter?: string;
  readTime?: number;
  canonicalUrl?: string;
  keywords?: string[];
  description?: string;
  toc?: Toc;
  summary?: string;
  submissionId?: string;
  scoutId?: string;
}

const parseReadTime = (
  readTime: number | string | undefined,
): number | undefined => {
  if (!readTime) {
    return undefined;
  }
  if (typeof readTime == 'number') {
    return Math.floor(readTime);
  }
  return Math.floor(parseInt(readTime));
};

type Reason = 'exists' | 'author banned' | 'missing fields';
export type AddNewPostResult =
  | { status: 'ok'; postId: string }
  | { status: 'failed'; reason: Reason; error?: Error };

type RejectReason = 'missing submission id';
export type RejectPostResult =
  | { status: 'ok'; submissionId: string }
  | { status: 'failed'; reason: RejectReason; error?: Error };

const checkRequiredFields = (data: AddPostData): boolean => {
  return !!(data && data.title && data.url && data.publicationId);
};

const bannedAuthors = ['@NewGenDeveloper'];

const shouldAddNewPost = async (
  entityManager: EntityManager,
  data: AddPostData,
): Promise<Reason | null> => {
  const p = await entityManager
    .getRepository(Post)
    .createQueryBuilder()
    .select('id')
    .where(
      'url = :url or url = :canonicalUrl or "canonicalUrl" = :url or "canonicalUrl" = :canonicalUrl',
      { url: data.url, canonicalUrl: data.canonicalUrl },
    )
    .getRawOne();
  if (p) {
    return 'exists';
  }
  if (bannedAuthors.indexOf(data.creatorTwitter) > -1) {
    return 'author banned';
  }

  if (!data.title) {
    return 'missing fields';
  }
};

const fixAddPostData = (data: AddPostData): AddPostData => ({
  ...data,
  id: shortid.generate(),
  canonicalUrl: data.canonicalUrl || data.url,
  title: data.title && he.decode(data.title),
  createdAt: new Date(),
  readTime: parseReadTime(data.readTime),
  creatorTwitter:
    data.creatorTwitter === '' || data.creatorTwitter === '@'
      ? null
      : data.creatorTwitter,
  publishedAt: data.publishedAt && new Date(data.publishedAt),
});

const mergeKeywords = async (
  entityManager: EntityManager,
  keywords?: string[],
): Promise<{ mergedKeywords: string[]; allowedKeywords: string[] }> => {
  if (keywords?.length) {
    const synonymKeywords = await entityManager.getRepository(Keyword).find({
      where: {
        status: 'synonym',
        value: In(keywords),
      },
    });
    const mergedKeywords = uniqueifyArray(
      keywords
        .map((keyword) => {
          const synonym = synonymKeywords.find(
            (synonym) => synonym.value === keyword && synonym.synonym,
          );
          return synonym?.synonym ?? keyword;
        })
        .filter((keyword) => !keyword.match(/^\d+$/)),
    );
    const allowedKeywords = await entityManager.getRepository(Keyword).find({
      where: {
        status: 'allow',
        value: In(mergedKeywords),
      },
      order: { occurrences: 'DESC' },
    });
    return {
      allowedKeywords: allowedKeywords.map((keyword) => keyword.value),
      mergedKeywords,
    };
  }
  return { allowedKeywords: [], mergedKeywords: [] };
};

const findAuthor = async (
  entityManager: EntityManager,
  creatorTwitter?: string,
): Promise<string | null> => {
  if (creatorTwitter && typeof creatorTwitter === 'string') {
    const twitter = (
      creatorTwitter[0] === '@' ? creatorTwitter.substr(1) : creatorTwitter
    ).toLowerCase();
    const author = await entityManager
      .getRepository(User)
      .createQueryBuilder()
      .select('id')
      .where(
        `lower(twitter) = :twitter or (lower(username) = :twitter and username = 'addyosmani')`,
        {
          twitter,
        },
      )
      .getRawOne();
    if (author) {
      return author.id;
    }
  }
  return null;
};

const addPostAndKeywordsToDb = async (
  entityManager: EntityManager,
  data: AddPostData,
): Promise<string> => {
  const { allowedKeywords, mergedKeywords } = await mergeKeywords(
    entityManager,
    data.keywords,
  );
  const authorId = await findAuthor(entityManager, data.creatorTwitter);
  await entityManager.getRepository(Post).insert({
    id: data.id,
    shortId: data.id,
    publishedAt: data.publishedAt,
    createdAt: data.createdAt,
    sourceId: data.publicationId,
    url: data.url,
    title: data.title,
    image: data.image,
    ratio: data.ratio,
    placeholder: data.placeholder,
    score: Math.floor(data.createdAt.getTime() / (1000 * 60)),
    siteTwitter: data.siteTwitter,
    creatorTwitter: data.creatorTwitter,
    readTime: data.readTime,
    tagsStr: allowedKeywords?.join(',') || null,
    canonicalUrl: data.canonicalUrl,
    authorId,
    sentAnalyticsReport: !authorId,
    description: data.description,
    toc: data.toc,
    summary: data.summary,
    scoutId: data.scoutId,
  });
  if (data.tags?.length) {
    await entityManager.getRepository(PostTag).insert(
      data.tags.map((t) => ({
        tag: t,
        postId: data.id,
      })),
    );
  }
  if (mergedKeywords?.length) {
    await entityManager
      .createQueryBuilder()
      .insert()
      .into(Keyword)
      .values(mergedKeywords.map((keyword) => ({ value: keyword })))
      .onConflict(
        `("value") DO UPDATE SET occurrences = keyword.occurrences + 1`,
      )
      .execute();
    await entityManager.getRepository(PostKeyword).insert(
      mergedKeywords.map((keyword) => ({
        keyword,
        postId: data.id,
      })),
    );
  }
  return data.id;
};

export const addNewPost = async (
  con: Connection,
  data: AddPostData,
): Promise<AddNewPostResult> => {
  if (!checkRequiredFields(data)) {
    return { status: 'failed', reason: 'missing fields' };
  }

  const fixedData = fixAddPostData(data);

  return con.transaction(async (entityManager) => {
    const reason = await shouldAddNewPost(entityManager, fixedData);
    if (reason) {
      return { status: 'failed', reason };
    }

    const scoutId = await validateAndApproveSubmission(
      entityManager,
      fixedData?.submissionId,
    );

    const combinedData = {
      ...fixedData,
      scoutId,
    };

    try {
      const postId = await addPostAndKeywordsToDb(entityManager, combinedData);

      return { status: 'ok', postId };
    } catch (error) {
      // Unique
      if (error?.code === '23505') {
        return { status: 'failed', reason: 'exists', error };
      }
      // Null violation
      if (error?.code === '23502') {
        return { status: 'failed', reason: 'missing fields', error };
      }
      throw error;
    }
  });
};
