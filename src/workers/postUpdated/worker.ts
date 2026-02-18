import { messageToJson, Worker } from '../worker';
import { bannedAuthors, Post, PostType } from '../../entity';
import { TypeOrmError, type TypeORMQueryFailedError } from '../../errors';
import { QueryFailedError } from 'typeorm';
import { upsertTwitterReferencedPost } from '../../common/twitterSocial';
import { insertCodeSnippetsFromUrl } from '../../common/post';
import type { Data } from './types';
import { handleRejection, createPost, updatePost } from './shared';
import { fixData } from './fixData';
import { handleCollectionRelations } from './collection/processing';

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
