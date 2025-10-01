export enum UserExperienceType {
  Work = 'work',
  Education = 'education',
  Project = 'project',
  Certification = 'certification',
  Award = 'award',
  Publication = 'publication',
  Course = 'course',
}

export enum ExperienceStatus {
  Draft = 'draft',
  Published = 'published',
}

export enum WorkEmploymentType {
  FullTime = 'full_time',
  PartTime = 'part_time',
  SelfEmployed = 'self_employed',
  Freelance = 'freelance',
  Contract = 'contract',
  Internship = 'internship',
  Apprenticeship = 'apprenticeship',
  Seasonal = 'seasonal',
}

export enum WorkVerificationStatus {
  Pending = 'pending',
  Verified = 'verified',
  Failed = 'failed',
}

export enum ProjectLinkType {
  Code = 'code',
  LivePreview = 'livePreview',
  Demo = 'demo',
  InteractiveDemo = 'interactiveDemo',
}

export type ProjectLink = {
  type: ProjectLinkType;
  url: string;
};

export enum WorkLocationType {
  Remote = 'remote',
  Hybrid = 'hybrid',
  OnSite = 'on_site',
}
