import {
  addKeywords,
  addQuestions,
  ArticlePost,
  CollectionPost,
  FreeformPost,
  getPostVisible,
  Post,
  PostOrigin,
  PostType,
  preparePostForInsert,
  preparePostForUpdate,
  removeKeywords,
  SharePost,
  SocialTwitterPost,
  Source,
  Submission,
  SubmissionStatus,
  UNKNOWN_SOURCE,
  WelcomePost,
  YouTubePost,
} from '../../entity';
import {
  SubmissionFailErrorKeys,
  SubmissionFailErrorMessage,
} from '../../errors';
import { generateShortId } from '../../ids';
import { updateFlagsStatement } from '../../common';
import { counters } from '../../telemetry';
import { BriefPost } from '../../entity/posts/BriefPost';
import { PollPost } from '../../entity/posts/PollPost';
import type {
  HandleRejectionProps,
  CreatePostProps,
  CheckExistingPostProps,
  UpdatePostProps,
  GetSourcePrivacyProps,
} from './types';
import {
  twitterAllowedFields,
  mergeTwitterContentMeta,
} from './socialTwitter/processing';
import { freeformAllowedFields } from './freeform/processing';

export const handleRejection = async ({
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

export const checkExistingUrl = async ({
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

export const contentTypeFromPostType: Record<PostType, typeof Post> = {
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

export const allowedFieldsMapping: Partial<Record<PostType, string[]>> = {
  freeform: freeformAllowedFields,
  [PostType.SocialTwitter]: twitterAllowedFields,
};

export const createPost = async ({
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

export const updatePost = async ({
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
    const incomingKeys = Object.keys(data[metaField] ?? {});
    const existingKeys = Object.keys(databasePost[metaField] ?? {});

    if (!incomingKeys.length && existingKeys.length) {
      data[metaField] = databasePost[metaField];
    }
  });

  if (content_type === PostType.SocialTwitter) {
    data.contentMeta = mergeTwitterContentMeta({ databasePost, data });
  }

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

export const getSourcePrivacy = async ({
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
