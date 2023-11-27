import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class AdvancedSettings {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text' })
  group: string;

  @Column({ type: 'bool', default: true })
  defaultEnabledState: boolean;
}
