import { FastifyInstance } from 'fastify';
import { Post, User, UserAction, UserActionType } from '../entity';
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
import { connectRpcPlugin } from '../common/connectRpc';
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

interface SearchUsername {
  search: string;
}

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
      const opportunities = await claimAnonOpportunities({
        anonUserId: body.id,
        userId: operationResult.userId,
        con: con.manager,
      });

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

  fastify.register(kvasir, { prefix: '/kvasir' });
  fastify.register(connectRpcPlugin, {
    routes: rpc,
    prefix: '/rpc',
  });
}
