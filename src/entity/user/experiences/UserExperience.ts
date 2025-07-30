import {
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  TableInheritance,
} from 'typeorm';
import type { User } from '../User';
import type { UserSkill } from '../UserSkill';
import { ExperienceStatus, UserExperienceType } from './types';

@Entity()
@TableInheritance({ column: { type: 'text', name: 'type' } })
export class UserExperience {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne('User', (user: User) => user.experiences, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: Promise<User>;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date', nullable: true })
  endDate: Date;

  @Column({
    type: 'text',
    nullable: false,
  })
  type: UserExperienceType;

  @Column({
    type: 'text',
    default: ExperienceStatus.Draft,
  })
  status: ExperienceStatus;

  @Column({ type: 'jsonb', default: {} })
  flags: Record<string, unknown>;

  @ManyToMany('UserSkill', (skill: UserSkill) => skill.experiences)
  @JoinTable({
    name: 'user_experience_skills',
    joinColumn: { name: 'experienceId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'skillSlug', referencedColumnName: 'slug' },
  })
  skills: Promise<UserSkill[]>;
}
