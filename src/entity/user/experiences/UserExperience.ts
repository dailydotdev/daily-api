import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  TableInheritance,
} from 'typeorm';
import type { User } from '../User';
import { UserExperienceType } from './types';
import type { Company } from '../../Company';

@Entity()
@TableInheritance({ column: { type: 'text', name: 'type' } })
export class UserExperience {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index('IDX_user_experience_userId')
  userId: string;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  user: Promise<User>;

  @Column()
  companyId: string;

  @ManyToOne('Company', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  company: Promise<Company>;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text', nullable: true })
  subtitle: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'timestamp' })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  endedAt: Date | null;

  @Column({
    type: 'text',
    nullable: false,
  })
  type: UserExperienceType;
}
