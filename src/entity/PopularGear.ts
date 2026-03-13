import { DataSource, ViewColumn, ViewEntity } from 'typeorm';
import { UserGear } from './user/UserGear';
import { DatasetGear } from './dataset/DatasetGear';

@ViewEntity({
  materialized: true,
  expression: (dataSource: DataSource) =>
    dataSource
      .createQueryBuilder()
      .select('ug."gearId"', 'gearId')
      .addSelect('dg."name"', 'name')
      .addSelect('dg."category"', 'category')
      .addSelect('COUNT(DISTINCT ug."userId")', 'userCount')
      .from(UserGear, 'ug')
      .innerJoin(DatasetGear, 'dg', 'dg.id = ug."gearId"')
      .where('dg."category" IS NOT NULL')
      .groupBy('ug."gearId"')
      .addGroupBy('dg."name"')
      .addGroupBy('dg."category"')
      .having('COUNT(DISTINCT ug."userId") >= 1')
      .orderBy('COUNT(DISTINCT ug."userId")', 'DESC'),
})
export class PopularGear {
  @ViewColumn()
  gearId: string;

  @ViewColumn()
  name: string;

  @ViewColumn()
  category: string;

  @ViewColumn()
  userCount: number;
}
