import type { FastifyInstance, FastifyRequest } from 'fastify';
import { fastifyConnectPlugin } from '@connectrpc/connect-fastify';
import { createContextValues } from '@connectrpc/connect';
import { ValidationError } from 'apollo-server-errors';
import { DeepPartial } from 'typeorm';
import z from 'zod';
import { outboundRpcContext } from './context';
import rpc from './rpc';
import createOrGetConnection from '../../db';
import {
  privateCreateOpportunitySchema,
  privateGetOpportunityParamsSchema,
} from '../../common/schema/opportunities';
import { OpportunityContent, OpportunityState } from '@dailydotdev/schema';
import { OpportunityJob } from '../../entity/opportunities/OpportunityJob';
import { ClaimableItem, ClaimableItemTypes } from '../../entity/ClaimableItem';
import { logger } from '../../logger';
import { queryReadReplica } from '../../common/queryReadReplica';
import {
  getOpportunityFileBuffer,
  validateOpportunityFileType,
} from '../../common/opportunity/parse';
import { uploadResumeFromBuffer } from '../../common/googleCloud';
import { randomUUID, timingSafeEqual } from 'crypto';
import { RESUME_BUCKET_NAME } from '../../config';
import { opportunityMatchBatchSize } from '../../types';
import { triggerTypedEvent } from '../../common/typedPubsub';
import { OpportunityPreviewStatus } from '../../common/opportunity/types';

const verifyOutboundSecret = (req: FastifyRequest): boolean => {
  const secret = process.env.OUTBOUND_SERVICE_SECRET;
  if (!secret) {
    return false;
  }

  const auth = req.headers.authorization;
  if (!auth) {
    return false;
  }

  const expected = `Bearer ${secret}`;

  if (auth.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(auth), Buffer.from(expected));
};

export default async (fastify: FastifyInstance): Promise<void> => {
  fastify.post<{
    Body: z.infer<typeof privateCreateOpportunitySchema>;
  }>('/opportunities', async (req, res) => {
    if (!verifyOutboundSecret(req)) {
      return res.status(401).send({ error: 'unauthorized' });
    }

    const parsed = privateCreateOpportunitySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).send({ error: parsed.error.message });
    }

    const { url, emails, previewType } = parsed.data;

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
        public_draft: !!emails?.length,
        preview: previewType
          ? {
              totalCount: 0,
              status: OpportunityPreviewStatus.UNSPECIFIED,
              userIds: [],
              type: previewType,
            }
          : undefined,
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
    '/opportunities/:id',
    async (req, res) => {
      if (!verifyOutboundSecret(req)) {
        return res.status(401).send({ error: 'unauthorized' });
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

  fastify.register(fastifyConnectPlugin, {
    routes: rpc,
    prefix: '/rpc',
    jsonOptions: {
      ignoreUnknownFields: false,
    },
    binaryOptions: {
      readUnknownFields: false,
      writeUnknownFields: false,
    },
    contextValues: (req) => {
      const authorized = verifyOutboundSecret(req);
      return createContextValues().set(outboundRpcContext, { authorized });
    },
  });
};
