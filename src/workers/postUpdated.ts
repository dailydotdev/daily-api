import { messageToJson, Worker } from './worker';
import * as he from 'he';
import {
  addKeywords,
  addQuestions,
  addRelatedPosts,
  ArticlePost,
  bannedAuthors,
  COMMUNITY_PICKS_SOURCE,
  CollectionPost,
  findAuthor,
  FreeformPost,
  getPostVisible,
  mergeKeywords,
  parseReadTime,
  Post,
  PostContentQuality,
  PostOrigin,
  PostRelationType,
  PostType,
  preparePostForInsert,
  preparePostForUpdate,
  relatePosts,
  removeKeywords,
  SharePost,
  SocialTwitterPost,
  Source,
  SourceType,
  Submission,
  SubmissionStatus,
  Toc,
  UNKNOWN_SOURCE,
  WelcomePost,
  YouTubePost,
} from '../entity';
import {
  SubmissionFailErrorKeys,
  SubmissionFailErrorMessage,
  TypeOrmError,
  type TypeORMQueryFailedError,
} from '../errors';
import { generateShortId } from '../ids';
import { FastifyBaseLogger } from 'fastify';
import { EntityManager, QueryFailedError } from 'typeorm';
import { parseDate, updateFlagsStatement } from '../common';
import { markdown } from '../common/markdown';
import {
  isTwitterSocialType,
  mapTwitterSocialPayload,
  type TwitterReferencePost,
  upsertTwitterReferencedPost,
} from '../common/twitterSocial';
import { counters } from '../telemetry';
import { I18nRecord } from '../types';
import { insertCodeSnippetsFromUrl } from '../common/post';
import { BriefPost } from '../entity/posts/BriefPost';
import { PollPost } from '../entity/posts/PollPost';

interface Data {
  id: string;
  post_id: string;
  url: string;
  image?: string;
  title?: string;
  content_type?: string;
  reject_reason?: string;
  submission_id?: string;
  source_id?: string;
  origin?: string;
  published_at?: Date;
  updated_at?: Date;
  paid?: boolean;
  order?: number;
  collections?: string[];
  language?: string;
  alt_title?: string;
  extra?: {
    keywords?: string[];
    keywords_native?: string[];
    questions?: string[];
    summary?: string;
    description?: string;
    read_time?: number;
    canonical_url?: string;
    site_twitter?: string;
    creator_twitter?: string;
    toc?: Toc;
    content_curation?: string[];
    origin_entries?: string[];
    content?: string;
    video_id?: string;
    duration?: number;
  };
  meta?: {
    scraped_html?: string;
    cleaned_trafilatura_xml?: string;
    translate_title?: {
      translations?: I18nRecord;
    };
    stored_code_snippets?: string;
    channels?: string[];
  };
  content_quality?: PostContentQuality;
}

type HandleRejectionProps = {
  logger: FastifyBaseLogger;
  entityManager: EntityManager;
  data: Data;
};
const handleRejection = async ({
  logger,
  entityManager,
  data,
}: HandleRejectionProps) => {
  const { reject_reason, submission_id } = data;
  if (!submission_id) {
    // Check if we have a submission id, we need to notify
    logger.info({ data }, 'received rejection without submission id');
    return;
  }

  const submissionRepo = entityManager.getRepository(Submission);
  const submission = await submissionRepo.findOneBy({
    id: submission_id,
  });
  if (submission?.status === SubmissionStatus.Started) {
    await submissionRepo.save({
      ...submission,
      status: SubmissionStatus.Rejected,
      reason:
        reject_reason && reject_reason in SubmissionFailErrorMessage
          ? <SubmissionFailErrorKeys>reject_reason
          : SubmissionFailErrorKeys.GenericError,
    });
  }

  return;
};

type CreatePostProps = {
  logger: FastifyBaseLogger;
  entityManager: EntityManager;
  data: Partial<ArticlePost>;
  mergedKeywords: string[];
  questions: string[];
  smartTitle?: string;
};

