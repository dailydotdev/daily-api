import type { DeepPartial } from 'typeorm';
import type { UserExperience } from '../../../src/entity/user/experiences/UserExperience';
import { UserExperienceType } from '../../../src/entity/user/experiences/types';
import type { UserExperienceEducation } from '../../../src/entity/user/experiences/UserExperienceEducation';
import type { UserExperienceProject } from '../../../src/entity/user/experiences/UserExperienceProject';
import { EmploymentType, LocationType } from '@dailydotdev/schema';
import type { DatasetLocation } from '../../../src/entity/dataset/DatasetLocation';
import type { UserExperienceWork } from '../../../src/entity/user/experiences/UserExperienceWork';

export const datasetLocationFixture: DeepPartial<DatasetLocation>[] = [
  {
    country: 'United States',
    city: 'San Francisco',
    subdivision: 'California',
    iso2: 'US',
    iso3: 'USA',
  },
];

export const userExperienceFixture: DeepPartial<
  UserExperience &
    UserExperienceEducation &
    UserExperienceProject &
    UserExperienceWork & {
      skills?: string[];
    }
>[] = [
  {
    userId: '1',
    companyId: 'dailydev',
    title: 'Senior Software Engineer',
    subtitle: 'Backend Team',
    description: 'Working on API infrastructure',
    startedAt: new Date('2022-01-01'),
    endedAt: null, // Current position
    type: UserExperienceType.Work,
    customLocation: {
      city: 'San Francisco',
      subdivision: 'CA',
      country: 'USA',
    },
    locationType: LocationType.HYBRID,
    skills: ['TypeScript', 'Node.js', 'PostgreSQL'],
    verified: true,
  },
  {
    userId: '1',
    companyId: 'dailydev',
    title: 'Software Engineer',
    subtitle: null,
    description: 'Worked on search infrastructure',
    startedAt: new Date('2020-01-01'),
    endedAt: new Date('2021-12-31'),
    type: UserExperienceType.Work,
    locationType: LocationType.OFFICE,
    skills: ['Elasticsearch', 'Go', 'Docker'],
    employmentType: EmploymentType.CONTRACT,
  },
  {
    userId: '1',
    companyId: 'dailydev',
    title: 'Computer Science',
    subtitle: 'Bachelor of Science',
    description: 'Focused on distributed systems',
    startedAt: new Date('2016-09-01'),
    endedAt: new Date('2020-06-30'),
    type: UserExperienceType.Education,
    grade: '9/5',
  },
  {
    userId: '2',
    companyId: 'dailydev',
    title: 'Open Source Contributor',
    subtitle: null,
    description: 'Contributing to TypeScript projects',
    startedAt: new Date('2021-06-01'),
    endedAt: null,
    type: UserExperienceType.Project,
    url: 'https://example.com/project',
  },
  {
    userId: '2',
    companyId: 'dailydev',
    title: 'Product Manager',
    subtitle: null,
    description: 'Managing product roadmap',
    startedAt: new Date('2021-01-01'),
    endedAt: null,
    type: UserExperienceType.Work,
    employmentType: EmploymentType.FULL_TIME,
    skills: ['Agile', 'Scrum', 'Roadmapping'],
    verified: true,
  },
];
