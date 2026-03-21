import { FastifyInstance } from 'fastify';
import { Post, User, UserAction, UserActionType } from '../entity';
import { FreeformPost } from '../entity/posts/FreeformPost';
import createOrGetConnection from '../db';
import { ValidationError } from 'apollo-server-errors';
import { validateAndTransformHandle } from '../common/handles';
import type {
  AddUserDataPost,
  UpdateUserEmailData,
} from '../entity/user/utils';
import {
  addClaimableItemsToUser,
  addNewUser,
  confirmUserEmail,
  updateUserEmail,
} from '../entity/user/utils';
import { queryReadReplica } from '../common/queryReadReplica';
import { kvasir } from './private/kvasir';
import rpc from './private/rpc';
import { createWorkerJobRpc } from './private/workerJobRpc';
import { connectRpcPlugin, baseRpcContext } from '../common/connectRpc';
import { Code, ConnectError } from '@connectrpc/connect';
import { Opportunity } from '../entity/opportunities/Opportunity';
import { opportunityCreateSchema } from '../common/schema/opportunities';
import { markdown } from '../common/markdown';
import {
  OpportunityContent,
  OpportunityState,
  OpportunityType,
  type OpportunityMeta,
} from '@dailydotdev/schema';
import { OpportunityJob } from '../entity/opportunities/OpportunityJob';
import { OpportunityKeyword } from '../entity/OpportunityKeyword';
import { logger } from '../logger';
import { claimAnonOpportunities } from '../common/opportunity/user';
import { addOpportunityDefaultQuestionFeedback } from '../common/opportunity/question';
import { z } from 'zod';
import { counters } from '../telemetry';
import { applyVordrToUsers } from '../common/vordr';
import { updatePostContentSchema } from '../common/schema/posts';
import { PostHighlight } from '../entity/PostHighlight';
import {
  setHighlightsSchema,
  postHighlightItemSchema,
  updateHighlightSchema,
} from '../common/schema/postHighlight';

interface SearchUsername {
  search: string;
}

const MAX_VORDR_BATCH_SIZE = 500;

type HighlightRouteItem = {
  postId: string;
  headline: string;
  rank?: number;
  highlightedAt?: string;
  significanceLabel?: string | null;
  reason?: string | null;
};

type TimestampedHighlightRouteItem = Omit<
  HighlightRouteItem,
  'highlightedAt'
> & {
  highlightedAt: Date;
};

type StoredHighlightItem = {
  postId: string;
  headline: string;
  highlightedAt: Date;
  significanceLabel: string | null;
  reason: string | null;
};

const normalizeHighlightOrder = <
  T extends {
    postId: string;
    headline: string;
    significanceLabel?: string | null;
    reason?: string | null;
  },
>(
  items: T[],
): Array<T & { highlightedAt: Date }> => {
  const baseTimestamp = Date.now();

  return items.map((item, index) => ({
    ...item,
    highlightedAt: new Date(baseTimestamp - index * 1000),
  }));
};

const withHighlightTimestamps = (
  items: HighlightRouteItem[],
): TimestampedHighlightRouteItem[] => {
  const allItemsHaveTimestamps = items.every((item) => item.highlightedAt);

  if (allItemsHaveTimestamps) {
    return items.map((item) => ({
      ...item,
      highlightedAt: new Date(item.highlightedAt!),
    }));
  }

  const orderedItems = items
    .map((item, index) => ({
      ...item,
      orderIndex: index,
    }))
    .sort((left, right) => {
      const leftRank = left.rank ?? Number.MAX_SAFE_INTEGER;
      const rightRank = right.rank ?? Number.MAX_SAFE_INTEGER;

      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      return left.orderIndex - right.orderIndex;
    })
    .map((item) => ({
      postId: item.postId,
      headline: item.headline,
      rank: item.rank,
      highlightedAt: item.highlightedAt,
      significanceLabel: item.significanceLabel,
      reason: item.reason,
    }));

  return normalizeHighlightOrder(orderedItems);
};

