import z from 'zod';

export enum OpportunityState {
  Draft = 'draft',
  Approved = 'approved',
  Live = 'live',
  Closed = 'closed',
}

export enum OpportunityType {
  Job = 'job',
}

export const OpportunityContentSchema = z.object({
  title: z.string(),
  content: z.string(),
  html: z.string().optional(),
});

export const OpportunityMetaSchema = z.object({
  location: z.string(),
  workSite: z.string(),
  employmentType: z.string(),
  teamSize: z.string(),
  salaryRange: z.string(),
  seniorityLevel: z.string(),
  roleType: z.string(),
});

export const OpportunityMatchDescriptionSchema = z.object({
  description: z.string(),
  rank: z.number(),
});

export const OpportunityMatchScreeningSchema = z.object({
  screening: z.string(),
  answer: z.string(),
});

export enum OpportunityUserType {
  Recruiter = 'recruiter',
}

export enum OpportunityMatchStatus {
  Pending = 'pending',
  CandidateAccepted = 'candidate_accepted',
  CandidateRejected = 'candidate_rejected',
  CandidateTimeOut = 'candidate_time_out',
  RecruiterAccepted = 'recruiter_accepted',
  RecruiterRejected = 'recruiter_rejected',
}
