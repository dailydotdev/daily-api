import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { User } from './user/User';
import type { DatasetTool } from './dataset/DatasetTool';

@Entity()
@Index('IDX_tool_comment_tool_id', ['toolId'])
@Index('IDX_tool_comment_parent_id', ['parentId'])
export class ToolComment {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_tool_comment_id',
  })
  id: string;

  @Column({ type: 'uuid' })
  toolId: string;

  @Column({ type: 'text' })
  userId: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'text' })
  contentHtml: string;

  @Column({ type: 'uuid', nullable: true })
  parentId: string | null;

  @Column({ type: 'timestamp', default: () => 'now()' })
  createdAt: Date;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_tool_comment_user_id',
  })
  user: Promise<User>;

  @ManyToOne('DatasetTool', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'toolId',
    foreignKeyConstraintName: 'FK_tool_comment_tool_id',
  })
  tool: Promise<DatasetTool>;

  @ManyToOne('ToolComment', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'parentId',
    foreignKeyConstraintName: 'FK_tool_comment_parent_id',
  })
  parent: Promise<ToolComment>;
}
