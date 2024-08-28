import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Source } from './Source';
import type { User } from './user';

export enum SquadPublicRequestStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
}

@Entity()
@Index('IDX_squad_public_request_sourceId_status_pending', {
  synchronize: false,
})
export class SquadPublicRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  @Index('IDX_squad_public_request_sourceId')
  sourceId: string;

  @ManyToOne('Source', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  source: Promise<Source>;

  @Column({ type: 'text' })
  requestorId: string;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  requestor: Promise<User>;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @Column({ default: () => 'now()' })
  updatedAt: Date;

  @Column({ type: 'text' })
  status: SquadPublicRequestStatus;
}
