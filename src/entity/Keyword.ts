import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

export enum KeywordStatus {
  PENDING = 'pending',
  ALLOW = 'allow',
  DENY = 'deny',
}

@Entity()
export class Keyword {
  @PrimaryColumn({ type: 'text' })
  @Index('IDX_keyword_value')
  value: string;

  @Column({
    type: 'enum',
    enum: KeywordStatus,
    default: KeywordStatus.PENDING,
  })
  @Index('IDX_keyword_status')
  status: KeywordStatus;

  @Column({ default: () => 'now()' })
  @Index('IDX_keyword_createdAt')
  createdAt: Date;
}
