import { Column, Entity, Index, OneToMany, PrimaryColumn } from 'typeorm';
import { Post } from './Post';
import { DevCard } from './DevCard';

@Entity()
export class User {
  @PrimaryColumn({ length: 36 })
  id: string;

  @Column({ type: 'text', nullable: true })
  name: string | null;

  @Column({ type: 'text', nullable: true })
  image: string | null;

  @Column({ default: 1 })
  reputation: number;

  @Column({ length: 15, nullable: true })
  @Index()
  username: string | null;

  @Column({ length: 15, nullable: true })
  @Index()
  twitter: string | null;

  @Column({ default: false })
  devcardEligible: boolean;

  @Column({ default: false })
  @Index('IDX_user_profileConfirmed')
  profileConfirmed: boolean | null;

  @Column({ nullable: true })
  @Index('IDX_user_createdAt')
  createdAt?: Date | null;

  @OneToMany(() => Post, (post) => post.author, { lazy: true })
  posts: Promise<Post[]>;

  @OneToMany(() => DevCard, (devcard) => devcard.user, { lazy: true })
  devCards: Promise<DevCard[]>;
}
