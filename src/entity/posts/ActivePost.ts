import { ViewColumn, DataSource, ViewEntity } from 'typeorm';
import { Post } from './Post';

@ViewEntity({
  expression: (connection: DataSource) =>
    connection
      .createQueryBuilder()
      .select('p.*')
      .from(Post, 'p')
      .where('p.deleted = false')
      .andWhere('p.visible = true'),
})
export class ActivePost {
  @ViewColumn()
  createdAt: Date;

  @ViewColumn()
  sourceId: string;

  @ViewColumn()
  tagsStr: string;
}
