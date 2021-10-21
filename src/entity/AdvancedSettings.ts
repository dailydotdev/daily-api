import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class AdvancedSettings {
  @PrimaryColumn({ type: 'text' })
  id: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'bool', default: true })
  state: boolean;
}
