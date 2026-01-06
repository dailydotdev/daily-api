import {
  ChildEntity,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  TableInheritance,
  UpdateDateColumn,
} from 'typeorm';
import type { User } from './user/User';

export enum UserIntegrationType {
  Slack = 'slack',
  Gif = 'gif',
}

export type IntegrationMetaSlack = {
  appId: string;
  slackUserId: string;
  scope: string;
  tokenType: string;
  accessToken: string;
  teamId: string;
  teamName: string;
};

export type Gif = {
  id: string;
  url: string;
  preview: string;
  title: string;
};

@Entity()
@TableInheritance({
  column: { type: 'text', name: 'type' },
})
export class UserIntegration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'text' })
  userId: string;

  @Column({ type: 'text' })
  type: UserIntegrationType;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  user: Promise<User>;

  @Column({ type: 'jsonb', default: {} })
  meta: unknown;
}

@ChildEntity(UserIntegrationType.Slack)
export class UserIntegrationSlack extends UserIntegration {
  @Column({ type: 'jsonb', default: {} })
  meta: IntegrationMetaSlack;
}

@ChildEntity(UserIntegrationType.Gif)
export class UserIntegrationGif extends UserIntegration {
  @Column({ type: 'jsonb', default: {} })
  meta: {
    favorites: Gif[];
  };
}
