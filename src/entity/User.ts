import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

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
}
