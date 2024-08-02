import {
  ChildEntity,
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryColumn,
  TableInheritance,
  UpdateDateColumn,
} from 'typeorm';
import {
  UserIntegrationType,
  UserIntegration,
  UserIntegrationSlack,
} from './UserIntegration';
import { Source } from './Source';

@Entity()
@TableInheritance({
  column: { type: 'text', name: 'type' },
})
export class UserSourceIntegration {
  @PrimaryColumn({ type: 'text' })
  userIntegrationId: string;

  @PrimaryColumn({ type: 'text' })
  sourceId: string;

  @Column({ type: 'text' })
  type: UserIntegrationType;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => UserIntegration, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  userIntegration: Promise<UserIntegration>;

  @ManyToOne(() => Source, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  source: Promise<Source>;
}

@ChildEntity(UserIntegrationType.Slack)
export class UserSourceIntegrationSlack extends UserSourceIntegration {
  @Column({ type: 'text', array: true, default: [] })
  channelIds: string[];

  @ManyToOne(() => UserIntegration, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  userIntegration: Promise<UserIntegrationSlack>;
}
