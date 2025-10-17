import { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import { User } from '../../../src/entity/user/User';
import { UserExperienceWork } from '../../../src/entity/user/experiences/UserExperienceWork';
import { UserExperienceEducation } from '../../../src/entity/user/experiences/UserExperienceEducation';
import { UserExperienceCertification } from '../../../src/entity/user/experiences/UserExperienceCertification';
import { UserExperienceProject } from '../../../src/entity/user/experiences/UserExperienceProject';
import {
  importUserExperienceWork,
  importUserExperienceEducation,
  importUserExperienceCertification,
  importUserExperienceProject,
} from '../../../src/common/profile/import';
import { userExperienceWorkFixture } from '../../fixture/profile/work';
import { userExperienceEducationFixture } from '../../fixture/profile/education';
import { userExperienceCertificationFixture } from '../../fixture/profile/certification';
import { userExperienceProjectFixture } from '../../fixture/profile/project';
import { UserExperienceSkill } from '../../../src/entity/user/experiences/UserExperienceSkill';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.clearAllMocks();
});

describe('UserExperienceType work import', () => {
  it('imports work experience with skills and location/company parts', async () => {
    const user = await con.getRepository(User).save({ id: 'user-work' });
    const fixture = userExperienceWorkFixture[0];

    const { experienceId } = await importUserExperienceWork({
      data: fixture,
      con: con.manager,
      userId: user.id,
    });
    const experience = await con
      .getRepository(UserExperienceWork)
      .findOne({ where: { id: experienceId } });

    expect(experience).toEqual({
      id: experienceId,
      userId: 'user-work',
      type: 'work',
      title: 'Web Developer',
      subtitle: null,
      description:
        'Frontend & backend (PHP) programming, CMS, custom CMS and website development.',
      customCompanyName: 'Microsoft',
      companyId: null,
      startedAt: new Date('2013-01-01T00:00:00.000Z'),
      endedAt: new Date('2017-12-31T00:00:00.000Z'),
      locationId: null,
      locationType: null,
      employmentType: null,
      verified: false,
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });
    const skills = await con
      .getRepository(UserExperienceSkill)
      .findBy({ experienceId });
    expect(skills.map((s) => s.value)).toEqual(['PHP', 'VIVO CMS', 'CMS']);
  });
});

describe('UserExperienceType education import', () => {
  it('imports education experience with subtitle and optional fields', async () => {
    const user = await con.getRepository(User).save({ id: 'user-education' });
    const fixture = userExperienceEducationFixture[0];

    const { experienceId } = await importUserExperienceEducation({
      data: fixture,
      con: con.manager,
      userId: user.id,
    });
    const experience = await con
      .getRepository(UserExperienceEducation)
      .findOne({ where: { id: experienceId } });

    expect(experience).toEqual({
      id: experienceId,
      userId: 'user-education',
      type: 'education',
      title: 'Master Degree in Artificial Intelligence',
      subtitle: 'Faculty of Engineering',
      description:
        'Graduate level studies in AI focusing on ML and data science applications.',
      customCompanyName: 'University of Los Andes',
      companyId: null,
      startedAt: new Date('2023-01-01T00:00:00.000Z'),
      endedAt: new Date('2024-12-31T00:00:00.000Z'),
      locationId: null,
      locationType: null,
      grade: null,
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });
  });
});

describe('UserExperienceType certification import', () => {
  it('imports certification experience', async () => {
    const user = await con
      .getRepository(User)
      .save({ id: 'user-certification' });
    const fixture = userExperienceCertificationFixture[0];

    const { experienceId } = await importUserExperienceCertification({
      data: fixture,
      con: con.manager,
      userId: user.id,
    });
    const experience = await con
      .getRepository(UserExperienceCertification)
      .findOne({ where: { id: experienceId } });

    expect(experience).toEqual({
      id: experienceId,
      userId: 'user-certification',
      type: 'certification',
      title: 'Master in Node.js',
      subtitle: null,
      description: null,
      customCompanyName: 'Udemy+',
      companyId: null,
      startedAt: new Date('2024-01-01T00:00:00.000Z'),
      endedAt: new Date('2024-12-31T00:00:00.000Z'),
      locationId: null,
      locationType: null,
      externalReferenceId: null,
      url: null,
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });
  });
});

describe('UserExperienceType project import', () => {
  it('imports project experience with skills', async () => {
    const user = await con.getRepository(User).save({ id: 'user-project' });
    const fixture = userExperienceProjectFixture[0];

    const { experienceId } = await importUserExperienceProject({
      data: fixture,
      con: con.manager,
      userId: user.id,
    });
    const experience = await con
      .getRepository(UserExperienceProject)
      .findOne({ where: { id: experienceId } });

    const skills = await con
      .getRepository(UserExperienceSkill)
      .findBy({ experienceId });
    expect(experience).toEqual({
      id: experienceId,
      userId: 'user-project',
      type: 'project',
      title: 'Site for checking prices',
      subtitle: null,
      description:
        'A web application that allows users to compare prices from different retailers.',
      customCompanyName: null,
      companyId: null,
      startedAt: new Date('2024-01-01T00:00:00.000Z'),
      endedAt: new Date('2025-09-30T00:00:00.000Z'),
      locationId: null,
      locationType: null,
      url: null,
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });
    expect(skills.map((s) => s.value).sort()).toEqual(
      ['GraphQL', 'Node.js'].sort(),
    );
  });
});
