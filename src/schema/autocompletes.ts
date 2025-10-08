import { AutocompleteType, Autocomplete } from '../entity/Autocomplete';
import { traceResolvers } from './trace';
import { ILike } from 'typeorm';
import { AuthContext, BaseContext } from '../Context';
import { toGQLEnum } from '../common';
import { queryReadReplica } from '../common/queryReadReplica';
import { autocompleteSchema } from '../common/schema/autocompletes';
import type z from 'zod';

interface AutocompleteData {
  result: string[];
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
      @cacheControl(maxAge: 3600)
  }
`;

export const resolvers = traceResolvers<unknown, BaseContext>({
  Query: {
    autocomplete: async (
      _,
      payload: z.infer<typeof autocompleteSchema>,
      ctx: AuthContext,
    ): Promise<AutocompleteData> => {
      const { type, query, limit } = autocompleteSchema.parse(payload);
      const result = await queryReadReplica(ctx.con, ({ queryRunner }) =>
        queryRunner.manager.getRepository(Autocomplete).find({
          select: { value: true },
          take: limit,
          order: { value: 'ASC' },
          where: { enabled: true, type, value: ILike(`%${query}%`) },
        }),
      );

      return { result: result.map((a) => a.value) };
    },
  },
});
