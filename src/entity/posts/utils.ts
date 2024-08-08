import { DataSource, EntityManager, In } from 'typeorm';
import { TypeOrmError } from '../../errors';
import { Keyword } from '../Keyword';
import {
  notifyContentRequested,
  removeEmptyValues,
  removeSpecialCharacters,
  uniqueifyArray,
  updateFlagsStatement,
} from '../../common';
import { User } from '../user';
import { PostKeyword } from '../PostKeyword';
import { ArticlePost } from './ArticlePost';
import { Post, PostOrigin } from './Post';
import { MAX_COMMENTARY_LENGTH, SharePost } from './SharePost';
import { ForbiddenError, ValidationError } from 'apollo-server-errors';
import { Source, UNKNOWN_SOURCE } from '../Source';
import { generateShortId } from '../../ids';
import { parse } from 'node-html-parser';
import { ContentImage, ContentImageUsedByType } from '../ContentImage';
import { getMentions, MentionedUser } from '../../schema/comments';
import { markdown, renderMentions, saveMentions } from '../../common/markdown';
import { PostMention } from './PostMention';
import { PostQuestion } from './PostQuestion';
import { PostRelation, PostRelationType } from './PostRelation';
import { CollectionPost } from './CollectionPost';
import { checkWithVordr } from '../../common/vordr';
import { AuthContext } from '../../Context';

export type PostStats = {
  numPosts: number;
  numPostViews: number;
  numPostUpvotes: number;
  numPostComments: number;
};

type StringPostStats = {
  [Property in keyof PostStats]: string;
};

interface DeletePostProps {
  con: DataSource | EntityManager;
  id: string;
  userId?: string;
}

export const deletePost = async ({ con, id, userId }: DeletePostProps) =>
  con.getRepository(Post).update(
    { id },
    {
      deleted: true,
      flags: updateFlagsStatement<Post>({
        deleted: true,
        deletedBy: userId,
      }),
    },
  );

export const getAuthorPostStats = async (
  con: DataSource,
  authorId: string,
): Promise<PostStats> => {
  const raw = await con
    .createQueryBuilder()
    .select('count(*)', 'numPosts')
    .addSelect('sum(post.views)', 'numPostViews')
    .addSelect('sum(post.upvotes)', 'numPostUpvotes')
    .addSelect('sum(post.comments)', 'numPostComments')
    .from(Post, 'post')
    .where('(post.authorId = :authorId or post.scoutId = :authorId)', {
      authorId,
    })
    .andWhere('post.visible = true')
    .andWhere('post.deleted = false')
    .getRawOne<StringPostStats>();
  return Object.keys(raw).reduce(
    (acc, key) => ({ ...acc, [key]: parseInt(raw[key]) || raw[key] }),
    {},
  ) as PostStats;
};

export const parseReadTime = (
  readTime: number | string | undefined,
): number | undefined => {
  if (!readTime) {
    return undefined;
  }
  if (typeof readTime == 'number') {
    return Math.floor(readTime) || 1;
  }
  return Math.floor(parseInt(readTime)) || 1;
};

export const bannedAuthors = ['@NewGenDeveloper'];

export const mergeKeywords = async (
  entityManager: EntityManager,
  keywords?: string[],
): Promise<{ mergedKeywords: string[]; allowedKeywords: string[] }> => {
  if (keywords?.length) {
    const cleanedKeywords = uniqueifyArray(
      removeEmptyValues(
        keywords.map((keyword) => removeSpecialCharacters(keyword)),
      ),
    );
    const synonymKeywords = await entityManager.getRepository(Keyword).find({
      where: {
        status: 'synonym',
        value: In(cleanedKeywords),
      },
    });
    const additionalKeywords = synonymKeywords.map(
      (synonym) => synonym.synonym,
    );
    const mergedKeywords = uniqueifyArray(
      [...cleanedKeywords, ...additionalKeywords].filter(
        (keyword) => !keyword.match(/^\d+$/),
      ),
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

export const findAuthor = async (
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

export const removeKeywords = async (
  entityManager: EntityManager,
  mergedKeywords: string[],
  postId: string,
) => {
  if (mergedKeywords.length) {
    await entityManager.getRepository(PostKeyword).delete({ postId });
  }
  return;
};

export const addKeywords = async (
  entityManager: EntityManager,
  mergedKeywords: string[],
  postId: string,
): Promise<void> => {
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
        postId,
      })),
    );
  }
  return;
};

