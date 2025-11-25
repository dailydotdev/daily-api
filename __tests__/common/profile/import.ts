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
      flags: {},
    });
    const skills = await con
      .getRepository(UserExperienceSkill)
      .findBy({ experienceId });
    expect(skills.map((s) => s.value)).toEqual(['PHP', 'VIVO CMS', 'CMS']);
  });

  it('imports work experience without matched fields', async () => {
    const user = await con.getRepository(User).save({ id: 'user-work-2' });
    const fixture = userExperienceWorkFixture[1];

    const { experienceId } = await importUserExperienceWork({
      data: fixture,
      con: con.manager,
      userId: user.id,
    });
    const experience = await con
      .getRepository(UserExperienceWork)
      .findOne({ where: { id: experienceId } });

    expect(experience).toEqual({
      companyId: null,
      createdAt: expect.any(Date),
      customCompanyName: 'Cover Likers',
      description: 'Backend development using Node.js and databases.',
      employmentType: null,
      endedAt: null,
      id: experienceId,
      locationId: null,
      locationType: null,
      startedAt: new Date('2018-03-01T00:00:00.000Z'),
      subtitle: null,
      title: 'Backend Developer',
      type: 'work',
      updatedAt: expect.any(Date),
      userId: 'user-work-2',
      verified: false,
      flags: {},
    });
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
      flags: {},
    });
  });

  it('imports education experience without matched fields', async () => {
    const user = await con.getRepository(User).save({ id: 'user-education-2' });
    const fixture = userExperienceEducationFixture[1];

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
      userId: 'user-education-2',
      type: 'education',
      title: 'Bachelor of Something',
      subtitle: 'Wow!',
      description: 'General studies with focus on various topics.',
      customCompanyName: 'Unknown University',
      companyId: null,
      startedAt: new Date('2020-01-01T00:00:00.000Z'),
      endedAt: null,
      locationId: null,
      locationType: null,
      grade: null,
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
      flags: {},
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
      flags: {},
    });
  });

  it('imports certification experience without matched fields', async () => {
    const user = await con
      .getRepository(User)
      .save({ id: 'user-certification-2' });
    const fixture = userExperienceCertificationFixture[1];

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
      userId: 'user-certification-2',
      type: 'certification',
      title: 'Advanced Unknown Tech',
      subtitle: null,
      description: null,
      customCompanyName: 'Some Academy',
      companyId: null,
      startedAt: new Date('2022-05-01T00:00:00.000Z'),
      endedAt: null,
      locationId: null,
      locationType: null,
      externalReferenceId: null,
      url: null,
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
      flags: {},
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
      flags: {},
    });
    expect(skills.map((s) => s.value).sort()).toEqual(
      ['GraphQL', 'Node.js'].sort(),
    );
  });

  it('imports project experience without matched fields', async () => {
    const user = await con.getRepository(User).save({ id: 'user-project-2' });
    const fixture = userExperienceProjectFixture[1];

    const { experienceId } = await importUserExperienceProject({
      data: fixture,
      con: con.manager,
      userId: user.id,
    });
    const experience = await con
      .getRepository(UserExperienceProject)
      .findOne({ where: { id: experienceId } });

    expect(experience).toEqual({
      id: experienceId,
      userId: 'user-project-2',
      type: 'project',
      title: 'Mystery App',
      subtitle: null,
      description: 'An app with minimal info.',
      customCompanyName: null,
      companyId: null,
      startedAt: new Date('2023-06-01T00:00:00.000Z'),
      endedAt: null,
      locationId: null,
      locationType: null,
      url: null,
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
      flags: {},
    });
  });
});
