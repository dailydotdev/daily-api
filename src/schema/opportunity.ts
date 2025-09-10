import { IResolvers } from '@graphql-tools/utils';
import { traceResolvers } from './trace';
import { AuthContext, BaseContext } from '../Context';
import graphorm from '../graphorm';
import { Opportunity, OpportunityState } from '@dailydotdev/schema';
import { OpportunityMatch } from '../entity/OpportunityMatch';
import { toGQLEnum } from '../common';
import { OpportunityMatchStatus } from '../entity/opportunities/types';

export interface GQLOpportunity
  extends Pick<
    Opportunity,
    'id' | 'type' | 'state' | 'title' | 'tldr' | 'content' | 'keywords'
  > {
  createdAt: Date;
  updatedAt: Date;
}

export interface GQLOpportunityMatch
  extends Pick<OpportunityMatch, 'status' | 'description'> {}

export const typeDefs = /* GraphQL */ `
  ${toGQLEnum(OpportunityMatchStatus, 'OpportunityMatchStatus')}

  type OpportunityContentBlock {
    content: String
    html: String!
  }

  type OpportunityContent {
    overview: OpportunityContentBlock
    responsibilities: OpportunityContentBlock
    requirements: OpportunityContentBlock
    whatYoullDo: OpportunityContentBlock
    interviewProcess: OpportunityContentBlock
  }

  type Salary {
    min: Float
    max: Float
    currency: String
    period: ProtoEnumValue
  }

  type Location {
    city: String
    country: String
    subdivision: String
    continent: String
    type: ProtoEnumValue
  }

  type OpportunityMeta {
    employmentType: ProtoEnumValue
    teamSize: Int
    salary: Salary
    seniorityLevel: ProtoEnumValue
    roleType: Float
  }

  type OpportunityKeyword {
    keyword: String!
  }

  type Opportunity {
    id: ID!
    type: ProtoEnumValue!
    title: String!
    tldr: String
    content: OpportunityContent!
    meta: OpportunityMeta!
    location: [Location]!
    organization: Organization!
    recruiters: [User!]!
    keywords: [OpportunityKeyword]!
  }

  type OpportunityMatchDescription {
    reasoning: String!
  }

  type OpportunityMatch {
    status: OpportunityMatchStatus!
    description: OpportunityMatchDescription!
  }

  extend type Query {
    """
    Get the public information about a Opportunity listing
    """
    opportunityById(
      """
      Id of Opportunity
      """
      id: ID!
    ): Opportunity
    """
    Gets the status and description from the Opportunity match
    """
    getOpportunityMatch(
      """
      Id of the Opportunity
      """
      id: ID!
    ): OpportunityMatch @auth
  }
`;

export const resolvers: IResolvers<unknown, BaseContext> = traceResolvers<
  unknown,
  BaseContext
>({
  Query: {
    opportunityById: async (
      _,
      { id }: { id: string },
      ctx: AuthContext,
      info,
    ): Promise<GQLOpportunity> =>
      graphorm.queryOneOrFail(ctx, info, (builder) => {
        builder.queryBuilder
          .where({ id })
          .andWhere({ state: OpportunityState.LIVE });
        return builder;
      }),
    getOpportunityMatch: async (
      _,
      { id }: { id: string },
      ctx: AuthContext,
      info,
    ): Promise<GQLOpportunityMatch> =>
      graphorm.queryOneOrFail(ctx, info, (builder) => {
        builder.queryBuilder
          .where({ opportunityId: id })
          .andWhere({ userId: ctx.userId });
        return builder;
      }),
  },
});