export const addQuestions = async (
  entityManager: EntityManager,
  questions: string[],
  postId: Post['id'],
  existingPost: boolean = false,
) => {
  let existingQuestion: PostQuestion | undefined;

  if (existingPost) {
    existingQuestion = await entityManager
      .getRepository(PostQuestion)
      .findOneBy({ postId });
  }

  // for now, we only add questions if there aren't any existing ones
  // this means that questions don't change on a post once initially created
  if (existingQuestion) return;

  await entityManager.getRepository(PostQuestion).insert(
    questions.map((question) => ({
      question,
      postId,
    })),
  );
};

const validateCommentary = async (commentary?: string) => {
  const strippedCommentary = commentary?.trim() || null;

  if ((strippedCommentary?.length ?? 0) > MAX_COMMENTARY_LENGTH) {
    throw new ValidationError(
      JSON.stringify({
        commentary: `max size is ${MAX_COMMENTARY_LENGTH} chars`,
      }),
    );
  }

  return strippedCommentary;
};

export interface ExternalLinkPreview {
  id?: string;
  title: string;
  image: string;
}

export interface ExternalLink extends Partial<ExternalLinkPreview> {
  url: string;
}

export const createExternalLink = async (
  con: DataSource | EntityManager,
  ctx: AuthContext,
  sourceId: string,
  { url, title, image }: ExternalLink,
  commentary: string,
): Promise<void> => {
  await validateCommentary(commentary);
  const id = await generateShortId();
  const isVisible = !!title;

  return con.transaction(async (entityManager) => {
    await entityManager.getRepository(ArticlePost).insert({
      id,
      shortId: id,
      createdAt: new Date(),
      sourceId: UNKNOWN_SOURCE,
      url,
      canonicalUrl: url,
      title,
      image,
      sentAnalyticsReport: true,
      private: true,
      origin: PostOrigin.Squad,
      visible: isVisible,
      flags: {
        sentAnalyticsReport: true,
        private: true,
        visible: isVisible,
      },
    });
    await createSharePost(
      entityManager,
      ctx,
      sourceId,
      id,
      commentary,
      isVisible,
    );
    await notifyContentRequested(ctx.log, {
      id,
      url,
      origin: PostOrigin.Squad,
    });
    return;
  });
};

export const generateTitleHtml = (
  title: string,
  mentions: MentionedUser[],
): string =>
  `<p>${renderMentions(markdown.utils.escapeHtml(title), mentions)}</p>`;

export const createSharePost = async (
  con: DataSource | EntityManager,
  ctx: AuthContext,
  sourceId: string,
  postId: string,
  commentary: string | null,
  visible = true,
): Promise<SharePost> => {
  const strippedCommentary = await validateCommentary(commentary);
  const userId = ctx.userId;

  try {
    const mentions = await getMentions(con, commentary, userId, sourceId);
    const titleHtml = commentary?.length
      ? generateTitleHtml(commentary, mentions)
      : null;
    const { private: privacy } = await con
      .getRepository(Source)
      .findOneBy({ id: sourceId });

    const id = await generateShortId();

    const createdPost = con.getRepository(SharePost).create({
      id,
      shortId: id,
      createdAt: new Date(),
      sourceId,
      authorId: userId,
      sharedPostId: postId,
      title: strippedCommentary,
      titleHtml,
      sentAnalyticsReport: true,
      private: privacy,
      origin: PostOrigin.UserGenerated,
      visible,
      visibleAt: visible ? new Date() : null,
      flags: {
        sentAnalyticsReport: true,
        private: privacy,
        visible,
      },
    });

    const vordrStatus = await checkWithVordr(
      { post: createdPost },
      { con, userId, req: ctx.req },
    );

    if (vordrStatus === true) {
      createdPost.banned = true;
      createdPost.showOnFeed = false;
    }

    createdPost.flags.vordr = vordrStatus;

    const post = await con.getRepository(SharePost).save(createdPost);

    if (mentions.length) {
      await saveMentions(con, post.id, userId, mentions, PostMention);
    }

    return post;
  } catch (err) {
    if (err.code === TypeOrmError.FOREIGN_KEY) {
      if (err.detail.indexOf('sharedPostId') > -1) {
        throw new ForbiddenError(
          JSON.stringify({ postId: 'post does not exist' }),
        );
      }
    }
    throw err;
  }
};

