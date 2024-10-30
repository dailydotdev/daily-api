import { Column, Entity, ManyToOne, PrimaryColumn } from 'typeorm';
import type { User } from './User';
import type { Keyword } from '../Keyword';

@Entity()
export class UserTopReader {
  @PrimaryColumn({ type: 'uuid', default: () => 'uuid_generate_v4()' })
  id: string;

  @PrimaryColumn({ type: 'text' })
  userId: string;

  @Column({ type: 'timestamptz' })
  issuedAt: Date;

  @Column({ type: 'text' })
  keywordValue: string;

  @Column({ type: 'text', nullable: true })
  image: string;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  user: Promise<User>;

  @ManyToOne('Keyword', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  keyword: Promise<Keyword>;
}
