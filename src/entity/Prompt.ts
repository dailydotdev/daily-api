import {
  Column,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export interface PromptFlagsPublic {
  icon: string;
  color: string;
}

@Entity()
export class Prompt {
  @PrimaryColumn({ type: 'text' })
  @Index()
  id: string;

  @Column({ type: 'integer' })
  @Index('IDX_prompt_order')
  order: number;

  @Column({ type: 'text' })
  label: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text' })
  prompt: string;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'jsonb', default: {} })
  flags: PromptFlagsPublic;
}
