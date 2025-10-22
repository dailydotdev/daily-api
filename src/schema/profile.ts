import { traceResolvers } from './trace';
import { type AuthContext } from '../Context';
import { getLimit, getShortUrl, toGQLEnum } from '../common';
import { UserExperienceType } from '../entity/user/experiences/types';
import type z from 'zod';
import {
  getExperienceSchema,
  userExperiencesSchema,
  type userExperienceInputBaseSchema,
  type userExperienceWorkSchema,
} from '../common/schema/profile';
import graphorm from '../graphorm';
import { offsetPageGenerator } from './common';
import type { Connection } from 'graphql-relay';
import { UserExperience } from '../entity/user/experiences/UserExperience';
import { Company } from '../entity/Company';
import type { GraphQLResolveInfo } from 'graphql';
import { DatasetLocation } from '../entity/dataset/DatasetLocation';
import { UserExperienceWork } from '../entity/user/experiences/UserExperienceWork';
import {
  AutocompleteType,
  insertOrIgnoreAutocomplete,
} from '../entity/Autocomplete';
import {
  dropSkillsExcept,
  getNonExistingSkills,
  insertOrIgnoreUserExperienceSkills,
} from '../entity/user/experiences/UserExperienceSkill';
import { UserReferral } from '../entity/user/referral/UserReferral';
import { UserReferralLinkedin } from '../entity/user/referral/UserReferralLinkedin';

interface GQLUserExperience {
  id: string;
  type: UserExperienceType;
  title: string;
  description: string | null;
  createdAt: Date;
  startedAt: Date;
  endedAt: Date | null;

  url?: string | null;
  grade?: string | null;
  externalReferenceId?: string | null;
  subtitle?: string | null;
  employmentType?: number | null;
  locationType?: number | null;
}

const baseExperienceInput = /* GraphQL */ `
  type: UserExperienceType!
  title: String!
  subtitle: String
  description: String
  startedAt: DateTime!
  endedAt: DateTime
  companyId: ID
  customCompanyName: String
`;

export const typeDefs = /* GraphQL */ `
  ${toGQLEnum(UserExperienceType, 'UserExperienceType')}

  """
  There is only one column for now, but this is expected to grow
  """
  type UserExperienceSkill {
    value: String!
  }

  type UserExperience {
    id: ID!
    type: UserExperienceType!
    title: String!
    description: String
    createdAt: DateTime
    startedAt: DateTime
    endedAt: DateTime
    company: Company
    customCompanyName: String

    # custom props per child entity
    url: String
    grade: String
    externalReferenceId: String
    subtitle: String
    employmentType: ProtoEnumValue
    location: Location
    locationType: ProtoEnumValue
    skills: [UserExperienceSkill]
  }

  type UserExperienceConnection {
    pageInfo: PageInfo!
    edges: [UserExperienceEdge!]!
  }

  type UserExperienceEdge {
    node: UserExperience!

    """
    Used in 'before' and 'after' args
    """
    cursor: String!
  }

  type RecruiterReferral {
    message: String!
    cta: String!
    url: String!
  }

  extend type Query {
    userExperiences(
      userId: ID!
      type: UserExperienceType
      """
      Paginate after opaque cursor
      """
      after: String
      """
      Paginate first
      """
      first: Int
    ): UserExperienceConnection!
    userExperienceById(id: ID!): UserExperience
    userReferralRecruiter(toReferExternalId: String!): RecruiterReferral! @auth
  }

  input UserGeneralExperienceInput {
    ${baseExperienceInput}
    url: String
    grade: String
    externalReferenceId: String
  }

  input UserExperienceWorkInput {
    ${baseExperienceInput}
    locationId: ID
    locationType: ProtoEnumValue
    employmentType: ProtoEnumValue
    skills: [String]
  }

  extend type Mutation {
    upsertUserGeneralExperience(
      input: UserGeneralExperienceInput!
      id: ID
    ): UserExperience @auth
    upsertUserWorkExperience(
      input: UserExperienceWorkInput!
      id: ID
    ): UserExperience @auth
    removeUserExperience(id: ID!): EmptyResponse @auth
  }
`;

const userExperiencesPageGenerator = offsetPageGenerator<GQLUserExperience>(
  100,
  500,
);

type BaseInputSchema = typeof userExperienceInputBaseSchema;

interface ExperienceMutationArgs<T extends BaseInputSchema = BaseInputSchema> {
  input: z.infer<T>;
  id?: string;
}

const generateExperienceToSave = async <
  T extends BaseInputSchema,
  R extends z.core.output<T>,
>(
  ctx: AuthContext,
  { id, input }: ExperienceMutationArgs<T>,
): Promise<{
  userExperience: Partial<UserExperience>;
  parsedInput: R;
}> => {
  const schema = getExperienceSchema(input.type);
  const parsed = schema.parse(input) as R;
  const { customCompanyName, companyId, ...values } = parsed;

  const toUpdate = id
    ? await ctx.con
        .getRepository(UserExperience)
        .findOneOrFail({ where: { id, userId: ctx.userId } })
    : await Promise.resolve({});

  const toSave: Partial<UserExperience> = { ...values, companyId };

  if (companyId) {
    await ctx.con.getRepository(Company).findOneOrFail({
      where: { id: companyId },
    });
    toSave.customCompanyName = null;
  }

  if (customCompanyName) {
    const existingCompany = await ctx.con
      .getRepository(Company)
      .createQueryBuilder('c')
      .where('LOWER(c.name) = :name', { name: customCompanyName.toLowerCase() })
      .getOne();

    if (existingCompany) {
      toSave.customCompanyName = null;
      toSave.companyId = existingCompany.id;
    } else {
      toSave.customCompanyName = customCompanyName;
      toSave.companyId = null;
    }
  }

  return { userExperience: { ...toUpdate, ...toSave }, parsedInput: parsed };
};