const handleCollectionRelations = async ({
  entityManager,
  post,
  originalData,
}: {
  entityManager: EntityManager;
  logger: FastifyBaseLogger;
  post: Pick<CollectionPost, 'id' | 'type'>;
  originalData: Data;
}) => {
  if (post.type === PostType.Collection) {
    await addRelatedPosts({
      entityManager,
      postId: post.id,
      yggdrasilIds: originalData.extra?.origin_entries || [],
      relationType: PostRelationType.Collection,
    });
  } else if (originalData.collections) {
    await relatePosts({
      entityManager,
      postId: post.id,
      yggdrasilIds: originalData.collections || [],
      relationType: PostRelationType.Collection,
    });
  }
};

type CheckExistingPostProps = {
  entityManager: EntityManager;
  data: Partial<ArticlePost>;
  logger: FastifyBaseLogger;
  errorMsg: string;
  excludeId?: string;
};

/**
 * Function to check wheter an url/canonical url is already in use
 *
 * @param entityManager
 * @param data
 * @param logger
 * @param errorMsg
 * @param excludeId - By passing the id we only search for other posts containing these URLs
 */
const checkExistingUrl = async ({
  entityManager,
  data,
  logger,
  errorMsg,
  excludeId,
}: CheckExistingPostProps): Promise<boolean> => {
  let builder = entityManager
    .getRepository(Post)
    .createQueryBuilder()
    .select('id')
    .where(
      '(url = :url or url = :canonicalUrl or "canonicalUrl" = :url or "canonicalUrl" = :canonicalUrl)',
      { url: data.url, canonicalUrl: data.canonicalUrl },
    );
  if (excludeId) {
    builder = builder.andWhere('id != :excludeId', { excludeId });
  }
  const existingPost = await builder.getRawOne();
  if (existingPost) {
    counters?.background?.postError?.add(1, {
      reason: 'duplication_conflict',
    });
    logger.warn({ data }, errorMsg);
    return true;
  }

  return false;
};

const createPost = async ({
  logger,
  entityManager,
  data,
  mergedKeywords,
  questions,
  smartTitle,
}: CreatePostProps): Promise<Post | null> => {
  if (
    await checkExistingUrl({
      entityManager,
      data,
      logger,
      errorMsg: 'failed creating post because it exists already',
    })
  ) {
    return null;
  }

  // Apply vordr checks before creating the post
  data = await preparePostForInsert(data, {
    con: entityManager,
    userId: data.authorId || undefined,
  });

  const postId = await generateShortId();
  const postCreatedAt = new Date();
  data.id = postId;
  data.shortId = postId;
  data.createdAt = postCreatedAt;
  data.score = Math.floor(postCreatedAt.getTime() / (1000 * 60));
  data.origin = data.origin ?? PostOrigin.Crawler;
  data.visible = getPostVisible({ post: data });
  data.visibleAt = data.visible ? postCreatedAt : null;
  data.flags = {
    ...data.flags,
    visible: data.visible,
  };

  if (smartTitle) {
    data.translation = { en: { smartTitle } };
  }

  const post = await entityManager
    .getRepository(
      contentTypeFromPostType[
        data.type as keyof typeof contentTypeFromPostType
      ] ?? ArticlePost,
    )
    .create(data);
  await entityManager.save(post);

  await addKeywords(entityManager, mergedKeywords, data.id);
  await addQuestions(entityManager, questions, data.id);

  return post;
};

const allowedFieldsMapping: Partial<Record<PostType, string[]>> = {
  freeform: [
    'contentCuration',
    'description',
    'metadataChangedAt',
    'readTime',
    'summary',
    'tagsStr',
    'contentMeta',
  ],
  [PostType.SocialTwitter]: [
    'canonicalUrl',
    'content',
    'contentCuration',
    'contentHtml',
    'contentMeta',
    'contentQuality',
    'creatorTwitter',
    'description',
    'image',
    'language',
    'metadataChangedAt',
    'origin',
    'private',
    'publishedAt',
    'readTime',
    'sentAnalyticsReport',
    'sharedPostId',
    'showOnFeed',
    'siteTwitter',
    'sourceId',
    'subType',
    'summary',
    'tagsStr',
    'title',
    'translation',
    'type',
    'url',
    'videoId',
  ],
};

