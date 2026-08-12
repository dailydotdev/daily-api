import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { crons } from '../../src/cron/index';
import cron from '../../src/cron/backfillExperienceCompany';
import { expectSuccessfulCron, saveFixtures } from '../helpers';
import { User } from '../../src/entity/user/User';
import { Company } from '../../src/entity/Company';
import { UserExperience } from '../../src/entity/user/experiences/UserExperience';
import { UserExperienceWork } from '../../src/entity/user/experiences/UserExperienceWork';
import { UserExperienceType } from '../../src/entity/user/experiences/types';
import { usersFixture } from '../fixture/user';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  await con
    .getRepository(UserExperience)
    .createQueryBuilder()
    .delete()
    .execute();
  await saveFixtures(con, User, [usersFixture[0]]);
  await saveFixtures(con, Company, [
    {
      id: 'lpu',
      name: 'Lovely Professional University',
      image: 'https://daily.dev/lpu.png',
      domains: ['lpu.in'],
    },
    {
      id: 'freelance-co',
      name: 'Freelance',
      image: 'https://daily.dev/freelance.png',
      domains: ['freelance.com'],
    },
  ]);
});

const saveExperience = (customCompanyName: string) =>
  con.getRepository(UserExperienceWork).save({
    userId: '1',
    title: 'Software Engineer',
    startedAt: new Date('2020-01-01'),
    type: UserExperienceType.Work,
    verified: false,
    customCompanyName,
    companyId: null,
  });

const companyIdOf = async (id: string) =>
  (await con.getRepository(UserExperience).findOneByOrFail({ id })).companyId;

describe('backfillExperienceCompany cron', () => {
  it('should be registered', () => {
    expect(crons.find((item) => item.name === cron.name)).toBeDefined();
  });

  it('links experiences whose custom name matches a company, case-insensitively', async () => {
    const exact = await saveExperience('Lovely Professional University');
    const cased = await saveExperience('  lovely professional university ');

    await expectSuccessfulCron(cron);

    expect(await companyIdOf(exact.id)).toBe('lpu');
    expect(await companyIdOf(cased.id)).toBe('lpu');
  });

  it('does not attach self-employed people to the Freelance company', async () => {
    const freelance = await saveExperience('Freelance');
    const selfEmployed = await saveExperience('freelance | self-employed');

    await expectSuccessfulCron(cron);

    expect(await companyIdOf(freelance.id)).toBeNull();
    expect(await companyIdOf(selfEmployed.id)).toBeNull();
  });

  it('leaves unmatched names alone and is rerunnable', async () => {
    const unmatched = await saveExperience('Some Company We Do Not Have');
    const matched = await saveExperience('Lovely Professional University');

    await expectSuccessfulCron(cron);
    await expectSuccessfulCron(cron);

    expect(await companyIdOf(unmatched.id)).toBeNull();
    expect(await companyIdOf(matched.id)).toBe('lpu');
  });
});
