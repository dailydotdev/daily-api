import { ChildEntity } from 'typeorm';
import { OpportunityUser } from './OpportunityUser';
import { OpportunityUserType } from '../types';

@ChildEntity(OpportunityUserType.Recruiter)
export class OpportunityUserRecruiter extends OpportunityUser {}