const contentTypeFromPostType: Record<PostType, typeof Post> = {
  [PostType.Article]: ArticlePost,
  [PostType.Freeform]: FreeformPost,
  [PostType.Share]: SharePost,
  [PostType.Welcome]: WelcomePost,
  [PostType.Collection]: CollectionPost,
  [PostType.VideoYouTube]: YouTubePost,
  [PostType.Brief]: BriefPost,
  [PostType.Poll]: PollPost,
  [PostType.SocialTwitter]: SocialTwitterPost,
};

type UpdatePostProps = {
  logger: FastifyBaseLogger;
  entityManager: EntityManager;
  data: Partial<ArticlePost>;
  id: string;
  mergedKeywords: string[];
  questions: string[];
  content_type: PostType;
  smartTitle?: string;
};
const updatePost = async ({
  logger,
  entityManager,
  data,
  id,
  mergedKeywords,
  questions,
  content_type = PostType.Article,
  smartTitle,
}: UpdatePostProps) => {
  const postType = contentTypeFromPostType[content_type];
  let databasePost = await entityManager
    .getRepository(postType)
    .findOneBy({ id });

  // Update the post type in the database so that it matches the content type
  if (!databasePost) {
    await entityManager
      .createQueryBuilder()
      .update(Post)
      .set({ type: content_type, image: data.image })
      .where('id = :id', { id })
      .execute();

    databasePost = await entityManager
      .getRepository(postType)
      .findOneBy({ id });
  }

  if (data?.origin === PostOrigin.Squad) {
    data.sourceId = UNKNOWN_SOURCE;
  }

  if (
    !databasePost ||
    databasePost.metadataChangedAt.toISOString() >=
      data.metadataChangedAt!.toISOString()
  ) {
    counters?.background?.postError?.add(1, {
      reason: 'date_conflict',
    });
    logger.info(
      { data },
      'post not updated: database entry is newer than received update',
    );
    return null;
  }

  if (
    await checkExistingUrl({
      entityManager,
      data,
      logger,
      errorMsg: 'failed updating post because URL/canonical exists already',
      excludeId: databasePost?.id,
    })
  ) {
    return null;
  }

  const title = data?.title || databasePost.title;
  data.title = title;

  const metadataChangedAt = data?.metadataChangedAt;

  // Apply vordr checks before updating the post
  data = await preparePostForUpdate(data, databasePost, {
    con: entityManager,
    userId: data.authorId || undefined,
  });
  data.metadataChangedAt = metadataChangedAt;

  data.id = databasePost.id;
  data.sourceId = data.sourceId || databasePost.sourceId;

  let updateBecameVisible = false;

  if (!databasePost.visible) {
    updateBecameVisible = getPostVisible({ post: { title } });
  }

  if (updateBecameVisible) {
    data.visible = true;
  } else {
    data.visible = databasePost.visible;
  }

  if (data.visible && !databasePost.visibleAt) {
    data.visibleAt = data.metadataChangedAt;
  }

  const jsonMetaFields: (keyof Pick<Post, 'contentMeta' | 'contentQuality'>)[] =
    ['contentMeta', 'contentQuality'];

  jsonMetaFields.forEach((metaField) => {
    if (
      Object.keys(data[metaField]!).length === 0 &&
      Object.keys(databasePost[metaField]).length > 0
    ) {
      data[metaField] = databasePost[metaField];
    }
  });

  if (
    data.contentQuality &&
    databasePost.contentQuality?.manual_clickbait_probability !== null
  ) {
    data.contentQuality.manual_clickbait_probability =
      databasePost.contentQuality.manual_clickbait_probability;
  }
  if (smartTitle) {
    data.translation = {
      ...databasePost.translation,
      en: {
        ...databasePost.translation?.en,
        smartTitle,
      },
    };
  }

  if (allowedFieldsMapping[content_type]) {
    const allowedFields = [
      'id',
      'visible',
      'visibleAt',
      'flags',
      'yggdrasilId',
      ...allowedFieldsMapping[content_type],
    ];

    Object.keys(data).forEach((key) => {
      if (allowedFields.indexOf(key) === -1) {
        delete data[key as keyof typeof data];
      }
    });
  }

  await entityManager.getRepository(postType).update(
    { id: databasePost.id },
    {
      ...data,
      flags: updateFlagsStatement<Post>({
        ...data.flags,
        visible: data.visible,
      }),
    },
  );

  if (updateBecameVisible) {
    await entityManager.getRepository(SharePost).update(
      { sharedPostId: data.id },
      {
        visible: true,
        visibleAt: data.visibleAt,
        private: data.private,
        flags: updateFlagsStatement<Post>({
          ...data.flags,
          private: data.private,
          visible: true,
        }),
      },
    );
  }

  if (databasePost.tagsStr !== data.tagsStr) {
    if (databasePost.tagsStr?.length) {
      await removeKeywords(
        entityManager,
        databasePost.tagsStr.split(','),
        data.id,
      );
    }
    await addKeywords(entityManager, mergedKeywords, data.id);
  }

  await addQuestions(entityManager, questions, data.id, true);
  return;
};

