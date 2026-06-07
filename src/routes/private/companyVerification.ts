import type { FastifyInstance, FastifyReply } from 'fastify';
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

const parseSchema = <TSchema extends z.ZodType>({
  schema,
  value,
  res,
}: {
  schema: TSchema;
  value: unknown;
  res: FastifyReply;
}): z.infer<TSchema> | undefined => {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    res.status(400).send({
      error: {
        name: parsed.error.name,
        issues: parsed.error.issues,
      },
    });
    return undefined;
  }

  return parsed.data;
};

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
    const id = body.id ?? (await generateShortId());
    const image = await uploadLogoFromUrl(id, body.image);

    const company = await con.getRepository(Company).save({
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
