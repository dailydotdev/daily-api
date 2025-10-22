import { ChildEntity, Column } from 'typeorm';
import { UserReferral, UserReferralType } from './UserReferral';

@ChildEntity(UserReferralType.Linkedin)
export class UserReferralLinkedin extends UserReferral {
  @Column({ type: 'text', unique: true, nullable: true })
  threadId: string | null = null;
}
