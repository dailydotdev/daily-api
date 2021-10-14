import {
  Column,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
export class Category {
  @PrimaryColumn({ type: 'text' })
  @Index('IDX_category_id')
  id: string;

  @Column({ type: 'char' })
  emoji: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn()
  @Index('IDX_category_updatedAt')
  updatedAt: Date;

  @Column({ type: 'text', array: true, default: [] })
  tags: string[];
}
