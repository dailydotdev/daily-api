import { Column, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from './User';

export interface IBaseUpvote {
  userId: string;
  createdAt: Date;
  user: Promise<User>;
}

export default class BaseUpvote implements IBaseUpvote {
  @PrimaryColumn({ length: 36 })
  @Index()
  userId: string;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @ManyToOne(() => User, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  user: Promise<User>;
}
