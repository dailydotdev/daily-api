import { IResolvers } from '@graphql-tools/utils';
import { traceResolvers } from './trace';
import { AuthContext, BaseContext } from '../Context';
import graphorm from '../graphorm';
import { Opportunity, OpportunityType } from '@dailydotdev/schema';
import { OpportunityMatch } from '../entity/OpportunityMatch';
import { protoToGQLEnum } from '../common';

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
  ${protoToGQLEnum<typeof OpportunityType>(OpportunityType, 'OpportunityType')}

  enum OpportunityMatchStatus {
    PENDING
    CANDIDATE_ACCEPTED
    CANDIDATE_REJECTED
    CANDIDATE_TIMEOUT
    RECRUITER_ACCEPTED
    RECRUITER_REJECTED
  }
  enum SocialMedia {
    FACEBOOK
    TWITTER
    #etc etc
  }
  type OpportunityContent {
    title: String!
    content: String!
    html: String!
  }
  type OpportunityMeta {
    title: String!
    content: String!
  }
  type SocialMediaLink {
    type: SocialMedia! # facebook, twitter, etc.
    link: String!
  }
  type CustomLink {
    title: String!
    link: String!
  }
  type Opportunity {
    id: ID!
    type: OpportunityType!
    title: String!
    tldr: String
    content: [OpportunityContent!]!
    meta: [OpportunityMeta!]!
    organization: Organization!
    users: [User!]!
    keywords: [Keyword!]!
  }

  type OpportunityMatch {
    status: OpportunityMatchStatus!
    description: String!
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
        builder.queryBuilder.where({ id });
        return builder;
      }),
    getOpportunityMatch: async (
      _,
      { id }: { id: string },
      ctx: AuthContext,
      info,
    ): Promise<GQLOpportunityMatch> =>
      graphorm.queryOneOrFail(ctx, info, (builder) => {
        builder.queryBuilder.where({ id }).andWhere({ userId: ctx.userId });
        return builder;
      }),
  },
});
