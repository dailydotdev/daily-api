import type { FastifyInstance } from 'fastify';
import type z from 'zod';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import createOrGetConnection from '../../db';
import { parseSchema } from './utils';
import {
  contributionPrivateBlockUserSchema,
  contributionPrivateBlockedUserParamsSchema,
  contributionPrivateBulkCreateActionLinkSchema,
  contributionPrivateCreateActionCategorySchema,
  contributionPrivateCreateActionLinkSchema,
  contributionPrivateCreateActionSchema,
  contributionPrivateCreateCauseSchema,
  contributionPrivateCreateRewardTierSchema,
  contributionPrivateCreateSponsorSchema,
  contributionPrivateFinalizePaymentSchema,
  contributionPrivateFulfillRewardSchema,
  contributionPrivateIdParamsSchema,
  contributionPrivateReviewSubmissionSchema,
  contributionPrivateRewardParamsSchema,
  contributionPrivateUpdateActionCategorySchema,
  contributionPrivateUpdateActionLinkSchema,
  contributionPrivateUpdateActionSchema,
  contributionPrivateUpdateCauseSchema,
  contributionPrivateUpdateRewardTierSchema,
  contributionPrivateUpdateSponsorSchema,
} from '../../common/schema/contributions';
import {
  finalizeContributionPayment,
  normalizeContributionActionEvidence,
} from '../../common/contribution';
import { ContributionAction } from '../../entity/contribution/ContributionAction';
import { ContributionActionCategory } from '../../entity/contribution/ContributionActionCategory';
import { ContributionActionLink } from '../../entity/contribution/ContributionActionLink';
import { ContributionBlockedUser } from '../../entity/contribution/ContributionBlockedUser';
import { ContributionCause } from '../../entity/contribution/ContributionCause';
import { ContributionRewardTier } from '../../entity/contribution/ContributionRewardTier';
import { ContributionSponsor } from '../../entity/contribution/ContributionSponsor';
import { ContributionSubmission } from '../../entity/contribution/ContributionSubmission';
import {
  UserContributionReward,
  UserContributionRewardStatus,
} from '../../entity/contribution/UserContributionReward';

