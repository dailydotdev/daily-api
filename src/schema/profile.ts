import { traceResolvers } from './trace';
import { type AuthContext } from '../Context';
import { toGQLEnum } from '../common';
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
import { UserExperienceSkill } from '../entity/user/experiences/UserExperienceSkill';
import { toSkillSlug, UserSkill } from '../entity/user/UserSkill';
import { In } from 'typeorm';
import { DatasetLocation } from '../entity/dataset/DatasetLocation';

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

const generateExperienceToSave = async <T extends BaseInputSchema>(
  ctx: AuthContext,
  { id, input }: ExperienceMutationArgs<T>,
): Promise<{
  userExperience: Partial<UserExperience>;
  parsedInput: ExperienceMutationArgs<T>['input'];
}> => {
  const schema = getExperienceSchema(input.type);
  const { customCompanyName, companyId, ...values } = schema.parse(input);

  const toUpdate = id
    ? await ctx.con
        .getRepository(UserExperience)
        .findOneOrFail({ where: { id, userId: ctx.userId! } })
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

  return { userExperience: { ...toUpdate, ...toSave }, parsedInput: input };
};

const getUserExperience = (
  ctx: AuthContext,
  info: GraphQLResolveInfo,
  id: string,
): Promise<GQLUserExperience> =>
  graphorm.queryOneOrFail(ctx, info, (builder) => {
    builder.queryBuilder.where(`${builder.alias}."id" = :id`, {
      id,
    });

    return builder;
  });

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
          builder.queryBuilder.where(`${builder.alias}."userId" = :userId`, {
            userId,
          });

          if (type) {
            builder.queryBuilder.andWhere(`${builder.alias}."type" = :type`, {
              type,
            });
          }

          builder.queryBuilder
            .orderBy(`${builder.alias}."endedAt"`, 'DESC', 'NULLS FIRST')
            .addOrderBy(`${builder.alias}."startedAt"`, 'DESC')
            .limit(!ctx.userId ? 1 : page.limit)
            .offset(!ctx.userId ? 0 : page.offset);

          return builder;
        },
        undefined,
        false,
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
          userId: ctx.userId!,
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
        const repo = con.getRepository(UserExperience);

        const saved = await repo.save({
          ...result.userExperience,
          userId: ctx.userId!,
          type: args.input.type,
        });
        const parsed = result.parsedInput as z.infer<
          typeof userExperienceWorkSchema
        >;

        if (!parsed.skills.length) {
          await con
            .getRepository(UserExperienceSkill)
            .delete({ experienceId: saved.id });
          return saved;
        }

        const slugified = parsed.skills.map(toSkillSlug);
        const slugs = [...new Set(slugified)];
        const recognizedSlugs = await con.getRepository(UserSkill).find({
          where: { slug: In(slugs) },
          select: ['slug'],
        });
        const userSlugs = await con.getRepository(UserExperienceSkill).find({
          where: { experienceId: saved.id },
          select: ['slug'],
        });

        const toCreate = parsed.skills.filter((skill) =>
          recognizedSlugs.every((s) => s.slug !== toSkillSlug(skill)),
        );
        const toLink = slugs.filter((slug) =>
          userSlugs.every((s) => s.slug !== slug),
        );
        const toDrop = userSlugs
          .filter(({ slug }) => !slugs.includes(slug))
          .map(({ slug }) => slug);

        if (toCreate.length) {
          await con
            .getRepository(UserSkill)
            .save(toCreate.map((name) => ({ name })));
        }

        if (toLink.length) {
          await con
            .getRepository(UserExperienceSkill)
            .save(slugs.map((slug) => ({ experienceId: saved.id, slug })));
        }

        if (toDrop.length) {
          await con
            .getRepository(UserExperienceSkill)
            .delete({ experienceId: saved.id, slug: In(toDrop) });
        }

        return saved;
      });

      return getUserExperience(ctx, info, entity.id);
    },
  },
});
