import { UserExperience } from './UserExperience';
import { ChildEntity } from 'typeorm';
import { UserExperienceType } from './types';

@ChildEntity(UserExperienceType.Volunteering)
export class UserExperienceVolunteering extends UserExperience {}
