import {
  Column,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export type KeywordStatus = 'pending' | 'allow' | 'deny' | 'synonym';

enum KEYWORD_CATEGORY {
  TechNews = '🦄 Tech news',
  Frontend = 'Frontend',
  Devops = 'Devops',
  Backend = 'Backend',
  Mobile = 'Mobile',
}

type KeywordCategory = keyof typeof KEYWORD_CATEGORY;

@Entity()
export class Keyword {
  @PrimaryColumn({ type: 'text' })
  @Index('IDX_keyword_value')
  value: string;

  @Column({
    default: 'pending',
  })
  @Index('IDX_keyword_status')
  status: KeywordStatus;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'text', nullable: true })
  synonym?: string;

  @Column({ type: 'text', array: true, default: [] })
  categories: KeywordCategory[];

  @UpdateDateColumn()
  @Index('IDX_keyword_updatedAt')
  updatedAt: Date;

  @Column({ default: 1 })
  @Index('IDX_keyword_occurrences')
  occurrences: number;
}
