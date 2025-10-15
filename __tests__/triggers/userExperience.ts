import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { saveFixtures } from '../helpers';
import { User, UserCompany } from '../../src/entity';
import { UserExperienceWork } from '../../src/entity/user/experiences/UserExperienceWork';
import { UserExperienceType } from '../../src/entity/user/experiences/types';
import { usersFixture } from '../fixture/user';
import { Company } from '../../src/entity/Company';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, User, usersFixture);

  // Create test companies
  await saveFixtures(con, Company, [
    {
      id: 'company-1',
      name: 'Test Company 1',
      image: 'https://example.com/company1.jpg',
      domains: ['company1.com'],
    },
    {
      id: 'company-2',
      name: 'Test Company 2',
      image: 'https://example.com/company2.jpg',
      domains: ['company2.com'],
    },
  ]);
});

describe('trigger_user_experience_before_insert', () => {
  it('should set verified to true when inserting work experience with verified user_company', async () => {
    // Create a verified user_company entry
    await con.getRepository(UserCompany).insert({
      userId: '1',
      email: 'user1@company1.com',
      code: 'test-code',
      companyId: 'company-1',
      verified: true,
    });

    // Insert a work experience
    await con.getRepository(UserExperienceWork).insert({
      userId: '1',
      companyId: 'company-1',
      title: 'Software Engineer',
      startedAt: new Date('2020-01-01'),
      type: UserExperienceType.Work,
    });

    // Check that the experience was set to verified
    const experience = await con
      .getRepository(UserExperienceWork)
      .findOneByOrFail({ userId: '1', companyId: 'company-1' });

    expect(experience.verified).toBe(true);
  });

  it('should keep verified false when inserting work experience without verified user_company', async () => {
    // Create an unverified user_company entry
    await con.getRepository(UserCompany).insert({
      userId: '1',
      email: 'user1@company1.com',
      code: 'test-code',
      companyId: 'company-1',
      verified: false,
    });

    // Insert a work experience
    await con.getRepository(UserExperienceWork).insert({
      userId: '1',
      companyId: 'company-1',
      title: 'Software Engineer',
      startedAt: new Date('2020-01-01'),
      type: UserExperienceType.Work,
    });

    // Check that the experience was not verified
    const experience = await con
      .getRepository(UserExperienceWork)
      .findOneByOrFail({ userId: '1', companyId: 'company-1' });

    expect(experience.verified).toBe(false);
  });

  it('should keep verified false when inserting work experience without any user_company', async () => {
    // Insert a work experience without any user_company
    await con.getRepository(UserExperienceWork).insert({
      userId: '1',
      companyId: 'company-1',
      title: 'Software Engineer',
      startedAt: new Date('2020-01-01'),
      type: UserExperienceType.Work,
    });

    // Check that the experience was not verified
    const experience = await con
      .getRepository(UserExperienceWork)
      .findOneByOrFail({ userId: '1', companyId: 'company-1' });

    expect(experience.verified).toBe(false);
  });

  it('should keep verified false when inserting work experience without companyId', async () => {
    // Insert a work experience without companyId
    const work = await con.getRepository(UserExperienceWork).insert({
      userId: '1',
      companyId: null,
      customCompanyName: 'Some Company',
      title: 'Software Engineer',
      startedAt: new Date('2020-01-01'),
      type: UserExperienceType.Work,
    });

    // Check that the experience was not verified
    const experience = await con
      .getRepository(UserExperienceWork)
      .findOneByOrFail({ id: work.identifiers[0].id });

    expect(experience.verified).toBe(false);
  });

  it('should verify only matching user and company combinations', async () => {
    // Create verified user_company for user 1 and company 1
    await con.getRepository(UserCompany).insert({
      userId: '1',
      email: 'user1@company1.com',
      code: 'test-code',
      companyId: 'company-1',
      verified: true,
    });

    // Insert work experience for user 2 with company 1 (should not be verified)
    await con.getRepository(UserExperienceWork).insert({
      userId: '2',
      companyId: 'company-1',
      title: 'Software Engineer',
      startedAt: new Date('2020-01-01'),
      type: UserExperienceType.Work,
    });

    // Check that user 2's experience was not verified
    const experience = await con
      .getRepository(UserExperienceWork)
      .findOneByOrFail({ userId: '2', companyId: 'company-1' });

    expect(experience.verified).toBe(false);
  });
});

