import { Source } from './Source';
import {
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
export class ArticleType {
  @PrimaryColumn({ type: 'text' })
  @Index('IDX_article_type_id')
  id: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Source, (source) => source.articleType, {
    lazy: true,
    onDelete: 'DEFAULT',
  })
  sources: Promise<Source[]>;
}
