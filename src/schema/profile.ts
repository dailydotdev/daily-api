import { traceResolvers } from './trace';
import { type AuthContext } from '../Context';
import { getLimit, toGQLEnum } from '../common';
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
import { findOrCreateDatasetLocation } from '../entity/dataset/utils';
import { User } from '../entity/user/User';
import { getGoogleFaviconUrl } from '../common/companyEnrichment';

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
    verified: Boolean
    customCompanyName: String
    customLocation: Location
    isOwner: Boolean
    image: String
    customDomain: String

    # custom props per child entity
    url: String
    grade: String
    externalReferenceId: String
    subtitle: String
    employmentType: ProtoEnumValue
    location: DatasetLocation
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
  }

  input UserGeneralExperienceInput {
    ${baseExperienceInput}
    url: String
    grade: String
    externalReferenceId: String
    customDomain: String
  }

  input UserExperienceWorkInput {
    ${baseExperienceInput}
    externalLocationId: String
    locationType: ProtoEnumValue
    employmentType: ProtoEnumValue
    skills: [String]
    customDomain: String
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

interface ResolvedCompanyState {
  companyId: string | null;
  customCompanyName: string | null;
}

const resolveCompanyState = async (
  ctx: AuthContext,
  inputCompanyId: string | null | undefined,
  inputCustomCompanyName: string | null | undefined,
  userRemovingCompany: boolean,
): Promise<ResolvedCompanyState> => {
  if (inputCompanyId) {
    await ctx.con.getRepository(Company).findOneOrFail({
      where: { id: inputCompanyId },
    });
    return { companyId: inputCompanyId, customCompanyName: null };
  }

  if (inputCustomCompanyName && !userRemovingCompany) {
    const existingCompany = await ctx.con
      .getRepository(Company)
      .createQueryBuilder('c')
      .where('LOWER(c.name) = :name', {
        name: inputCustomCompanyName.toLowerCase(),
      })
      .getOne();

    if (existingCompany) {
      return { companyId: existingCompany.id, customCompanyName: null };
    }
  }

  return { companyId: null, customCompanyName: inputCustomCompanyName || null };
};

const generateExperienceToSave = async <
  T extends BaseInputSchema,
  R extends z.core.output<T>,
>(
  ctx: AuthContext,
  { id, input }: ExperienceMutationArgs<T>,
): Promise<{
  userExperience: Partial<UserExperience>;
  parsedInput: R;
  removedCompanyId: boolean;
}> => {
  const schema = getExperienceSchema(input.type);
  const parsed = schema.parse(input) as R;
  const { customCompanyName, companyId, customDomain, ...values } =
    parsed as R & { customDomain?: string | null };

  const toUpdate: Partial<UserExperience> = id
    ? await ctx.con
        .getRepository(UserExperience)
        .findOneOrFail({ where: { id, userId: ctx.userId } })
    : {};

  const isUpdate = !!id;
  const hadCompanyId = !!toUpdate.companyId;
  const userRemovingCompany = isUpdate && hadCompanyId && !companyId;

  const resolved = await resolveCompanyState(
    ctx,
    companyId,
    customCompanyName,
    userRemovingCompany,
  );

  const toSave: Partial<UserExperience> = {
    ...values,
    companyId: resolved.companyId,
    customCompanyName: resolved.customCompanyName,
  };

  if (customDomain) {
    const customImage = resolved.companyId
      ? null
      : getGoogleFaviconUrl(customDomain);
    toSave.flags = {
      ...toUpdate.flags,
      customDomain,
      ...(customImage && { customImage }),
    };
  }

  if (userRemovingCompany) {
    toSave.flags = {
      ...toSave.flags,
      ...toUpdate.flags,
      removedEnrichment: true,
    };
  }

  return {
    userExperience: { ...toUpdate, ...toSave },
    parsedInput: parsed,
    removedCompanyId: userRemovingCompany,
  };
};

const getUserExperience = (
  ctx: AuthContext,
  info: GraphQLResolveInfo,
  id: string,
  readReplica = true,
): Promise<GQLUserExperience> =>
  graphorm.queryOneOrFail(
    ctx,
    info,
    (builder) => {
      builder.queryBuilder.where(`${builder.alias}."id" = :id`, { id });

      return builder;
    },
    undefined,
    readReplica,
  );

export const resolvers = traceResolvers<unknown, AuthContext>({
  Query: {
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
          userExperiencesPageGenerator.hasPreviousPage(page, nodeSize),
        (nodeSize) => userExperiencesPageGenerator.hasNextPage(page, nodeSize),
        (node, index) =>
          userExperiencesPageGenerator.nodeToCursor(page, args, node, index),
        (builder) => {
          builder.queryBuilder
            .innerJoin(User, 'owner', `owner.id = ${builder.alias}."userId"`)
            .where(`${builder.alias}."userId" = :userExperienceId`, {
              userExperienceId: userId,
            })
            .andWhere(
              '(owner."hideExperience" = false OR owner.id = :requestingUserId)',
              { requestingUserId: ctx.userId },
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
            .limit(getLimit({ limit: page.limit }))
            .offset(page.offset);

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
    ): Promise<GQLUserExperience | null> =>
      graphorm.queryOne(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder
            .innerJoin(User, 'owner', `owner.id = ${builder.alias}."userId"`)
            .where(`${builder.alias}."id" = :id`, { id })
            .andWhere(
              '(owner."hideExperience" = false OR owner.id = :requestingUserId)',
              { requestingUserId: ctx.userId },
            );

          return builder;
        },
        true,
      ),
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

      return getUserExperience(ctx, info, entity.id, false);
    },
    upsertUserWorkExperience: async (
      _,
      args: ExperienceMutationArgs<typeof userExperienceWorkSchema>,
      ctx,
      info,
    ): Promise<GQLUserExperience> => {
      const { userExperience, parsedInput, removedCompanyId } =
        await generateExperienceToSave(ctx, args);

      const location = await findOrCreateDatasetLocation(
        ctx.con,
        parsedInput.externalLocationId,
      );

      const entity = await ctx.con.transaction(async (con) => {
        const repo = con.getRepository(UserExperienceWork);
        const skills = parsedInput.skills;
        const saved = await repo.save({
          ...userExperience,
          locationId: location?.id || null,
          type: args.input.type,
          userId: ctx.userId,
          // Set verified to false if companyId was removed
          ...(removedCompanyId && { verified: false }),
        });

        await dropSkillsExcept(con, saved.id, skills);
        await insertOrIgnoreAutocomplete(con, AutocompleteType.Skill, skills);

        const toCreate = await getNonExistingSkills(con, saved.id, skills);
        await insertOrIgnoreUserExperienceSkills(con, saved.id, toCreate);

        return saved;
      });

      return getUserExperience(ctx, info, entity.id, false);
    },
    removeUserExperience: async (_, { id }: { id: string }, ctx) => {
      await ctx.con
        .getRepository(UserExperience)
        .delete({ id, userId: ctx.userId });

      return { _: true };
    },
  },
});
