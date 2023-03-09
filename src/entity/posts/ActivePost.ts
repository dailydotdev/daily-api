import { ViewColumn, DataSource, ViewEntity } from 'typeorm';
import { Post, PostOrigin, PostType } from './Post';
import { UNKNOWN_SOURCE } from '../Source';

@ViewEntity({
  expression: (connection: DataSource) =>
    connection
      .createQueryBuilder()
      .select('p.*')
      .from(Post, 'p')
      .where('p.deleted = false')
      .andWhere('p.visible = true')
      .andWhere(`p."sourceId" != 'unknown'`),
})
export class ActivePost {
  @ViewColumn()
  id: string;

  @ViewColumn()
  type: PostType;

  @ViewColumn()
  title: string;

  @ViewColumn()
  shortId: string;

  @ViewColumn()
  createdAt: Date;

  @ViewColumn()
  metadataChangedAt: Date;

  @ViewColumn()
  sourceId: string;

  @ViewColumn()
  tweeted: boolean;

  @ViewColumn()
  views: number;

  @ViewColumn()
  score: number;

  @ViewColumn()
  tagsStr: string;

  @ViewColumn()
  upvotes: number;

  @ViewColumn()
  comments: number;

  @ViewColumn()
  scoutId: string | null;

  @ViewColumn()
  authorId: string | null;

  @ViewColumn()
  viewsThreshold: number;

  @ViewColumn()
  trending?: number;

  @ViewColumn()
  lastTrending?: Date;

  @ViewColumn()
  discussionScore?: number;

  @ViewColumn()
  banned: boolean;

  @ViewColumn()
  deleted: boolean;

  @ViewColumn()
  tsv: unknown;

  @ViewColumn()
  private: boolean;

  @ViewColumn()
  origin: PostOrigin;
}
