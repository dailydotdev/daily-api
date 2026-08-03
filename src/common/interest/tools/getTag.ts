import { Type } from 'typebox';
import { KeywordStatus } from '../../../entity/Keyword';
import { SourceTagView } from '../../../entity/SourceTagView';
import { TagRecommendation } from '../../../entity/TagRecommendation';
import { queryReadReplica } from '../../queryReadReplica';
import type { InterestToolContext } from './context';
import { SOURCE_TOP_TAGS, budgetError, jsonResult } from './constants';

export const getTagTool = ({
  con,
  excludedSourceIds,
  overBudget,
  pipeline,
}: InterestToolContext) => ({
  name: 'get_tag',
  label: 'Get tag',
  description:
    'Describe one daily.dev tag: its title and description, how many posts carry it, tags commonly used alongside it, and the sources that publish about it most. Synonyms resolve to their canonical tag. Read its posts with query_feed scope "tag".',
  parameters: Type.Object({
    tag: Type.String(),
  }),
  execute: async (_id: never, params: { tag: string }) => {
    if (overBudget()) {
      return jsonResult(budgetError);
    }
    const { requested, keyword, resolvedFrom } = await pipeline.resolveTag(
      params.tag,
    );
    if (!keyword || keyword.status !== KeywordStatus.Allow) {
      return jsonResult({
        tag: requested,
        error: 'tag_not_found',
        hint: 'Use search_tags to find a real tag slug.',
      });
    }

    const [related, sources] = await Promise.all([
      queryReadReplica(con, ({ queryRunner }) =>
        queryRunner.manager.getRepository(TagRecommendation).find({
          select: ['keywordY'],
          where: { keywordX: keyword.value },
          order: { probability: 'DESC' },
          take: SOURCE_TOP_TAGS,
        }),
      ),
      queryReadReplica(con, ({ queryRunner }) =>
        queryRunner.manager.getRepository(SourceTagView).find({
          select: ['sourceId'],
          where: { tag: keyword.value },
          order: { count: 'DESC' },
          take: SOURCE_TOP_TAGS,
        }),
      ),
    ]);

    return jsonResult({
      tag: keyword.value,
      resolvedFrom,
      title: keyword.flags?.title,
      description: keyword.flags?.description,
      occurrences: keyword.occurrences,
      relatedTags: related.map((row) => row.keywordY),
      topSourceIds: sources
        .map((row) => row.sourceId)
        .filter((id) => !excludedSourceIds.includes(id)),
    });
  },
});
