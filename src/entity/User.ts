import { Column, Entity, Index, OneToMany, PrimaryColumn } from 'typeorm';
import { Post } from './Post';

@Entity()
export class User {
  @PrimaryColumn({ length: 36 })
  id: string;

  @Column({ type: 'text', nullable: true })
  name: string | null;

  @Column({ type: 'text', nullable: true })
  image: string | null;

  @Column({ default: 0 })
  reputation: number;

  @Column({ length: 15, nullable: true })
  @Index()
  username: string | null;

  @Column({ length: 15, nullable: true })
  @Index()
  twitter: string | null;

  @Column({ default: false })
  @Index('IDX_user_profileConfirmed')
  profileConfirmed: boolean | null;

  @OneToMany(() => Post, (post) => post.author, { lazy: true })
  posts: Promise<Post[]>;
}
