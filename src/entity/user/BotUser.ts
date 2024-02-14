import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class BotUser {
  @PrimaryColumn({ length: 36 })
  id: string;

  @Column({ type: 'text', nullable: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  email: string;

  @Column({ type: 'text', nullable: true })
  company?: string;

  @Column({ type: 'text', nullable: true })
  title?: string;

  @Column({ length: 39, nullable: true })
  username?: string;

  @Column({ type: 'text', nullable: true })
  bio?: string;

  @Column({ type: 'text', nullable: true })
  portfolio?: string;

  @Column({ type: 'text', nullable: true })
  timezone?: string;

  @Column({ nullable: false })
  createdAt: Date;

  @Column({ type: 'text', nullable: true })
  readme?: string;
}
