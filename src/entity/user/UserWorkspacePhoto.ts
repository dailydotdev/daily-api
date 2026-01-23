import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { User } from './User';

@Entity()
@Index('IDX_user_workspace_photo_user_id', ['userId'])
export class UserWorkspacePhoto {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_user_workspace_photo_id',
  })
  id: string;

  @Column({ type: 'text' })
  userId: string;

  @Column({ type: 'text' })
  image: string;

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
    foreignKeyConstraintName: 'FK_user_workspace_photo_user_id',
  })
  user: Promise<User>;
}