export const updateSharePost = async (
  con: DataSource | EntityManager,
  userId: string,
  postId: string,
  sourceId: string,
  commentary: string | null,
) => {
  const strippedCommentary = await validateCommentary(commentary);

  try {
    const mentions = await getMentions(con, commentary, userId, sourceId);
    const titleHtml = commentary?.length
      ? generateTitleHtml(commentary, mentions)
      : null;

    await con
      .getRepository(SharePost)
      .update({ id: postId }, { title: strippedCommentary, titleHtml });

    if (mentions.length) {
      await saveMentions(con, postId, userId, mentions, PostMention);
    }

    return { postId };
  } catch (err) {
    if (err.code === TypeOrmError.FOREIGN_KEY) {
      if (err.detail.indexOf('sharedPostId') > -1) {
        throw new ForbiddenError(
          JSON.stringify({ postId: 'post does not exist' }),
        );
      }
    }
    throw err;
  }
};

export const updateUsedImagesInContent = async (
  con: DataSource | EntityManager,
  type: ContentImageUsedByType,
  id: string,
  contentHtml: string,
): Promise<void> => {
  const root = parse(contentHtml);
  const images = root.querySelectorAll('img');
  const urls = images.map((img) => img.getAttribute('src'));
  await con.getRepository(ContentImage).update(
    { url: In(urls) },
    {
      usedByType: type,
      usedById: id,
    },
  );
};

export const addRelatedPosts = async ({
  entityManager,
  postId,
  yggdrasilIds,
  relationType,
}: {
  entityManager: EntityManager;
  postId: Post['id'];
  yggdrasilIds: string[];
  relationType: PostRelationType;
}): Promise<Post[]> => {
  if (!yggdrasilIds.length) {
    return [];
  }

  const posts = await entityManager.getRepository(Post).findBy({
    yggdrasilId: In(yggdrasilIds),
  });

  await entityManager
    .getRepository(PostRelation)
    .createQueryBuilder()
    .insert()
    .values(
      posts.map((post) => ({
        postId,
        relatedPostId: post.id,
        relationType,
      })),
    )
    .orIgnore()
    .execute();

  return posts;
};

export const relatePosts = async ({
  entityManager,
  postId,
  yggdrasilIds,
  relationType,
}: {
  entityManager: EntityManager;
  postId: Post['id'];
  yggdrasilIds: string[];
  relationType: PostRelationType;
}): Promise<Post[]> => {
  if (!yggdrasilIds.length) {
    return [];
  }

  const posts = await entityManager.getRepository(Post).findBy({
    yggdrasilId: In(yggdrasilIds),
  });

  await entityManager
    .getRepository(PostRelation)
    .createQueryBuilder()
    .insert()
    .values(
      posts.map((post) => ({
        postId: post.id,
        relatedPostId: postId,
        relationType,
      })),
    )
    .orIgnore()
    .execute();

  return posts;
};

export const getAllSourcesBaseQuery = ({
  con,
  postId,
  relationType,
}: {
  con: DataSource | EntityManager;
  postId: CollectionPost['id'];
  relationType: PostRelationType;
}) =>
  con
    .createQueryBuilder()
    .from(PostRelation, 'pr')
    .leftJoin(Post, 'p', 'p.id = pr."relatedPostId"')
    .leftJoin(Source, 's', 's.id = p."sourceId"')
    .where('pr."postId" = :postId', { postId })
    .andWhere('pr."type" = :type', { type: relationType })
    .orderBy('pr."createdAt"', 'DESC')
    .clone();

export const normalizeCollectionPostSources = async ({
  con,
  postId,
}: {
  con: DataSource | EntityManager;
  postId: CollectionPost['id'];
}) => {
  const sources = await getAllSourcesBaseQuery({
    con,
    postId,
    relationType: PostRelationType.Collection,
  })
    .select('s.id as id')
    .getRawMany<Pick<Source, 'id'>>();

  await con.getRepository(CollectionPost).save({
    id: postId,
    collectionSources: sources.map((item) => item.id),
  });
};

export const getPostVisible = ({ post }: { post: Pick<Post, 'title'> }) => {
  return !!post?.title?.length;
};
