import { DataSource, ViewColumn, ViewEntity } from 'typeorm';
import { Post } from './posts';
import { View } from './View';

@ViewEntity({
  expression: (connection: DataSource) =>
    connection
      .createQueryBuilder()
      .select('view.*')
      .from(View, 'view')
      .leftJoin(Post, 'post', 'post.id = view.postId')
      .where('post.deleted = false'),
})
export class ActiveView {
  @ViewColumn()
  userId: string;

  @ViewColumn()
  postId: string;

  @ViewColumn()
  timestamp: Date;

  @ViewColumn()
  hidden: boolean;
}
