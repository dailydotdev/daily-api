import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity()
export class Category {
  @PrimaryColumn({ type: 'text' })
  id: string;

  @Column({ type: 'text' })
  emoji: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'text', array: true, default: [] })
  tags: string[];
}
