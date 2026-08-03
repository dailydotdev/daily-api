import { Type } from 'typebox';
import { Source } from '../../../entity/Source';
import { SourceTagView } from '../../../entity/SourceTagView';
import { queryReadReplica } from '../../queryReadReplica';
import type { InterestToolContext } from './context';
import { SOURCE_TOP_TAGS, budgetError, jsonResult } from './constants';

export const getSourceTool = ({
  con,
  excludedSourceIds,
  overBudget,
}: InterestToolContext) => ({
  name: 'get_source',
  label: 'Get source',
  description:
    'Describe one daily.dev source (a publication, blog or squad) by id or handle: what it is, how much it publishes, how much engagement it gets, and the tags it publishes about most. Read its posts with query_feed scope "source".',
  parameters: Type.Object({
    source: Type.String(),
  }),
  execute: async (_id: never, params: { source: string }) => {
    if (overBudget()) {
      return jsonResult(budgetError);
    }
    const source = await queryReadReplica(con, ({ queryRunner }) =>
      queryRunner.manager.getRepository(Source).findOne({
        select: [
          'id',
          'name',
          'handle',
          'description',
          'type',
          'createdAt',
          'flags',
          'private',
          'active',
        ],
        where: [{ id: params.source }, { handle: params.source }],
      }),
    );
    if (!source || !source.active || source.private) {
      return jsonResult({ error: 'source_not_found' });
    }
    if (excludedSourceIds.includes(source.id)) {
      return jsonResult({
        error: 'source_excluded',
        hint: 'Collections, trends and digest sources aggregate other posts and cannot be browsed.',
      });
    }

    const tags = await queryReadReplica(con, ({ queryRunner }) =>
      queryRunner.manager.getRepository(SourceTagView).find({
        select: ['tag'],
        where: { sourceId: source.id },
        order: { count: 'DESC' },
        take: SOURCE_TOP_TAGS,
      }),
    );

    return jsonResult({
      id: source.id,
      handle: source.handle,
      name: source.name,
      description: source.description,
      type: source.type,
      createdAt: source.createdAt?.toISOString(),
      totalPosts: source.flags?.totalPosts,
      totalUpvotes: source.flags?.totalUpvotes,
      totalViews: source.flags?.totalViews,
      totalMembers: source.flags?.totalMembers,
      topTags: tags.map((row) => row.tag),
    });
  },
});
