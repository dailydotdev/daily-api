import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class Integration {
  @PrimaryColumn({ default: () => 'now()' })
  timestamp: Date;

  @Column({ type: 'text' })
  logo: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text' })
  subtitle: string;

  @Column({ type: 'text' })
  url: string;
}
