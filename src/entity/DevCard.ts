import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user';

@Entity()
export class DevCard {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 36 })
  @Index('IDX_devcard_userId')
  userId: string;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'text', nullable: true })
  background: string | null;

  @ManyToOne(() => User, (user) => user.devCards, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  user: Promise<User>;
}
