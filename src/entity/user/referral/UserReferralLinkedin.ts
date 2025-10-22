import { ChildEntity } from 'typeorm';
import { UserReferral, UserReferralType } from './UserReferral';

@ChildEntity(UserReferralType.Linkedin)
export class UserReferralLinkedin extends UserReferral {}
