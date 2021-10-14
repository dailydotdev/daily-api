import {
  Column,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export type KeywordStatus = 'pending' | 'allow' | 'deny' | 'synonym';

export enum KEYWORD_CATEGORY {
  'Tech news' = '🦄 Tech news',
  Frontend = '🌈 Frontend',
  Devops = '⚙️ Devops',
  Backend = '☁️ Backend',
  Mobile = '📱 Mobile',
}

export type KeywordCategory = keyof typeof KEYWORD_CATEGORY;

@Entity()
export class Category {
  @PrimaryColumn({ type: 'text' })
  @Index('IDX_category_id')
  id: string;

  @Index()
  @Column({ type: 'text' })
  title: string;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'text', array: true, default: [] })
  tags: string[];
}
