import { Column, Entity, ManyToOne, PrimaryColumn } from 'typeorm';
import type { User } from './User';
import type { Decoration } from '../Decoration';

@Entity()
export class UserDecoration {
  @PrimaryColumn({ type: 'text' })
  userId: string;

  @PrimaryColumn({ type: 'text' })
  decorationId: string;

  @Column({ type: 'timestamp', default: () => 'now()' })
  createdAt: Date;

  @ManyToOne('User', { lazy: true, onDelete: 'CASCADE' })
  user: Promise<User>;

  @ManyToOne('Decoration', { lazy: true, onDelete: 'CASCADE' })
  decoration: Promise<Decoration>;
}