const getUserExperience = (
  ctx: AuthContext,
  info: GraphQLResolveInfo,
  id: string,
): Promise<GQLUserExperience> =>
  graphorm.queryOneOrFail(
    ctx,
    info,
    (builder) => {
      builder.queryBuilder.where(`${builder.alias}."id" = :id`, { id });

      return builder;
    },
    undefined,
    true,
  );

// These values are something that could come from growthbook for experimentations
const baseRecruiterUrl = `${process.env.URL_PREFIX}/r/recruiter`;
const defaultRecruiterReferralCta = 'Earn Cores, refer recruiter to daily.dev';
const getDefaultMessage = (url: string) =>
  `I'm currently not open to opportunities. You might find the right candidate on ${url}. It's worth checking out!`;

const getLinkedinProfileUrl = (id: string) =>
  `https://www.linkedin.com/in/${id}`;

export const resolvers = traceResolvers<unknown, AuthContext>({
  Query: {
    userReferralRecruiter: async (
      _,
      { toReferExternalId }: { toReferExternalId: string },
      ctx,
    ) => {
      const referal = await ctx.con.getRepository(UserReferral).findOne({
        where: { userId: ctx.userId, externalUserId: toReferExternalId },
      });

      if (referal) {
        const url = `${baseRecruiterUrl}/${referal.id}`;
        const result = await getShortUrl(url, ctx.log);

        return {
          message: getDefaultMessage(url),
          cta: defaultRecruiterReferralCta,
          url: result,
        };
      }

      const newReferral = ctx.con.getRepository(UserReferralLinkedin).create({
        userId: ctx.userId,
        externalUserId: toReferExternalId,
        flags: { linkedinProfileUrl: getLinkedinProfileUrl(toReferExternalId) },
      });

      const saved = await ctx.con.getRepository(UserReferral).save(newReferral);
      const url = `${baseRecruiterUrl}/${saved.id}`;
      const result = await getShortUrl(url, ctx.log);

      return {
        message: getDefaultMessage(url),
        cta: defaultRecruiterReferralCta,
        url: result,
      };
    },
    userExperiences: async (
      _,
      args: z.infer<typeof userExperiencesSchema>,
      ctx,
      info,
    ): Promise<Connection<GQLUserExperience>> => {
      const { userId, type } = userExperiencesSchema.parse(args);
      const page = userExperiencesPageGenerator.connArgsToPage(args);

      return graphorm.queryPaginated(
        ctx,
        info,
        (nodeSize) =>
          !!ctx.userId &&
          userExperiencesPageGenerator.hasPreviousPage(page, nodeSize),
        (nodeSize) =>
          !!ctx.userId &&
          userExperiencesPageGenerator.hasNextPage(page, nodeSize),
        (node, index) =>
          userExperiencesPageGenerator.nodeToCursor(page, args, node, index),
        (builder) => {
          builder.queryBuilder.where(
            `${builder.alias}."userId" = :userExperienceId`,
            { userExperienceId: userId },
          );

          if (type) {
            builder.queryBuilder.andWhere(
              `${builder.alias}."type" = :userExperienceType`,
              { userExperienceType: type },
            );
          }

          builder.queryBuilder
            .orderBy(`${builder.alias}."endedAt"`, 'DESC', 'NULLS FIRST')
            .addOrderBy(`${builder.alias}."startedAt"`, 'DESC')
            .limit(!ctx.userId ? 1 : getLimit({ limit: page.limit }))
            .offset(!ctx.userId ? 0 : page.offset);

          return builder;
        },
        undefined,
        true,
      );
    },
    userExperienceById: async (
      _,
      { id }: { id: string },
      ctx,
      info,
    ): Promise<GQLUserExperience> => getUserExperience(ctx, info, id),
  },
  Mutation: {
    upsertUserGeneralExperience: async (
      _,
      args: ExperienceMutationArgs,
      ctx,
      info,
    ): Promise<GQLUserExperience> => {
      const { userExperience } = await generateExperienceToSave(ctx, args);

      const entity = await ctx.con.transaction(async (con) => {
        const repo = con.getRepository(UserExperience);

        return repo.save({
          ...userExperience,
          userId: ctx.userId,
          type: args.input.type,
        });
      });

      return getUserExperience(ctx, info, entity.id);
    },
    upsertUserWorkExperience: async (
      _,
      args: ExperienceMutationArgs<typeof userExperienceWorkSchema>,
      ctx,
      info,
    ): Promise<GQLUserExperience> => {
      const result = await generateExperienceToSave(ctx, args);

      if (result.parsedInput.locationId) {
        await ctx.con.getRepository(DatasetLocation).findOneOrFail({
          where: { id: result.parsedInput.locationId },
        });
      }

      const entity = await ctx.con.transaction(async (con) => {
        const repo = con.getRepository(UserExperienceWork);
        const skills = result.parsedInput.skills;
        const saved = await repo.save({
          ...result.userExperience,
          type: args.input.type,
          userId: ctx.userId,
        });

        await dropSkillsExcept(con, saved.id, skills);
        await insertOrIgnoreAutocomplete(con, AutocompleteType.Skill, skills);

        const toCreate = await getNonExistingSkills(con, saved.id, skills);
        await insertOrIgnoreUserExperienceSkills(con, saved.id, toCreate);

        return saved;
      });

      return getUserExperience(ctx, info, entity.id);
    },
    removeUserExperience: async (_, { id }: { id: string }, ctx) => {
      await ctx.con
        .getRepository(UserExperience)
        .delete({ id, userId: ctx.userId });

      return { _: true };
    },
  },
});
