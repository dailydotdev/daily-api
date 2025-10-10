import { traceResolvers } from './trace';
import { type AuthContext } from '../Context';
import { toGQLEnum } from '../common';
import { UserExperienceType } from '../entity/user/experiences/types';
import type z from 'zod';
import { userExperiencesSchema } from '../common/schema/profile';
import graphorm from '../graphorm';
import { offsetPageGenerator } from './common';
import type { Connection } from 'graphql-relay';

interface GQLUserExperience {
  id: string;
  type: UserExperienceType;
  title: string;
  description: string | null;
  createdAt: Date;
  startedAt: Date;
  endedAt: Date | null;

  link?: string | null;
  grade?: string | null;
  externalReferenceId?: string | null;
  subtitle?: string | null;
  employmentType?: number | null;
  locationType?: number | null;
}

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

    # custom props per child entity
    link: String
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
`;

const userExperiencesPageGenerator = offsetPageGenerator<GQLUserExperience>(
  100,
  500,
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
            .limit(!ctx.userId ? 1 : page.limit)
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
    ): Promise<GQLUserExperience> => {
      return graphorm.queryOneOrFail(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder.where(`${builder.alias}."id" = :id`, { id });

          return builder;
        },
        undefined,
        true,
      );
    },
  },
});