describe('trigger_user_experience_before_update', () => {
  it('should set verified to false when companyId is updated to null', async () => {
    // Create a verified user_company entry
    await con.getRepository(UserCompany).insert({
      userId: '1',
      email: 'user1@company1.com',
      code: 'test-code',
      companyId: 'company-1',
      verified: true,
    });

    // Insert a work experience
    const result = await con.getRepository(UserExperienceWork).insert({
      userId: '1',
      companyId: 'company-1',
      title: 'Software Engineer',
      startedAt: new Date('2020-01-01'),
      type: UserExperienceType.Work,
    });

    const experienceId = result.identifiers[0].id;

    // Verify it's initially verified
    const experience = await con
      .getRepository(UserExperienceWork)
      .findOneByOrFail({ id: experienceId });
    expect(experience.verified).toBe(true);

    // Update companyId to null
    await con
      .getRepository(UserExperienceWork)
      .update({ id: experienceId }, { companyId: null });

    // Check that verified is now false
    const updated = await con
      .getRepository(UserExperienceWork)
      .findOneByOrFail({ id: experienceId });
    expect(updated.companyId).toBeNull();
    expect(updated.verified).toBe(false);
  });

  it('should set verified to true when companyId is updated to a verified company', async () => {
    // Create verified user_company entries for both companies
    await con.getRepository(UserCompany).insert([
      {
        userId: '1',
        email: 'user1@company1.com',
        code: 'test-code-1',
        companyId: 'company-1',
        verified: false,
      },
      {
        userId: '1',
        email: 'user1@company2.com',
        code: 'test-code-2',
        companyId: 'company-2',
        verified: true,
      },
    ]);

    // Insert a work experience with company-1
    const result = await con.getRepository(UserExperienceWork).insert({
      userId: '1',
      companyId: 'company-1',
      title: 'Software Engineer',
      startedAt: new Date('2020-01-01'),
      type: UserExperienceType.Work,
    });

    const experienceId = result.identifiers[0].id;

    // Verify it's initially not verified
    let experience = await con
      .getRepository(UserExperienceWork)
      .findOneByOrFail({ id: experienceId });
    expect(experience.verified).toBe(false);

    // Update companyId to company-2 (which has verified user_company)
    await con
      .getRepository(UserExperienceWork)
      .update({ id: experienceId }, { companyId: 'company-2' });

    // Check that verified is now true
    experience = await con
      .getRepository(UserExperienceWork)
      .findOneByOrFail({ id: experienceId });
    expect(experience.verified).toBe(true);
  });

  it('should set verified to false when companyId is updated to an unverified company', async () => {
    // Create verified user_company entries for both companies
    await con.getRepository(UserCompany).insert([
      {
        userId: '1',
        email: 'user1@company1.com',
        code: 'test-code-1',
        companyId: 'company-1',
        verified: true,
      },
      {
        userId: '1',
        email: 'user1@company2.com',
        code: 'test-code-2',
        companyId: 'company-2',
        verified: false,
      },
    ]);

    // Insert a work experience with company-1
    const result = await con.getRepository(UserExperienceWork).insert({
      userId: '1',
      companyId: 'company-1',
      title: 'Software Engineer',
      startedAt: new Date('2020-01-01'),
      type: UserExperienceType.Work,
    });

    const experienceId = result.identifiers[0].id;

    // Verify it's initially verified
    let experience = await con
      .getRepository(UserExperienceWork)
      .findOneByOrFail({ id: experienceId });
    expect(experience.verified).toBe(true);

    // Update companyId to company-2 (which has unverified user_company)
    await con
      .getRepository(UserExperienceWork)
      .update({ id: experienceId }, { companyId: 'company-2' });

    // Check that verified is now false
    experience = await con
      .getRepository(UserExperienceWork)
      .findOneByOrFail({ id: experienceId });
    expect(experience.verified).toBe(false);
  });

  it('should not trigger when companyId is not changed', async () => {
    // Create a verified user_company entry
    await con.getRepository(UserCompany).insert({
      userId: '1',
      email: 'user1@company1.com',
      code: 'test-code',
      companyId: 'company-1',
      verified: true,
    });

    // Insert a work experience
    const result = await con.getRepository(UserExperienceWork).insert({
      userId: '1',
      companyId: 'company-1',
      title: 'Software Engineer',
      startedAt: new Date('2020-01-01'),
      type: UserExperienceType.Work,
    });

    const experienceId = result.identifiers[0].id;

    // Verify it's initially verified
    let experience = await con
      .getRepository(UserExperienceWork)
      .findOneByOrFail({ id: experienceId });
    expect(experience.verified).toBe(true);

    // Update title (not companyId)
    await con
      .getRepository(UserExperienceWork)
      .update({ id: experienceId }, { title: 'Senior Software Engineer' });

    // Check that verified is still true
    experience = await con
      .getRepository(UserExperienceWork)
      .findOneByOrFail({ id: experienceId });
    expect(experience.verified).toBe(true);
    expect(experience.title).toBe('Senior Software Engineer');
  });

  it('should handle update from null companyId to verified company', async () => {
    // Create verified user_company
    await con.getRepository(UserCompany).insert({
      userId: '1',
      email: 'user1@company1.com',
      code: 'test-code',
      companyId: 'company-1',
      verified: true,
    });

    // Insert a work experience with null companyId
    const result = await con.getRepository(UserExperienceWork).insert({
      userId: '1',
      companyId: null,
      customCompanyName: 'Some Company',
      title: 'Software Engineer',
      startedAt: new Date('2020-01-01'),
      type: UserExperienceType.Work,
    });

    const experienceId = result.identifiers[0].id;

    // Verify it's initially not verified
    let experience = await con
      .getRepository(UserExperienceWork)
      .findOneByOrFail({ id: experienceId });
    expect(experience.verified).toBe(false);

    // Update companyId to company-1 (which has verified user_company)
    await con
      .getRepository(UserExperienceWork)
      .update({ id: experienceId }, { companyId: 'company-1' });

    // Check that verified is now true
    experience = await con
      .getRepository(UserExperienceWork)
      .findOneByOrFail({ id: experienceId });
    expect(experience.verified).toBe(true);
  });
});
