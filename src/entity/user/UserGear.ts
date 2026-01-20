import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { User } from './User';
import type { DatasetGear } from '../dataset/DatasetGear';

@Entity()
@Index('IDX_user_gear_user_id', ['userId'])
export class UserGear {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_user_gear_id',
  })
  id: string;

  @Column({ type: 'text' })
  userId: string;

  @Column({ type: 'uuid' })
  gearId: string;

  @Column({ type: 'integer' })
  position: number;

  @Column({ type: 'timestamp', default: () => 'now()' })
  createdAt: Date;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_user_gear_user_id',
  })
  user: Promise<User>;

  @ManyToOne('DatasetGear', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'gearId',
    foreignKeyConstraintName: 'FK_user_gear_gear_id',
  })
  gear: Promise<DatasetGear>;
}
