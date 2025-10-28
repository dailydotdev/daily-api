import { ChildEntity, Column, Index } from 'typeorm';
import { UserReferral, UserReferralType } from './UserReferral';

@ChildEntity(UserReferralType.Linkedin)
@Index('IDX_user_referral_userId_externalUserId_unique_nonempty', {
  synchronize: false,
})
export class UserReferralLinkedin extends UserReferral {
  @Column({ type: 'text' })
  externalUserId: string;
}
