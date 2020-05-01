import { Ctx, Resolver, UseMiddleware } from 'type-graphql';
import {
  RelayedQuery,
  RelayLimitOffset,
  RelayLimitOffsetArgs,
} from 'auto-relay';
import { Source, SourceDisplay } from '../entity';
import { Context } from '../Context';
import { SelectQueryBuilder } from 'typeorm';
import { ResolverTracing } from '../middleware';

const sourceFromDisplay = (display: SourceDisplay): Source => {
  const source = new Source();
  source.id = display.sourceId;
  source.name = display.name;
  source.image = display.image;
  source.public = !display.userId;
  return source;
};

@Resolver()
export class SourceResolver {
  @RelayedQuery(() => Source, { description: 'Get all available sources' })
  @UseMiddleware(ResolverTracing)
  async sources(
    @Ctx() ctx: Context,
    @RelayLimitOffset() { limit, offset }: RelayLimitOffsetArgs,
  ): Promise<[number, Source[]]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const from = (builder: SelectQueryBuilder<any>): SelectQueryBuilder<any> =>
      builder
        .distinctOn(['sd.sourceId'])
        .addSelect('sd.*')
        .from(SourceDisplay, 'sd')
        .orderBy('sd.sourceId')
        .addOrderBy('sd.userId', 'ASC', 'NULLS LAST')
        .where('"sd"."userId" IS NULL OR "sd"."userId" = :userId')
        .andWhere('"sd"."enabled" = :enabled');

    const res = await ctx.con
      .createQueryBuilder()
      .select('sd.*')
      .addSelect('count(*) OVER() AS count')
      .from(from, 'sd')
      .setParameters({ userId: ctx.userId, enabled: true })
      .orderBy('sd.name', 'ASC')
      .limit(limit)
      .offset(offset)
      .getRawMany();

    if (!res.length) {
      return [0, []];
    }

    return [parseInt(res[0].count), res.map(sourceFromDisplay)];
  }
}
