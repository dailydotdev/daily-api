import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Source } from './Source';
import { User } from './user';

enum SquadPublicRequestStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
}

@Entity()
@Index('IDX_squad_public_request_sourceId', ['sourceId'])
@Unique('source_id_status_unique_constraint', ['sourceId', 'status'])
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
