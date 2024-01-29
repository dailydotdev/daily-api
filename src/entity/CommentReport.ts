import { Column, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from './user';

@Entity()
export class CommentReport {
  @PrimaryColumn({ type: 'text' })
  @Index('IDX_comment_report_comment_id')
  commentId: string;

  @PrimaryColumn({ length: 36 })
  @Index('IDX_comment_report_user_id')
  userId: string;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @Column({ length: 36 })
  reason: string;

  @Column({ type: 'text', nullable: true })
  note: string;

  @ManyToOne(() => User, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  user: Promise<User>;
}
