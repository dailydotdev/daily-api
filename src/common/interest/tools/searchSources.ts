import { Type } from 'typebox';
import { Source } from '../../../entity/Source';
import { queryReadReplica } from '../../queryReadReplica';
import type { InterestToolContext } from './context';
import {
  DEFAULT_LOOKUP_LIMIT,
  MAX_LOOKUP_LIMIT,
  budgetError,
  jsonResult,
} from './constants';

export const searchSourcesTool = ({
  con,
  excludedSourceIds,
  consumeBudget,
}: InterestToolContext) => ({
  name: 'search_sources',
  label: 'Search sources',
  description:
    'Find daily.dev sources whose name or handle matches a fragment. Returns ids you can pass to get_source or query_feed scope "source".',
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
    const sources = await queryReadReplica(con, ({ queryRunner }) =>
      queryRunner.manager
        .getRepository(Source)
        .createQueryBuilder('s')
        .select([
          's.id AS id',
          's.handle AS handle',
          's.name AS name',
          's.description AS description',
        ])
        .where('(s.name ILIKE :query OR s.handle ILIKE :query)', {
          query: `%${params.query}%`,
        })
        .andWhere('s.active = true')
        .andWhere('s.private = false')
        .andWhere('s.id NOT IN (:...excludedSourceIds)', { excludedSourceIds })
        .limit(limit)
        .getRawMany(),
    );
    return jsonResult({ sources });
  },
});
