import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Source } from './Source';
import { User } from './user';

export enum SquadPublicRequestStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
}

@Entity()
export class SquadPublicRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  @Index('IDX_squad_public_request_sourceId')
  sourceId: string;

  @ManyToOne(() => Source, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  source: Promise<Source>;

  @Column({ type: 'text' })
  requestorId: string;

  @ManyToOne(() => User, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  requestor: Promise<User>;

  @Column({ default: () => 'now()', type: 'timestamptz' })
  createdAt: Date;

  @Column({ default: () => 'now()', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ type: 'text' })
  status: SquadPublicRequestStatus;
}