type GetSourcePrivacyProps = {
  logger: FastifyBaseLogger;
  entityManager: EntityManager;
  data: Data;
};
const getSourcePrivacy = async ({
  logger,
  entityManager,
  data,
}: GetSourcePrivacyProps): Promise<boolean | undefined> => {
  try {
    const sourceRepo = entityManager.getRepository(Source);

    const resolveById = async (id: string): Promise<Source> =>
      sourceRepo
        .createQueryBuilder('source')
        .select(['source.private'])
        .where('source.id = :id', { id })
        .getOneOrFail();

    const resolveFromPost = async (postId: string): Promise<Source> =>
      sourceRepo
        .createQueryBuilder('source')
        .select(['source.private'])
        .innerJoinAndSelect('source.posts', 'posts', 'posts.id = :id', {
          id: postId,
        })
        .getOneOrFail();

    if (!data?.source_id) {
      const source = await resolveFromPost(data?.post_id);
      return source.private;
    }

    if (data?.source_id === UNKNOWN_SOURCE && data?.post_id) {
      try {
        const source = await resolveFromPost(data.post_id);
        return source.private;
      } catch {
        const source = await resolveById(UNKNOWN_SOURCE);
        return source.private;
      }
    }

    const source = await resolveById(data.source_id);
    return source.private;
  } catch (err) {
    const sourcePostError = new Error('failed to find source for post');

    logger.error({ data, err }, sourcePostError.message);

    throw sourcePostError;
  }
};

type FixDataProps = {
  logger: FastifyBaseLogger;
  entityManager: EntityManager;
  data: Data;
};
type FixData = {
  mergedKeywords: string[];
  questions: string[];
  content_type: PostType;
  fixedData: Partial<ArticlePost> &
    Partial<CollectionPost> &
    Partial<YouTubePost> &
    Partial<SocialTwitterPost> &
    Partial<Post>;
  smartTitle?: string;
  twitterReference?: TwitterReferencePost;
};

const resolveTwitterSourceId = async ({
  entityManager,
  authorUsername,
}: {
  entityManager: EntityManager;
  authorUsername?: string;
}): Promise<string | undefined> => {
  if (!authorUsername) {
    return undefined;
  }

  const matchedSource = await entityManager
    .getRepository(Source)
    .createQueryBuilder('source')
    .select(['source.id'])
    .where('source.type = :type', { type: SourceType.Machine })
    .andWhere('LOWER(source.twitter) = :twitter', {
      twitter: authorUsername,
    })
    .getOne();

  return matchedSource?.id;
};

