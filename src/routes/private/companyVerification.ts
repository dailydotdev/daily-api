import type { FastifyInstance } from 'fastify';
import type z from 'zod';
import createOrGetConnection from '../../db';
import {
  companyVerificationCreateCompanySchema,
  companyVerificationLinkDomainSchema,
  companyVerificationRejectDomainSchema,
} from '../../common/schema/companyVerification';
import { Company } from '../../entity/Company';
import { UserCompany } from '../../entity/UserCompany';
import { generateShortId } from '../../ids';
import { uploadLogoFromUrl } from '../../common/cloudinary';
import { updateFlagsStatement } from '../../common/utils';
import { parseSchema } from './utils';

const domainWhere = `split_part(lower(email), '@', 2) = :domain`;

export default async (fastify: FastifyInstance): Promise<void> => {
  fastify.addHook('preHandler', async (req, res) => {
    if (!req.service) {
      return res.status(404).send();
    }
  });

  fastify.post<{
    Body: z.infer<typeof companyVerificationCreateCompanySchema>;
  }>('/companies', async (req, res) => {
    const body = parseSchema({
      schema: companyVerificationCreateCompanySchema,
      value: req.body,
      res,
    });
    if (!body) {
      return;
    }

    const con = await createOrGetConnection();
    const repo = con.getRepository(Company);
    const id = body.id ?? (await generateShortId());

    if (body.id && (await repo.findOneBy({ id: body.id }))) {
      return res.status(409).send({ error: 'Company already exists' });
    }

    const image = await uploadLogoFromUrl(id, body.image);
    const company = await repo.save({
      id,
      name: body.name,
      altName: body.altName ?? null,
      domains: body.domains,
      image,
      ...(body.type ? { type: body.type } : {}),
    });

    return res.status(201).send(company);
  });

  fastify.post<{
    Body: z.infer<typeof companyVerificationLinkDomainSchema>;
  }>('/link-domain', async (req, res) => {
    const body = parseSchema({
      schema: companyVerificationLinkDomainSchema,
      value: req.body,
      res,
    });
    if (!body) {
      return;
    }

    const con = await createOrGetConnection();
    const company = await con
      .getRepository(Company)
      .findOneBy({ id: body.companyId });

    if (!company) {
      return res.status(404).send({ error: 'Company not found' });
    }

    const result = await con
      .getRepository(UserCompany)
      .createQueryBuilder()
      .update()
      .set({ companyId: body.companyId })
      .where(domainWhere, { domain: body.domain })
      .execute();

    return res.status(200).send({ affected: result.affected ?? 0 });
  });

  fastify.post<{
    Body: z.infer<typeof companyVerificationRejectDomainSchema>;
  }>('/reject-domain', async (req, res) => {
    const body = parseSchema({
      schema: companyVerificationRejectDomainSchema,
      value: req.body,
      res,
    });
    if (!body) {
      return;
    }

    const con = await createOrGetConnection();
    const result = await con
      .getRepository(UserCompany)
      .createQueryBuilder()
      .update()
      .set({ flags: updateFlagsStatement<UserCompany>({ rejected: true }) })
      .where(domainWhere, { domain: body.domain })
      .execute();

    return res.status(200).send({ affected: result.affected ?? 0 });
  });
};
