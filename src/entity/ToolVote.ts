import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { User } from './user/User';
import type { DatasetTool } from './dataset/DatasetTool';
import { UserVote } from '../types';

@Entity()
@Index('IDX_tool_vote_tool_id_vote', ['toolId', 'vote'])
export class ToolVote {
  @PrimaryColumn({ type: 'text' })
  userId: string;

  @PrimaryColumn({ type: 'uuid' })
  toolId: string;

  @Column({ type: 'smallint' })
  vote: UserVote;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_tool_vote_user_id',
  })
  user: Promise<User>;

  @ManyToOne('DatasetTool', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'toolId',
    foreignKeyConstraintName: 'FK_tool_vote_tool_id',
  })
  tool: Promise<DatasetTool>;
}
