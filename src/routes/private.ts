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
import {
  opportunityCreateSchema,
  privateCreateOpportunitySchema,
  privateGetOpportunityParamsSchema,
} from '../common/schema/opportunities';
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
import {
  getOpportunityFileBuffer,
  validateOpportunityFileType,
} from '../common/opportunity/parse';
import { uploadResumeFromBuffer } from '../common/googleCloud';
import { randomUUID } from 'crypto';
import { RESUME_BUCKET_NAME } from '../config';
import { opportunityMatchBatchSize } from '../types';
import { triggerTypedEvent } from '../common/typedPubsub';
import { ClaimableItem, ClaimableItemTypes } from '../entity/ClaimableItem';
import { DeepPartial } from 'typeorm';
import z from 'zod';

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
    Body: z.infer<typeof privateCreateOpportunitySchema>;
  }>('/opportunity', async (req, res) => {
    if (!req.service) {
      return res.status(404).send();
    }

    const parsed = privateCreateOpportunitySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).send({ error: parsed.error.message });
    }

    const { url, emails } = parsed.data;

    try {
      const { buffer, extension } = await getOpportunityFileBuffer({ url });
      const { mime } = await validateOpportunityFileType(buffer, extension);

      const fileName = `opportunity-${randomUUID()}.${extension}`;
      await uploadResumeFromBuffer(fileName, buffer, { contentType: mime });

      const flags: OpportunityJob['flags'] = {
        batchSize: opportunityMatchBatchSize,
        file: {
          blobName: fileName,
          bucketName: RESUME_BUCKET_NAME,
          mimeType: mime,
          extension,
        },
        sourceUrl: url,
        source: 'machine',
      };

      const con = await createOrGetConnection();
      const opportunity = await con.transaction(async (entityManager) => {
        const newOpportunity = await entityManager
          .getRepository(OpportunityJob)
          .save(
            entityManager.getRepository(OpportunityJob).create({
              state: OpportunityState.PARSING,
              title: 'Processing...',
              tldr: '',
              content: new OpportunityContent({}).toJson(),
              flags,
            } as DeepPartial<OpportunityJob>),
          );

        if (emails?.length) {
          await entityManager.getRepository(ClaimableItem).insert(
            emails.map((email) => ({
              identifier: email,
              type: ClaimableItemTypes.Opportunity,
              flags: {
                opportunityId: newOpportunity.id,
              },
            })),
          );
        }

        return newOpportunity;
      });

      await triggerTypedEvent(logger, 'api.v1.opportunity-parse', {
        opportunityId: opportunity.id,
      });

      return res.status(201).send({
        opportunityId: opportunity.id,
        state: OpportunityState.PARSING,
      });
    } catch (error) {
      logger.error({ error, url }, 'Failed to create opportunity from URL');

      if (error instanceof ValidationError) {
        return res.status(400).send({ error: error.message });
      }

      return res.status(500).send({ error: 'Failed to process URL' });
    }
  });

  fastify.get<{ Params: { id: string } }>(
    '/opportunity/:id',
    async (req, res) => {
      if (!req.service) {
        return res.status(404).send();
      }

      const parsed = privateGetOpportunityParamsSchema.safeParse(req.params);
      if (!parsed.success) {
        return res.status(400).send({ error: 'Invalid opportunity ID' });
      }

      const { id } = parsed.data;
      const con = await createOrGetConnection();

      try {
        const opportunity = await queryReadReplica(con, ({ queryRunner }) => {
          return queryRunner.manager.getRepository(OpportunityJob).findOne({
            where: { id },
            relations: ['keywords', 'locations', 'organization'],
          });
        });

        if (!opportunity) {
          return res.status(404).send({ error: 'Opportunity not found' });
        }

        return res.status(200).send(opportunity);
      } catch (error) {
        logger.error({ error, id }, 'Failed to fetch opportunity');
        return res.status(500).send({ error: 'Failed to fetch opportunity' });
      }
    },
  );

  fastify.register(kvasir, { prefix: '/kvasir' });
  fastify.register(connectRpcPlugin, {
    routes: rpc,
    prefix: '/rpc',
  });
}
