import {
  AfterInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Field, ObjectType } from 'type-graphql';
import { notifySourceRequest } from '../common';

@Entity()
@ObjectType({ description: 'Community request for a new source' })
@Index(['createdAt', 'closed'])
@Index(['createdAt', 'closed', 'approved'])
export class SourceRequest {
  @PrimaryGeneratedColumn('uuid')
  @Field({ description: 'Unique identifier' })
  id: string;

  @Column({ type: 'text' })
  @Field({ description: 'URL to the source website' })
  sourceUrl: string;

  @Column({ type: 'text' })
  @Field({ description: 'Id of the user who requested this source' })
  userId: string;

  @Column({ type: 'text', nullable: true })
  @Field({
    description: 'Name of the user who requested this source',
    nullable: true,
  })
  userName?: string;

  @Column({ type: 'text', nullable: true })
  @Field({
    description: 'Email of the user who requested this source',
    nullable: true,
  })
  userEmail?: string;

  @Column({ nullable: true })
  @Field({
    description: 'Whether this request was approved',
    nullable: true,
  })
  approved?: boolean;

  @Column({ default: false })
  @Field({ description: 'Whether this request is closed' })
  closed: boolean;

  @Column({ type: 'text', nullable: true })
  @Field({
    description: 'Id for the future source',
    nullable: true,
  })
  sourceId?: string;

  @Column({ type: 'text', nullable: true })
  @Field({
    description: 'Name of the future source',
    nullable: true,
  })
  sourceName?: string;

  @Column({ type: 'text', nullable: true })
  @Field({
    description: 'URL for thumbnail image of the future source',
    nullable: true,
  })
  sourceImage?: string;

  @Column({ type: 'text', nullable: true })
  @Field({
    description: 'Twitter handle of the future source',
    nullable: true,
  })
  sourceTwitter?: string;

  @Column({ type: 'text', nullable: true })
  @Field({
    description: 'Feed (RSS/Atom) of the future source',
    nullable: true,
  })
  sourceFeed?: string;

  @Column({ type: 'text', nullable: true })
  @Field({
    description: 'Reason for not accepting this request',
    nullable: true,
  })
  reason?: string;

  @CreateDateColumn()
  @Field({ description: 'Time when the request was received' })
  createdAt: Date;

  @UpdateDateColumn()
  @Field({ description: 'Time of last update' })
  updatedAt: Date;

  @AfterInsert()
  notifyNewSourceRequest(): Promise<void> {
    return notifySourceRequest('new', this);
  }
}
