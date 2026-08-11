import { Type } from 'typebox';
import { Keyword, KeywordStatus } from '../../../entity/Keyword';
import { queryReadReplica } from '../../queryReadReplica';
import type { InterestToolContext } from './context';
import {
  DEFAULT_LOOKUP_LIMIT,
  MAX_LOOKUP_LIMIT,
  budgetError,
  jsonResult,
} from './constants';

export const searchTagsTool = ({
  con,
  consumeBudget,
}: InterestToolContext) => ({
  name: 'search_tags',
  label: 'Search tags',
  description:
    'Find real daily.dev tag slugs matching a fragment. Use this before set_interest_tags rather than guessing slugs — tags that do not exist are silently dropped.',
  parameters: Type.Object({
    query: Type.String(),
    limit: Type.Optional(Type.Number()),
  }),
  execute: async (_id: never, params: { query: string; limit?: number }) => {
    if (consumeBudget()) {
      return jsonResult(budgetError);
    }
    const limit = Math.min(
      Math.max(params.limit ?? DEFAULT_LOOKUP_LIMIT, 1),
      MAX_LOOKUP_LIMIT,
    );
    const rows = await queryReadReplica(con, ({ queryRunner }) =>
      queryRunner.manager
        .getRepository(Keyword)
        .createQueryBuilder('k')
        .select(['k.value AS value', 'k.occurrences AS occurrences'])
        .where('k.status = :status', { status: KeywordStatus.Allow })
        .andWhere('k.value ILIKE :query', { query: `%${params.query}%` })
        .orderBy('k.occurrences', 'DESC')
        .limit(limit)
        .getRawMany<{ value: string; occurrences: number }>(),
    );
    return jsonResult({
      tags: rows.map((row) => ({
        tag: row.value,
        occurrences: row.occurrences,
      })),
    });
  },
});
