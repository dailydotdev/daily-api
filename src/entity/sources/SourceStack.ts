import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Source } from '../Source';
import type { User } from '../user';
import type { DatasetTool } from '../dataset/DatasetTool';

@Entity()
@Index('IDX_source_stack_source_id', ['sourceId'])
@Index('IDX_source_stack_source_tool_unique', ['sourceId', 'toolId'], {
  unique: true,
})
export class SourceStack {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_source_stack_id',
  })
  id: string;

  @Column({ type: 'text' })
  sourceId: string;

  @Column({ type: 'uuid' })
  toolId: string;

  @Column({ type: 'integer' })
  position: number;

  @Column({ type: 'text', nullable: true })
  icon: string | null;

  @Column({ type: 'text', nullable: true })
  title: string | null;

  @Column({ type: 'timestamp', default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'text' })
  createdById: string;

  @ManyToOne('Source', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'sourceId',
    foreignKeyConstraintName: 'FK_source_stack_source_id',
  })
  source: Promise<Source>;

  @ManyToOne('DatasetTool', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'toolId',
    foreignKeyConstraintName: 'FK_source_stack_tool_id',
  })
  tool: Promise<DatasetTool>;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'createdById',
    foreignKeyConstraintName: 'FK_source_stack_created_by_id',
  })
  createdBy: Promise<User>;
}
