import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
export class SourceRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  sourceUrl: string;

  @Column({ type: 'text' })
  userId: string;

  @Column({ type: 'text', nullable: true })
  userName?: string;

  @Column({ type: 'text', nullable: true })
  userEmail?: string;

  @Column({ nullable: true })
  approved?: boolean;

  @Column({ default: false })
  closed: boolean;

  @Column({ type: 'text', nullable: true })
  sourceId?: string;

  @Column({ type: 'text', nullable: true })
  sourceName?: string;

  @Column({ type: 'text', nullable: true })
  sourceImage?: string;

  @Column({ type: 'text', nullable: true })
  sourceTwitter?: string;

  @Column({ type: 'text', nullable: true })
  sourceFeed?: string;

  @Column({ type: 'text', nullable: true })
  reason?: string;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
