import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class Banner {
  @PrimaryColumn({ default: () => 'now()' })
  timestamp: Date;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text' })
  subtitle: string;

  @Column({ type: 'text' })
  cta: string;

  @Column({ type: 'text' })
  url: string;

  @Column({ type: 'text' })
  theme: string;
}