export default async (fastify: FastifyInstance): Promise<void> => {
  fastify.addHook('preHandler', async (req, res) => {
    if (!req.service) {
      return res.status(404).send();
    }
  });

  fastify.post<{
    Body: z.infer<typeof contributionPrivateCreateActionCategorySchema>;
  }>('/action-categories', async (req, res) => {
    const body = parseSchema({
      schema: contributionPrivateCreateActionCategorySchema,
      value: req.body,
      res,
    });
    if (!body) {
      return;
    }

    const con = await createOrGetConnection();
    const category = await con
      .getRepository(ContributionActionCategory)
      .save(body);

    return res.status(201).send(category);
  });

  fastify.patch<{
    Params: z.infer<typeof contributionPrivateIdParamsSchema>;
    Body: z.infer<typeof contributionPrivateUpdateActionCategorySchema>;
  }>('/action-categories/:id', async (req, res) => {
    const params = parseSchema({
      schema: contributionPrivateIdParamsSchema,
      value: req.params,
      res,
    });
    const body = parseSchema({
      schema: contributionPrivateUpdateActionCategorySchema,
      value: req.body,
      res,
      requireNonEmpty: true,
    });
    if (!params || !body) {
      return;
    }

    const con = await createOrGetConnection();
    const result = await con
      .getRepository(ContributionActionCategory)
      .update(params.id, body);

    if (!result.affected) {
      return res.status(404).send({ error: 'Contribution category not found' });
    }

    return res.status(200).send({ success: true });
  });

  fastify.delete<{
    Params: z.infer<typeof contributionPrivateIdParamsSchema>;
  }>('/action-categories/:id', async (req, res) => {
    const params = parseSchema({
      schema: contributionPrivateIdParamsSchema,
      value: req.params,
      res,
    });
    if (!params) {
      return;
    }

    const con = await createOrGetConnection();
    const result = await con
      .getRepository(ContributionActionCategory)
      .delete(params.id);

    if (!result.affected) {
      return res.status(404).send({ error: 'Contribution category not found' });
    }

    return res.status(200).send({ success: true });
  });

  fastify.post<{
    Body: z.infer<typeof contributionPrivateCreateActionSchema>;
  }>('/actions', async (req, res) => {
    const body = parseSchema({
      schema: contributionPrivateCreateActionSchema,
      value: req.body,
      res,
    });
    if (!body) {
      return;
    }

    const con = await createOrGetConnection();
    const action = await con.getRepository(ContributionAction).save({
      ...body,
      evidence: normalizeContributionActionEvidence(body.evidence),
      metadata: body.metadata ?? {},
    });

    return res.status(201).send(action);
  });

  fastify.patch<{
    Params: z.infer<typeof contributionPrivateIdParamsSchema>;
    Body: z.infer<typeof contributionPrivateUpdateActionSchema>;
  }>('/actions/:id', async (req, res) => {
    const params = parseSchema({
      schema: contributionPrivateIdParamsSchema,
      value: req.params,
      res,
    });
    const body = parseSchema({
      schema: contributionPrivateUpdateActionSchema,
      value: req.body,
      res,
      requireNonEmpty: true,
    });
    if (!params || !body) {
      return;
    }

    const con = await createOrGetConnection();
    const { evidence, metadata, ...actionUpdate } = body;
    const updatePayload: QueryDeepPartialEntity<ContributionAction> = {
      ...actionUpdate,
    };

    if (evidence !== undefined) {
      updatePayload.evidence = normalizeContributionActionEvidence(evidence);
    }

    if (metadata !== undefined) {
      updatePayload.metadata = metadata as QueryDeepPartialEntity<
        ContributionAction['metadata']
      >;
    }

    const result = await con
      .getRepository(ContributionAction)
      .update(params.id, updatePayload);

    if (!result.affected) {
      return res.status(404).send({ error: 'Contribution action not found' });
    }

    return res.status(200).send({ success: true });
  });

  fastify.post<{
    Params: z.infer<typeof contributionPrivateIdParamsSchema>;
    Body: z.infer<typeof contributionPrivateCreateActionLinkSchema>;
  }>('/actions/:id/links', async (req, res) => {
    const params = parseSchema({
      schema: contributionPrivateIdParamsSchema,
      value: req.params,
      res,
    });
    const body = parseSchema({
      schema: contributionPrivateCreateActionLinkSchema,
      value: req.body,
      res,
    });
    if (!params || !body) {
      return;
    }

    const con = await createOrGetConnection();
    const action = await con.getRepository(ContributionAction).findOne({
      select: ['id'],
      where: { id: params.id },
    });

    if (!action) {
      return res.status(404).send({ error: 'Contribution action not found' });
    }

    const link = await con.getRepository(ContributionActionLink).save({
      ...body,
      actionId: params.id,
    });

    return res.status(201).send(link);
  });

  fastify.post<{
    Params: z.infer<typeof contributionPrivateIdParamsSchema>;
    Body: z.infer<typeof contributionPrivateBulkCreateActionLinkSchema>;
  }>('/actions/:id/links/bulk', async (req, res) => {
    const params = parseSchema({
      schema: contributionPrivateIdParamsSchema,
      value: req.params,
      res,
    });
    const body = parseSchema({
      schema: contributionPrivateBulkCreateActionLinkSchema,
      value: req.body,
      res,
    });
    if (!params || !body) {
      return;
    }

    const con = await createOrGetConnection();
    const action = await con.getRepository(ContributionAction).findOne({
      select: ['id'],
      where: { id: params.id },
    });

    if (!action) {
      return res.status(404).send({ error: 'Contribution action not found' });
    }

    const links = await con.getRepository(ContributionActionLink).save(
      body.links.map((link) => ({
        ...link,
        actionId: params.id,
      })),
    );

    return res.status(201).send({ count: links.length, links });
  });

  fastify.patch<{
    Params: z.infer<typeof contributionPrivateIdParamsSchema>;
    Body: z.infer<typeof contributionPrivateUpdateActionLinkSchema>;
  }>('/links/:id', async (req, res) => {
    const params = parseSchema({
      schema: contributionPrivateIdParamsSchema,
      value: req.params,
      res,
    });
    const body = parseSchema({
      schema: contributionPrivateUpdateActionLinkSchema,
      value: req.body,
      res,
      requireNonEmpty: true,
    });
    if (!params || !body) {
      return;
    }

    const con = await createOrGetConnection();
    const result = await con
      .getRepository(ContributionActionLink)
      .update(params.id, body);

    if (!result.affected) {
      return res
        .status(404)
        .send({ error: 'Contribution action link not found' });
    }

    return res.status(200).send({ success: true });
  });

  fastify.delete<{
    Params: z.infer<typeof contributionPrivateIdParamsSchema>;
  }>('/links/:id', async (req, res) => {
    const params = parseSchema({
      schema: contributionPrivateIdParamsSchema,
      value: req.params,
      res,
    });
    if (!params) {
      return;
    }

    const con = await createOrGetConnection();
    const result = await con
      .getRepository(ContributionActionLink)
      .delete(params.id);

    if (!result.affected) {
      return res
        .status(404)
        .send({ error: 'Contribution action link not found' });
    }

    return res.status(200).send({ success: true });
  });

  fastify.post<{
    Body: z.infer<typeof contributionPrivateCreateCauseSchema>;
  }>('/causes', async (req, res) => {
    const body = parseSchema({
      schema: contributionPrivateCreateCauseSchema,
      value: req.body,
      res,
    });
    if (!body) {
      return;
    }

    const con = await createOrGetConnection();
    const cause = await con.getRepository(ContributionCause).save(body);

    return res.status(201).send(cause);
  });

  fastify.patch<{
    Params: z.infer<typeof contributionPrivateIdParamsSchema>;
    Body: z.infer<typeof contributionPrivateUpdateCauseSchema>;
  }>('/causes/:id', async (req, res) => {
    const params = parseSchema({
      schema: contributionPrivateIdParamsSchema,
      value: req.params,
      res,
    });
    const body = parseSchema({
      schema: contributionPrivateUpdateCauseSchema,
      value: req.body,
      res,
      requireNonEmpty: true,
    });
    if (!params || !body) {
      return;
    }

    const con = await createOrGetConnection();
    const result = await con
      .getRepository(ContributionCause)
      .update(params.id, body);

    if (!result.affected) {
      return res.status(404).send({ error: 'Contribution cause not found' });
    }

    return res.status(200).send({ success: true });
  });

  fastify.post<{
    Body: z.infer<typeof contributionPrivateCreateSponsorSchema>;
  }>('/sponsors', async (req, res) => {
    const body = parseSchema({
      schema: contributionPrivateCreateSponsorSchema,
      value: req.body,
      res,
    });
    if (!body) {
      return;
    }

    const con = await createOrGetConnection();
    const sponsor = await con.getRepository(ContributionSponsor).save(body);

    return res.status(201).send(sponsor);
  });

  fastify.patch<{
    Params: z.infer<typeof contributionPrivateIdParamsSchema>;
    Body: z.infer<typeof contributionPrivateUpdateSponsorSchema>;
  }>('/sponsors/:id', async (req, res) => {
    const params = parseSchema({
      schema: contributionPrivateIdParamsSchema,
      value: req.params,
      res,
    });
    const body = parseSchema({
      schema: contributionPrivateUpdateSponsorSchema,
      value: req.body,
      res,
      requireNonEmpty: true,
    });
    if (!params || !body) {
      return;
    }

    const con = await createOrGetConnection();
    const result = await con
      .getRepository(ContributionSponsor)
      .update(params.id, body);

    if (!result.affected) {
      return res.status(404).send({ error: 'Contribution sponsor not found' });
    }

    return res.status(200).send({ success: true });
  });

  fastify.delete<{
    Params: z.infer<typeof contributionPrivateIdParamsSchema>;
  }>('/sponsors/:id', async (req, res) => {
    const params = parseSchema({
      schema: contributionPrivateIdParamsSchema,
      value: req.params,
      res,
    });
    if (!params) {
      return;
    }

    const con = await createOrGetConnection();
    const result = await con
      .getRepository(ContributionSponsor)
      .delete(params.id);

    if (!result.affected) {
      return res.status(404).send({ error: 'Contribution sponsor not found' });
    }

    return res.status(200).send({ success: true });
  });

  fastify.post<{
    Body: z.infer<typeof contributionPrivateCreateRewardTierSchema>;
  }>('/reward-tiers', async (req, res) => {
    const body = parseSchema({
      schema: contributionPrivateCreateRewardTierSchema,
      value: req.body,
      res,
    });
    if (!body) {
      return;
    }

    const con = await createOrGetConnection();
    const tier = await con.getRepository(ContributionRewardTier).save(body);

    return res.status(201).send(tier);
  });

  fastify.patch<{
    Params: z.infer<typeof contributionPrivateIdParamsSchema>;
    Body: z.infer<typeof contributionPrivateUpdateRewardTierSchema>;
  }>('/reward-tiers/:id', async (req, res) => {
    const params = parseSchema({
      schema: contributionPrivateIdParamsSchema,
      value: req.params,
      res,
    });
    const body = parseSchema({
      schema: contributionPrivateUpdateRewardTierSchema,
      value: req.body,
      res,
      requireNonEmpty: true,
    });
    if (!params || !body) {
      return;
    }

    const con = await createOrGetConnection();
    const updatePayload: QueryDeepPartialEntity<ContributionRewardTier> = {
      ...body,
      metadata: body.metadata as
        | QueryDeepPartialEntity<ContributionRewardTier['metadata']>
        | undefined,
    };
    const result = await con
      .getRepository(ContributionRewardTier)
      .update(params.id, updatePayload);

    if (!result.affected) {
      return res
        .status(404)
        .send({ error: 'Contribution reward tier not found' });
    }

    return res.status(200).send({ success: true });
  });

  fastify.patch<{
    Params: z.infer<typeof contributionPrivateIdParamsSchema>;
    Body: z.infer<typeof contributionPrivateReviewSubmissionSchema>;
  }>('/submissions/:id/review', async (req, res) => {
    const params = parseSchema({
      schema: contributionPrivateIdParamsSchema,
      value: req.params,
      res,
    });
    const body = parseSchema({
      schema: contributionPrivateReviewSubmissionSchema,
      value: req.body,
      res,
    });
    if (!params || !body) {
      return;
    }

    const con = await createOrGetConnection();
    const submission = await con.getRepository(ContributionSubmission).findOne({
      select: ['id', 'paymentId'],
      where: { id: params.id },
    });

    if (!submission) {
      return res
        .status(404)
        .send({ error: 'Contribution submission not found' });
    }

    if (submission.paymentId) {
      return res
        .status(400)
        .send({ error: 'Paid submissions cannot be reviewed' });
    }

    const updatePayload: QueryDeepPartialEntity<ContributionSubmission> = {
      status: body.status,
      reviewedAt: new Date(),
    };

    if (body.awardedPoints !== undefined) {
      updatePayload.awardedPoints = body.awardedPoints;
    }

    if (body.flags !== undefined) {
      updatePayload.flags = body.flags as QueryDeepPartialEntity<
        ContributionSubmission['flags']
      >;
    }

    if (body.reviewedBy !== undefined) {
      updatePayload.reviewedBy = body.reviewedBy;
    }

    await con
      .getRepository(ContributionSubmission)
      .update(params.id, updatePayload);

    return res.status(200).send({ success: true });
  });

  fastify.patch<{
    Params: z.infer<typeof contributionPrivateRewardParamsSchema>;
    Body: z.infer<typeof contributionPrivateFulfillRewardSchema>;
  }>('/rewards/:userId/:tierId/fulfill', async (req, res) => {
    const params = parseSchema({
      schema: contributionPrivateRewardParamsSchema,
      value: req.params,
      res,
    });
    const body = parseSchema({
      schema: contributionPrivateFulfillRewardSchema,
      value: req.body,
      res,
    });
    if (!params || !body) {
      return;
    }

    const con = await createOrGetConnection();
    const result = await con.getRepository(UserContributionReward).update(
      {
        userId: params.userId,
        tierId: params.tierId,
      },
      {
        status: UserContributionRewardStatus.Fulfilled,
        fulfilledAt: body.fulfilledAt ?? new Date(),
      },
    );

    if (!result.affected) {
      return res
        .status(404)
        .send({ error: 'Contribution reward claim not found' });
    }

    return res.status(200).send({ success: true });
  });

  fastify.post<{
    Body: z.infer<typeof contributionPrivateBlockUserSchema>;
  }>('/blocked-users', async (req, res) => {
    const body = parseSchema({
      schema: contributionPrivateBlockUserSchema,
      value: req.body,
      res,
    });
    if (!body) {
      return;
    }

    const con = await createOrGetConnection();
    const blockedUser = await con.getRepository(ContributionBlockedUser).save({
      userId: body.userId,
      reason: body.reason,
    });

    return res.status(201).send(blockedUser);
  });

  fastify.delete<{
    Params: z.infer<typeof contributionPrivateBlockedUserParamsSchema>;
  }>('/blocked-users/:userId', async (req, res) => {
    const params = parseSchema({
      schema: contributionPrivateBlockedUserParamsSchema,
      value: req.params,
      res,
    });
    if (!params) {
      return;
    }

    const con = await createOrGetConnection();
    await con.getRepository(ContributionBlockedUser).delete({
      userId: params.userId,
    });

    return res.status(200).send({ success: true });
  });

  fastify.post<{
    Body: z.infer<typeof contributionPrivateFinalizePaymentSchema>;
  }>('/payments/finalize', async (req, res) => {
    const body = parseSchema({
      schema: contributionPrivateFinalizePaymentSchema,
      value: req.body,
      res,
    });
    if (!body) {
      return;
    }

    const con = await createOrGetConnection();
    const result = await con.transaction((manager) =>
      finalizeContributionPayment({
        con: manager,
        amountCents: body.amountCents,
        createdBy: body.createdBy,
      }),
    );

    if ('error' in result) {
      if (result.error === 'noActiveCauses') {
        return res
          .status(400)
          .send({ error: 'No active contribution causes found' });
      }

      return res
        .status(400)
        .send({ error: 'No approved unpaid contribution submissions found' });
    }

    return res.status(201).send(result.payment);
  });
};
