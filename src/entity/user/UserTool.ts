import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { User } from './User';
import type { DatasetTool } from '../dataset/DatasetTool';

@Entity()
@Index('IDX_user_tool_user_id', ['userId'])
export class UserTool {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_user_tool_id',
  })
  id: string;

  @Column({ type: 'text' })
  userId: string;

  @Column({ type: 'uuid' })
  toolId: string;

  @Column({ type: 'text' })
  category: string;

  @Column({ type: 'integer' })
  position: number;

  @Column({ type: 'timestamp', default: () => 'now()' })
  createdAt: Date;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_user_tool_user_id',
  })
  user: Promise<User>;

  @ManyToOne('DatasetTool', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'toolId',
    foreignKeyConstraintName: 'FK_user_tool_tool_id',
  })
  tool: Promise<DatasetTool>;
}
