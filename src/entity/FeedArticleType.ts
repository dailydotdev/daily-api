import { ArticleType } from './ArticleType';
import { Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import { Feed } from './Feed';

@Entity()
export class FeedArticleType {
  @PrimaryColumn({ type: 'text' })
  @Index()
  feedId: string;

  @PrimaryColumn({ type: 'text' })
  articleTypeId: string;

  @ManyToOne(() => Feed, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  feed: Promise<Feed>;

  @ManyToOne(() => ArticleType, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  articleType: Promise<Feed>;
}