const resolveTwitterIngestionSourceId = ({
  sourceId,
  resolvedTwitterSourceId,
  origin,
}: {
  sourceId?: string;
  resolvedTwitterSourceId?: string;
  origin?: string;
}): string => {
  const explicitSourceId =
    sourceId && sourceId !== UNKNOWN_SOURCE ? sourceId : undefined;

  if (explicitSourceId) {
    return explicitSourceId;
  }

  if (resolvedTwitterSourceId) {
    return resolvedTwitterSourceId;
  }

  if (origin === PostOrigin.UserGenerated) {
    return COMMUNITY_PICKS_SOURCE;
  }

  return UNKNOWN_SOURCE;
};

const fixData = async ({
  logger,
  entityManager,
  data,
}: FixDataProps): Promise<FixData> => {
  const creatorTwitter =
    data?.extra?.creator_twitter === '' || data?.extra?.creator_twitter === '@'
      ? undefined
      : data?.extra?.creator_twitter;

  const twitterMapping = isTwitterSocialType(data?.content_type)
    ? mapTwitterSocialPayload({ data })
    : undefined;
  const resolvedTwitterSourceId =
    isTwitterSocialType(data?.content_type) &&
    (!data?.source_id || data?.source_id === UNKNOWN_SOURCE)
      ? await resolveTwitterSourceId({
          entityManager,
          authorUsername: twitterMapping?.authorUsername,
        })
      : undefined;
  const sourceId = isTwitterSocialType(data?.content_type)
    ? resolveTwitterIngestionSourceId({
        sourceId: data?.source_id,
        resolvedTwitterSourceId,
        origin: data?.origin,
      })
    : data?.source_id;

  const authorId = await findAuthor(entityManager, creatorTwitter || undefined);
  const privacy = await getSourcePrivacy({
    logger,
    entityManager,
    data: {
      ...data,
      source_id: sourceId,
    },
  });

  let keywords = data?.extra?.keywords;
  if (!data?.extra?.keywords && data?.content_type === PostType.VideoYouTube) {
    keywords = data?.extra?.keywords_native;
  }

  const { allowedKeywords, mergedKeywords } = await mergeKeywords(
    entityManager,
    keywords,
  );

  if (allowedKeywords.length > 5) {
    logger.info(
      {
        url: data.url,
        keywords: allowedKeywords,
      },
      'created an article with more than 5 keywords',
    );
  }

  const duration = data?.extra?.duration
    ? data?.extra?.duration / 60
    : undefined;

  const contentType =
    (isTwitterSocialType(data?.content_type)
      ? PostType.SocialTwitter
      : (data?.content_type as PostType)) || PostType.Article;

  // Try and fix generic data here
  return {
    mergedKeywords,
    questions: data?.extra?.questions || [],
    content_type: contentType,
    smartTitle: data?.alt_title,
    twitterReference: twitterMapping?.reference,
    fixedData: {
      origin: data?.origin as PostOrigin,
      authorId,
      creatorTwitter,
      url: data?.url,
      canonicalUrl: data?.extra?.canonical_url || data?.url,
      image: data?.image,
      sourceId,
      title: data?.title && he.decode(data?.title),
      readTime: parseReadTime(data?.extra?.read_time || duration),
      publishedAt: parseDate(data?.published_at),
      metadataChangedAt: parseDate(data?.updated_at) || new Date(),
      tagsStr: allowedKeywords?.join(',') || null,
      private: privacy,
      sentAnalyticsReport: privacy || !authorId,
      summary: data?.extra?.summary,
      description: data?.extra?.description,
      siteTwitter: data?.extra?.site_twitter,
      toc: data?.extra?.toc,
      contentCuration: data?.extra?.content_curation,
      showOnFeed: !data?.order,
      flags: {
        private: privacy,
        showOnFeed: !data?.order,
        sentAnalyticsReport: privacy || !authorId,
      },
      yggdrasilId: data?.id,
      type: contentType,
      content: data?.extra?.content,
      contentHtml: data?.extra?.content
        ? markdown.render(data.extra.content)
        : undefined,
      videoId: data?.extra?.video_id,
      language: data?.language,
      subType: null,
      contentMeta: data?.meta || {},
      contentQuality: data?.content_quality || {},
      ...(twitterMapping?.fields
        ? {
            ...twitterMapping.fields,
            title: twitterMapping.fields.title ?? undefined,
            content: twitterMapping.fields.content ?? undefined,
            contentHtml: twitterMapping.fields.contentHtml ?? undefined,
            image: twitterMapping.fields.image ?? undefined,
            videoId: twitterMapping.fields.videoId ?? undefined,
          }
        : {}),
    },
  };
};

