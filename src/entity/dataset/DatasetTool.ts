import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

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
  faviconUrl: string | null;

  @Column({ type: 'text', default: 'none' })
  faviconSource: string;

  @Column({ type: 'timestamp', default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'now()' })
  updatedAt: Date;
}
