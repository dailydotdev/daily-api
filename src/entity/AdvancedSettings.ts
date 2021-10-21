import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity()
export class AdvancedSettings {
  @PrimaryColumn({ type: 'text' })
  @Index('IDX_advancedSettings_id')
  id: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'bool', default: true })
  state: boolean;
}