const worker: Worker = {
  subscription: 'api.content-published',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    logger.info({ data }, 'content-updated received');
    try {
      // See if we received any rejections
      const { reject_reason } = data;
      await con.transaction(async (entityManager) => {
        if (reject_reason) {
          return handleRejection({ logger, data, entityManager });
        }

        const creatorTwitter = data?.extra?.creator_twitter;

        if (creatorTwitter && bannedAuthors.indexOf(creatorTwitter) > -1) {
          logger.info(
            { data, messageId: message.messageId },
            'post update failed because author is banned',
          );
          return;
        }

        let postId: string | undefined = data.post_id;

        if (!postId && data.id) {
          const matchedYggdrasilPost = await con
            .createQueryBuilder()
            .from(Post, 'p')
            .select('p.id as id')
            .where('p."yggdrasilId" = :id', { id: data.id })
            .getRawOne<{
              id: string;
            }>();

          postId = matchedYggdrasilPost?.id;
        }

        const {
          mergedKeywords,
          questions,
          content_type,
          smartTitle,
          fixedData,
          twitterReference,
        } = await fixData({
          logger,
          entityManager,
          data: {
            ...data,
            // pass resolved post id or fallback to original data
            post_id: postId || data.post_id,
          },
        });

        if (content_type === PostType.SocialTwitter && twitterReference) {
          fixedData.sharedPostId = await upsertTwitterReferencedPost({
            entityManager,
            reference: twitterReference,
            language: fixedData.language,
          });
        }

        // See if post id is not available
        if (!postId) {
          // Handle creation of new post
          const newPost = await createPost({
            logger,
            entityManager,
            data: fixedData,
            mergedKeywords,
            questions,
            smartTitle,
          });

          postId = newPost?.id;
        } else {
          // Handle update of existing post
          await updatePost({
            logger,
            entityManager,
            data: fixedData,
            id: postId,
            mergedKeywords,
            questions,
            content_type,
            smartTitle,
          });
        }

        if (postId) {
          // temp wrapper to avoid any issue with post processing
          // while we test code snippets insertion
          const safeInsertCodeSnippets = async () => {
            try {
              await insertCodeSnippetsFromUrl({
                entityManager,
                post: {
                  id: postId,
                },
                codeSnippetsUrl: data?.meta?.stored_code_snippets,
              });
            } catch (err) {
              logger.error(
                {
                  postId,
                  codeSnippetsUrl: data?.meta?.stored_code_snippets,
                  err,
                },
                'failed to save code snippets for post',
              );
            }
          };

          await Promise.all([
            handleCollectionRelations({
              entityManager,
              logger,
              post: {
                id: postId,
                type: content_type,
              },
              originalData: data,
            }),
            safeInsertCodeSnippets(),
          ]);
        }
      });
    } catch (err) {
      if (err instanceof QueryFailedError) {
        const queryFailedError = err as TypeORMQueryFailedError;

        if (queryFailedError.code === TypeOrmError.DEADLOCK_DETECTED) {
          throw err;
        }
      }

      logger.error(
        { data, messageId: message.messageId, err },
        'failed to update post',
      );
    }
  },
};

export default worker;