const toStoredHighlightItem = (
  item: TimestampedHighlightRouteItem,
): StoredHighlightItem => ({
  postId: item.postId,
  headline: item.headline,
  highlightedAt: item.highlightedAt,
  significanceLabel: item.significanceLabel ?? null,
  reason: item.reason ?? null,
});

const toStoredHighlightItems = (
  items: TimestampedHighlightRouteItem[],
): StoredHighlightItem[] => items.map(toStoredHighlightItem);

const reorderHighlightsByRank = ({
  currentHighlights,
  nextItem,
  rank,
}: {
  currentHighlights: PostHighlight[];
  nextItem: HighlightRouteItem;
  rank: number;
}): StoredHighlightItem[] => {
  const remainingHighlights = currentHighlights
    .filter((highlight) => highlight.postId !== nextItem.postId)
    .map<StoredHighlightItem>((highlight) => ({
      postId: highlight.postId,
      headline: highlight.headline,
      highlightedAt: highlight.highlightedAt,
      significanceLabel: highlight.significanceLabel,
      reason: highlight.reason,
    }));
  const insertionIndex = Math.max(
    0,
    Math.min(rank - 1, remainingHighlights.length),
  );
  const reorderedHighlights = remainingHighlights.slice();

  reorderedHighlights.splice(insertionIndex, 0, {
    postId: nextItem.postId,
    headline: nextItem.headline,
    highlightedAt: new Date(),
    significanceLabel: nextItem.significanceLabel ?? null,
    reason: nextItem.reason ?? null,
  });

  return normalizeHighlightOrder(reorderedHighlights).map(
    toStoredHighlightItem,
  );
};

const upsertHighlightsForChannel = async ({
  con,
  channel,
  items,
}: {
  con: Awaited<ReturnType<typeof createOrGetConnection>>;
  channel: string;
  items: StoredHighlightItem[];
}): Promise<void> => {
  if (!items.length) {
    return;
  }

  await con.getRepository(PostHighlight).upsert(
    items.map((item) => ({
      channel,
      postId: item.postId,
      highlightedAt: item.highlightedAt,
      headline: item.headline,
      significanceLabel: item.significanceLabel,
      reason: item.reason,
    })),
    { conflictPaths: ['channel', 'postId'] },
  );
};

