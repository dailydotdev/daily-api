import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  Entity,
  ManyToMany,
  PrimaryColumn,
} from 'typeorm';
import { slugify } from '../../common';
import { UserExperience } from './experiences/UserExperience';

@Entity()
export class UserSkill {
  @PrimaryColumn()
  slug: string;

  @Column({ type: 'text', unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @ManyToMany(() => UserExperience, (experience) => experience.skills)
  experiences: Promise<UserExperience[]>;

  @BeforeInsert()
  @BeforeUpdate()
  generateSlug() {
    this.slug = slugify(this.name);
  }
}
