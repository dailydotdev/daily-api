import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum AdvancedSettingsGroup {
  Advanced = 'advanced',
  ContentTypes = 'content_types',
}

@Entity()
export class AdvancedSettings {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'bool', default: true })
  defaultEnabledState: boolean;

  @Column({ type: 'text', default: AdvancedSettingsGroup.Advanced })
  group: AdvancedSettingsGroup;
}
