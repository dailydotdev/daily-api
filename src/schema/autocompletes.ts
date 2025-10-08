import { AutocompleteType, Autocomplete } from '../entity';

import { traceResolvers } from './trace';
import { ILike } from 'typeorm';
import { AuthContext, BaseContext } from '../Context';
import { toGQLEnum } from '../common';
import { queryReadReplica } from '../common/queryReadReplica';
import { autocompleteSchema } from '../common/schema/autocompletes';
import { ValidationError } from 'apollo-server-errors';

interface AutocompleteData {
  result: string[];
}

interface AutocompleteArgs {
  type: AutocompleteType;
  query: string;
  limit?: number;
}

export const typeDefs = /* GraphQL */ `
  ${toGQLEnum(AutocompleteType, 'AutocompleteType')}

  type AutocompleteData {
    result: [String]!
  }

  extend type Query {
    """
    Get autocomplete based on type
    """
    autocomplete(type: AutocompleteType!, query: String!): AutocompleteData!
      @auth
  }
`;

export const resolvers = traceResolvers<unknown, BaseContext>({
  Query: {
    autocomplete: async (
      _,
      payload: AutocompleteArgs,
      ctx: AuthContext,
    ): Promise<AutocompleteData> => {
      const { data, error } = autocompleteSchema.safeParse(payload);

      if (!data || error) {
        throw new ValidationError(error.message);
      }

      const { type, query, limit } = data;
      const result = await queryReadReplica(ctx.con, ({ queryRunner }) =>
        queryRunner.manager.getRepository(Autocomplete).find({
          take: limit,
          order: { value: 'ASC' },
          where: { enabled: true, type, value: ILike(`%${query}%`) },
        }),
      );

      return { result: result.map((a) => a.value) };
    },
  },
});
