import { Connection, ViewColumn, ViewEntity } from 'typeorm';
import { Post } from './Post';
import { View } from './View';

@ViewEntity({
  expression: (connection: Connection) =>
    connection
      .createQueryBuilder()
      .select('view.userId', 'userId')
      .addSelect('view.postId', 'postId')
      .addSelect('view.timestamp', 'timestamp')
      .addSelect('view.hidden', 'hidden')
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
