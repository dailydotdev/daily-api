import { DataSource, ViewColumn, ViewEntity } from 'typeorm';
import { HotTake } from './user';

@ViewEntity({
  materialized: true,
  expression: (ds: DataSource) => {
    const ranked = ds
      .createQueryBuilder()
      .select('base.id', 'hotTakeId')
      .addSelect('base.upvotes', 'score')
      .addSelect('base."createdAt"', 'createdAt')
      .addSelect(
        `ROW_NUMBER() OVER (
          PARTITION BY base."userId"
          ORDER BY base.upvotes DESC, base."createdAt" DESC
        )`,
        'rn',
      )
      .from(HotTake, 'base')
      .where('base.upvotes > 0');

    return ds
      .createQueryBuilder()
      .select('ranked."hotTakeId"', 'hotTakeId')
      .addSelect('ranked."score"', 'score')
      .from(`(${ranked.getQuery()})`, 'ranked')
      .setParameters(ranked.getParameters())
      .where('ranked."rn" <= 3')
      .orderBy('ranked."score"', 'DESC')
      .addOrderBy('ranked."createdAt"', 'DESC');
  },
})
export class PopularHotTake {
  @ViewColumn()
  hotTakeId: string;

  @ViewColumn()
  score: number;
}
