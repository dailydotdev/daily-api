import { IResolvers } from '@graphql-tools/utils';
import { traceResolvers } from './trace';
import graphorm from '../graphorm';
import { AuthContext, BaseContext } from '../Context';
import { Prompt } from '../entity/Prompt';

type GQLPrompt = Prompt;

export const typeDefs = /* GraphQL */ `
  """
  Flags for the prompt
  """
  type PromptFlagsPublic {
    icon: String
    color: String
  }

  """
  Prompt object
  """
  type Prompt {
    """
    The ID representing this prompt
    """
    id: String!

    order: Int!

    label: String!

    description: String

    prompt: String!

    createdAt: DateTime!

    updatedAt: DateTime!

    flags: PromptFlagsPublic
  }

  extend type Query {
    """
    Get all available prompts
    """
    prompts: [Prompt]!
  }
`;

export const resolvers: IResolvers<unknown, BaseContext> = traceResolvers<
  unknown,
  BaseContext
>({
  Query: {
    prompts: (_, __, ctx: AuthContext, info): Promise<GQLPrompt[]> =>
      graphorm.query<GQLPrompt>(ctx, info, (builder) => {
        builder.queryBuilder = builder.queryBuilder.orderBy(
          `"${builder.alias}".order`,
        );

        return builder;
      }),
  },
});