const vordrUsersSchema = z.object({
  userIds: z
    .array(z.string().trim().min(1).max(36))
    .min(1, {
      error: 'At least one user ID is required',
    })
    .max(MAX_VORDR_BATCH_SIZE, {
      error: `Maximum of ${MAX_VORDR_BATCH_SIZE} user IDs can be processed at once`,
    }),
});

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: AddUserDataPost }>('/newUser', async (req, res) => {
    if (!req.service) {
      return res.status(404).send();
    }

    const con = await createOrGetConnection();
    // Temporary fix to migrate existing "referral" to "referralId" for backward compatability
    const { referral, ...rest } = req.body || ({} as AddUserDataPost);
    const referralId = rest.referralId || referral;
    let referralOrigin = rest.referralOrigin;

    // Temporary fix to set referralOrigin to "squad" for backward compatability
    if (referralId && !referralOrigin) {
      referralOrigin = 'squad';
    }

    const body = { ...rest, referralId, referralOrigin };
    const operationResult = await addNewUser(con, body, req);

    await addClaimableItemsToUser(con, body);

    if (body.id && operationResult.status === 'ok') {
      const identifiers = [body.id, body.email].filter(Boolean);

      const opportunityGroups = await Promise.all(
        identifiers.map((identifier) => {
          return claimAnonOpportunities({
            anonUserId: identifier,
            userId: operationResult.userId,
            con: con.manager,
          });
        }),
      );

      const opportunities = opportunityGroups.flat(1);

      if (opportunities.length > 0) {
        logger.info(
          {
            anonUserId: body.id,
            userId: operationResult.userId,
            opportunities,
          },
          'Claimed anon opportunities for new user',
        );
      }
    }

    return res.status(200).send(operationResult);
  });
  fastify.post<{ Body: UpdateUserEmailData }>(
    '/updateUserEmail',
    async (req, res) => {
      if (!req.service) {
        return res.status(404).send();
      }

      const con = await createOrGetConnection();
      const operationResult = await updateUserEmail(con, req.body, req.log);
      return res.status(200).send(operationResult);
    },
  );
  fastify.post<{ Body: UpdateUserEmailData }>(
    '/confirmUserEmail',
    async (req, res) => {
      if (!req.service) {
        return res.status(404).send();
      }

      const con = await createOrGetConnection();
      const operationResult = await confirmUserEmail(con, req.body);
      return res.status(200).send(operationResult);
    },
  );
  fastify.post<{ Body: Opportunity }>('/newOpportunity', async (req, res) => {
    if (!req.service) {
      return res.status(404).send();
    }

    const opportunity = opportunityCreateSchema.safeParse(req.body);
    if (opportunity.error) {
      logger.error(
        {
          opportunity,
        },
        'failed to store opportunity',
      );
      return res.status(500).send();
    }

    const con = await createOrGetConnection();
    await con.transaction(async (entityManager) => {
      const { keywords, content, ...opportunityUpdate } = opportunity.data;

      const renderedContent: Record<string, { content: string; html: string }> =
        {};

      Object.entries(content || {}).forEach(([key, value]) => {
        if (typeof value.content !== 'string') {
          return;
        }

        renderedContent[key] = {
          content: value.content,
          html: markdown.render(value.content),
        };
      });

      const opportunityContent = new OpportunityContent(renderedContent);

      const opportunityJob = await entityManager
        .getRepository(OpportunityJob)
        .createQueryBuilder()
        .insert()
        .values({
          ...opportunityUpdate,
          content: opportunityContent,
          meta: opportunity.data.meta as OpportunityMeta,
          state: OpportunityState.DRAFT,
          type: OpportunityType.JOB,
        })
        .execute();

      const id = opportunityJob.raw?.[0]?.id;

      if (!id) {
        return res.status(500).send();
      }

      await addOpportunityDefaultQuestionFeedback({
        entityManager,
        opportunityId: id,
      });

      if (Array.isArray(keywords)) {
        await entityManager.getRepository(OpportunityKeyword).insert(
          keywords.map((keyword) => ({
            opportunityId: id,
            keyword: keyword.keyword,
          })),
        );
      }
    });

    return res.status(200).send('');
  });
  fastify.get<{ Querystring: SearchUsername }>(
    '/checkUsername',
    async (req, res) => {
      if (!req.service) {
        return res.status(404).send();
      }

      const { search } = req.query;

      if (!search) {
        return res.status(400).send();
      }

      const con = await createOrGetConnection();
      try {
        const handle = await validateAndTransformHandle(
          search,
          'username',
          con,
        );
        const user = await con
          .getRepository(User)
          .findOneBy({ username: handle });
        return res.status(200).send({ isTaken: !!user });
      } catch (err) {
        if (err instanceof ValidationError) {
          return res.status(200).send({ isTaken: true });
        }
        throw err;
      }
    },
  );
  fastify.get<{
    Params: {
      id: string;
    };
    Body: Pick<Post, 'id'> & {
      resourceLocation?: string;
    };
  }>('/posts/:id', async (req, res) => {
    if (!req.service) {
      return res.status(404).send();
    }

    const { id } = req.params;

    if (!id) {
      return res.status(400).send();
    }

    const con = await createOrGetConnection();

    const post = await con.getRepository(Post).findOne({
      select: ['id', 'contentMeta'],
      where: { id },
    });

    if (!post) {
      return res.status(404).send();
    }

    return res.status(200).send({
      id: post.id,
      resourceLocation: (
        post.contentMeta as {
          cleaned?: { resource_location?: string }[];
        }
      )?.cleaned?.[0]?.resource_location,
      scrapedResourceLocation: (
        post.contentMeta as {
          scraped?: { resource_location?: string };
        }
      )?.scraped?.resource_location,
    });
  });
  fastify.get<{
    Params: {
      user_id: string;
      action_name: string;
    };
    Body: {
      found: boolean;
      completedAt?: string;
    };
  }>('/actions/:user_id/:action_name', async (req, res) => {
    if (!req.service) {
      return res.status(404).send();
    }

    const { user_id, action_name } = req.params;
    if (!user_id || !action_name) {
      return res.status(400).send();
    }

    const con = await createOrGetConnection();
    const action = await queryReadReplica(con, ({ queryRunner }) =>
      queryRunner.manager.getRepository(UserAction).findOne({
        select: ['completedAt'],
        where: {
          userId: user_id,
          type: action_name as UserActionType,
        },
      }),
    );

    return res.status(200).send({
      found: !!action,
      completedAt: action?.completedAt,
    });
  });

  fastify.post<{
    Body: {
      userIds: User['id'][];
    };
  }>('/vordrUsers', async (req, res) => {
    if (!req.service) {
      return res.status(404).send();
    }

    const body = vordrUsersSchema.safeParse(req.body);

    if (body.error) {
      req.log.error(body.error, 'Invalid Vordr batch request');
      return res.status(400).send({
        error: {
          name: body.error.name,
          issues: body.error.issues,
        },
      });
    }

    const userIds = [...new Set(body.data.userIds)];

    const con = await createOrGetConnection();

    try {
      await applyVordrToUsers({ con, userIds });
      counters?.api?.vordr?.add(userIds.length, {
        reason: 'manual_vordr',
        type: 'user',
      });
      return res.status(200).send({ success: true });
    } catch (error) {
      req.log.error(
        { err: error, requestSize: userIds.length },
        'Failed Vordr batch',
      );
      return res
        .status(500)
        .send({ error: 'Failed to apply Vordr to all users' });
    }
  });

  fastify.post<{
    Body: z.infer<typeof updatePostContentSchema>;
  }>('/updatePostContent', async (req, res) => {
    if (!req.service) {
      return res.status(404).send();
    }

    const body = updatePostContentSchema.safeParse(req.body);

    if (body.error) {
      return res.status(400).send({
        error: {
          name: body.error.name,
          issues: body.error.issues,
        },
      });
    }

    const { postId, content, mode, title } = body.data;
    const con = await createOrGetConnection();

    const post = await con.getRepository(FreeformPost).findOne({
      select: ['id', 'content'],
      where: { id: postId },
    });

    if (!post) {
      return res.status(404).send({ error: 'post not found' });
    }

    let updatedContent: string;
    switch (mode) {
      case 'append':
        updatedContent = `${post.content || ''}\n\n${content}`;
        break;
      case 'prepend':
        updatedContent = `${content}\n\n${post.content || ''}`;
        break;
      default:
        updatedContent = content;
        break;
    }

    const updatedContentHtml = markdown.render(updatedContent);

    const updatePayload: Partial<FreeformPost> = {
      content: updatedContent,
      contentHtml: updatedContentHtml,
    };

    if (title !== undefined) {
      updatePayload.title = title;
    }

    await con.getRepository(FreeformPost).update({ id: postId }, updatePayload);

    return res.status(200).send({ id: postId });
  });

  // PostHighlight endpoints
  fastify.put<{
    Params: { channel: string };
    Body: z.infer<typeof setHighlightsSchema>;
  }>('/highlights/:channel', async (req, res) => {
    if (!req.service) {
      return res.status(404).send();
    }

    const { channel } = req.params;
    const items = setHighlightsSchema.safeParse(req.body);

    if (items.error) {
      return res.status(400).send({
        error: { name: items.error.name, issues: items.error.issues },
      });
    }

    const con = await createOrGetConnection();
    const itemsWithTimestamps = withHighlightTimestamps(items.data);

    await con.transaction(async (manager) => {
      const repo = manager.getRepository(PostHighlight);
      await repo.delete({ channel });
      await repo.insert(
        toStoredHighlightItems(itemsWithTimestamps).map((item) => ({
          channel,
          postId: item.postId,
          highlightedAt: item.highlightedAt,
          headline: item.headline,
          significanceLabel: item.significanceLabel,
          reason: item.reason,
        })),
      );
    });

    return res.status(200).send({ success: true });
  });

  fastify.post<{
    Params: { channel: string };
    Body: z.infer<typeof postHighlightItemSchema>;
  }>('/highlights/:channel/items', async (req, res) => {
    if (!req.service) {
      return res.status(404).send();
    }

    const { channel } = req.params;
    const item = postHighlightItemSchema.safeParse(req.body);

    if (item.error) {
      return res.status(400).send({
        error: { name: item.error.name, issues: item.error.issues },
      });
    }

    const con = await createOrGetConnection();
    if (item.data.highlightedAt || item.data.rank === undefined) {
      const [itemWithTimestamp] = withHighlightTimestamps([item.data]);
      await upsertHighlightsForChannel({
        con,
        channel,
        items: [toStoredHighlightItem(itemWithTimestamp)],
      });
    } else {
      const currentHighlights = await con.getRepository(PostHighlight).find({
        where: { channel },
        order: { highlightedAt: 'DESC', createdAt: 'DESC' },
      });
      const reorderedHighlights = reorderHighlightsByRank({
        currentHighlights,
        nextItem: item.data,
        rank: item.data.rank,
      });

      await upsertHighlightsForChannel({
        con,
        channel,
        items: reorderedHighlights,
      });
    }

    return res.status(200).send({ success: true });
  });

  fastify.delete<{
    Params: { channel: string; postId: string };
  }>('/highlights/:channel/items/:postId', async (req, res) => {
    if (!req.service) {
      return res.status(404).send();
    }

    const { channel, postId } = req.params;
    const con = await createOrGetConnection();
    await con.getRepository(PostHighlight).delete({ channel, postId });

    return res.status(200).send({ success: true });
  });

  fastify.patch<{
    Params: { channel: string; postId: string };
    Body: z.infer<typeof updateHighlightSchema>;
  }>('/highlights/:channel/items/:postId', async (req, res) => {
    if (!req.service) {
      return res.status(404).send();
    }

    const { channel, postId } = req.params;
    const update = updateHighlightSchema.safeParse(req.body);

    if (update.error) {
      return res.status(400).send({
        error: { name: update.error.name, issues: update.error.issues },
      });
    }

    const con = await createOrGetConnection();
    const repo = con.getRepository(PostHighlight);

    if (update.data.highlightedAt || update.data.rank === undefined) {
      const partialUpdate = {
        headline: update.data.headline,
        highlightedAt: update.data.highlightedAt,
        significanceLabel: update.data.significanceLabel,
        reason: update.data.reason,
      };
      const updatePayload = {
        ...partialUpdate,
        highlightedAt: partialUpdate.highlightedAt
          ? new Date(partialUpdate.highlightedAt)
          : undefined,
      };
      const result = await repo.update({ channel, postId }, updatePayload);

      if (result.affected === 0) {
        return res.status(404).send({ error: 'highlight not found' });
      }
    } else {
      const currentHighlight = await repo.findOneBy({ channel, postId });

      if (!currentHighlight) {
        return res.status(404).send({ error: 'highlight not found' });
      }

      const currentHighlights = await repo.find({
        where: { channel },
        order: { highlightedAt: 'DESC', createdAt: 'DESC' },
      });
      const reorderedHighlights = reorderHighlightsByRank({
        currentHighlights,
        nextItem: {
          postId,
          headline: update.data.headline ?? currentHighlight.headline,
          rank: update.data.rank,
          significanceLabel:
            update.data.significanceLabel ?? currentHighlight.significanceLabel,
          reason: update.data.reason ?? currentHighlight.reason,
        },
        rank: update.data.rank,
      });

      await upsertHighlightsForChannel({
        con,
        channel,
        items: reorderedHighlights,
      });
    }

    return res.status(200).send({ success: true });
  });

  fastify.register(kvasir, { prefix: '/kvasir' });
  fastify.register(connectRpcPlugin, {
    routes: rpc,
    prefix: '/rpc',
  });
  fastify.register(connectRpcPlugin, {
    routes: createWorkerJobRpc((context) => {
      if (!context.values.get(baseRpcContext).service) {
        throw new ConnectError('unauthenticated', Code.Unauthenticated);
      }
    }),
    prefix: '/worker-job-rpc',
  });
}
