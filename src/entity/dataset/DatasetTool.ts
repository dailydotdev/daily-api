import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Source } from '../Source';

@Entity()
@Index('IDX_dataset_tool_title_normalized_unique', ['titleNormalized'], {
  unique: true,
})
@Index('IDX_dataset_tool_title_trgm', { synchronize: false })
export class DatasetTool {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_dataset_tool_id',
  })
  id: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text' })
  titleNormalized: string;

  @Column({ type: 'text', nullable: true })
  url: string | null;

  @Column({ type: 'text', nullable: true })
  @Index('IDX_dataset_tool_category')
  category: string | null;

  @Column({ type: 'text', nullable: true })
  discussionPostId: string | null;

  @Column({ type: 'text', nullable: true })
  @Index('IDX_dataset_tool_official_source_id')
  officialSourceId: string | null;

  @ManyToOne('Source', {
    lazy: true,
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'officialSourceId',
    foreignKeyConstraintName: 'FK_dataset_tool_official_source_id',
  })
  officialSource: Promise<Source> | null;

  @Column({ type: 'text', nullable: true })
  faviconUrl: string | null;

  @Column({ type: 'text', default: 'none' })
  faviconSource: string;

  @Column({ type: 'timestamp', default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
