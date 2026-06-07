import z from 'zod';
import { CompanyType } from '../../entity/Company';
import { enumValues } from './utils';

const normalizedDomainSchema = z.string().trim().toLowerCase().min(1);

export const companyVerificationCreateCompanySchema = z.object({
  id: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1),
  altName: z.string().trim().min(1).nullish(),
  domains: z.array(normalizedDomainSchema).min(1),
  image: z.url(),
  type: z.enum(enumValues(CompanyType)).optional(),
});

export const companyVerificationLinkDomainSchema = z.object({
  companyId: z.string().trim().min(1),
  domain: normalizedDomainSchema,
});

export const companyVerificationRejectDomainSchema = z.object({
  domain: normalizedDomainSchema,
});
