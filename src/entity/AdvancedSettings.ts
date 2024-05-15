import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { PostType } from './posts';
import { Source } from './Source';

@Entity()
export class AdvancedSettings {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text', default: 'advanced' })
  group: string;

  @Column({ type: 'bool', default: true })
  defaultEnabledState: boolean;

  @Column({ type: 'jsonb', default: {} })
  options: {
    source?: Pick<Source, 'id'>;
    type?: PostType | string;
  };
}
