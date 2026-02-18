import { messageToJson, Worker } from '../worker';
import { bannedAuthors, Post, PostType } from '../../entity';
import { TypeOrmError, type TypeORMQueryFailedError } from '../../errors';
import { QueryFailedError } from 'typeorm';
import { isTwitterSocialType } from '../../common/twitterSocial';
import { upsertTwitterReferencedPost } from '../../common/twitterSocial';
import { insertCodeSnippetsFromUrl } from '../../common/post';
import type { Data, ProcessPostProps, ProcessedPost } from './types';
import { handleRejection, createPost, updatePost } from './shared';
import { processArticle } from './article/processing';
import { processFreeform } from './freeform/processing';
import {
  processCollection,
  handleCollectionRelations,
} from './collection/processing';
import { processVideoYouTube } from './videoYouTube/processing';
import { processSocialTwitter } from './socialTwitter/processing';

const resolveProcessor = (
  contentType?: string,
): ((props: ProcessPostProps) => Promise<ProcessedPost>) => {
  if (isTwitterSocialType(contentType)) {
    return processSocialTwitter;
  }

  switch (contentType as PostType) {
    case PostType.VideoYouTube:
      return processVideoYouTube;
    case PostType.Freeform:
      return processFreeform;
    case PostType.Collection:
      return processCollection;
    default:
      return processArticle;
  }
};

const worker: Worker = {
  subscription: 'api.content-published',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    logger.info({ data }, 'content-updated received');
    try {
      const { reject_reason } = data;
      await con.transaction(async (entityManager) => {
        if (reject_reason) {
          return handleRejection({ logger, data, entityManager });
        }

        const creatorTwitter = data?.extra?.creator_twitter;

        if (creatorTwitter && bannedAuthors.includes(creatorTwitter)) {
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

        const processor = resolveProcessor(data.content_type);
        const result = await processor({
          logger,
          entityManager,
          data: {
            ...data,
            post_id: postId || data.post_id,
          },
        });

        if (
          result.contentType === PostType.SocialTwitter &&
          result.twitterReference
        ) {
          result.fixedData.sharedPostId = await upsertTwitterReferencedPost({
            entityManager,
            reference: result.twitterReference,
            language: result.fixedData.language,
          });
        }

        if (!postId) {
          const newPost = await createPost({
            logger,
            entityManager,
            data: result.fixedData,
            mergedKeywords: result.mergedKeywords,
            questions: result.questions,
            smartTitle: result.smartTitle,
          });

          postId = newPost?.id;
        } else {
          await updatePost({
            logger,
            entityManager,
            data: result.fixedData,
            id: postId,
            mergedKeywords: result.mergedKeywords,
            questions: result.questions,
            content_type: result.contentType,
            smartTitle: result.smartTitle,
            allowedUpdateFields: result.allowedUpdateFields,
          });
        }

        if (postId) {
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
              post: {
                id: postId,
                type: result.contentType,
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
