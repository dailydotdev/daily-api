import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  Entity,
  ManyToMany,
  PrimaryColumn,
} from 'typeorm';
import { slugify } from '../../common';

@Entity()
export class Skill {
  @PrimaryColumn()
  slug: string;

  @Column({ type: 'text', unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  // @ManyToMany(() => UserExperience, (experience) => experience.skills)
  // experiences: Promise<UserExperience[]>;

  @BeforeInsert()
  @BeforeUpdate()
  generateSlug() {
    this.slug = slugify(this.name);
  }
}
