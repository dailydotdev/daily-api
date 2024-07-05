import {
  ChildEntity,
  Column,
  Entity,
  ManyToOne,
  PrimaryColumn,
  TableInheritance,
} from 'typeorm';
import { UserIntegrationType, UserIntegration } from './UserIntegration';
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
}
