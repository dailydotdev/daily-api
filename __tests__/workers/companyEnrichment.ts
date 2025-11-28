import { DataSource } from 'typeorm';
import nock from 'nock';
import { expectSuccessfulTypedBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/companyEnrichment';
import { User } from '../../src/entity';
import createOrGetConnection from '../../src/db';
import { typedWorkers } from '../../src/workers';
import { usersFixture } from '../fixture';
import { Company, CompanyType } from '../../src/entity/Company';
import { UserExperience } from '../../src/entity/user/experiences/UserExperience';
import { UserExperienceType } from '../../src/entity/user/experiences/types';
import type { AnthropicResponse } from '../../src/integrations/anthropic/types';

const mockCreateMessage = jest.fn();

jest.mock('../../src/integrations/anthropic', () => ({
  ...jest.requireActual('../../src/integrations/anthropic'),
  anthropicClient: {
    createMessage: (...args: unknown[]) => mockCreateMessage(...args),
    garmr: {
      execute: (fn: () => unknown) => fn(),
    },
  },
}));

let con: DataSource;

const mockAnthropicResponse = (
  englishName: string,
  nativeName: string,
  domain: string,
): AnthropicResponse => ({
  id: 'msg_123',
  type: 'message',
  role: 'assistant',
  content: [
    {
      type: 'text',
      text: '',
      input: {
        englishName,
        nativeName,
        domain,
      },
    },
  ],
  model: 'claude-sonnet-4-5-20250929',
  stop_reason: 'end_turn',
  stop_sequence: null,
  usage: {
    input_tokens: 50,
    output_tokens: 30,
  },
});

describe('companyEnrichment worker', () => {
  let experienceId: string;

  beforeAll(async () => {
    con = await createOrGetConnection();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    nock.cleanAll();

    await saveFixtures(con, User, [usersFixture[0]]);

    // Create a test UserExperience
    const experience = await con.getRepository(UserExperience).save({
      userId: '1',
      customCompanyName: 'Test Company',
      companyId: null,
      title: 'Software Engineer',
      subtitle: null,
      description: 'Test description',
      startedAt: new Date('2020-01-01'),
      endedAt: null,
      type: UserExperienceType.Work,
      locationId: null,
      customLocation: {},
      locationType: null,
    });
    experienceId = experience.id;
  });

  afterEach(async () => {
    nock.cleanAll();
    // Need to delete in correct order due to foreign key constraints
    await con
      .getRepository(UserExperience)
      .createQueryBuilder()
      .delete()
      .execute();
    await con.getRepository(Company).createQueryBuilder().delete().execute();
  });

  it('should be registered', () => {
    const registeredWorker = typedWorkers.find(
      (item) => item.subscription === worker.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should skip enrichment when LLM returns no englishName', async () => {
    mockCreateMessage.mockResolvedValue(
      mockAnthropicResponse('', 'テスト', 'example.com'),
    );

    await expectSuccessfulTypedBackground(worker, {
      experienceId,
      customCompanyName: 'Test Company',
      userId: '1',
      experienceType: 'work',
    });

    const companies = await con.getRepository(Company).find();
    expect(companies).toHaveLength(0);
  });

  it('should skip enrichment when LLM returns no domain', async () => {
    mockCreateMessage.mockResolvedValue(
      mockAnthropicResponse('Test Company', 'Test Company', ''),
    );

    await expectSuccessfulTypedBackground(worker, {
      experienceId,
      customCompanyName: 'Test Company',
      userId: '1',
      experienceType: 'work',
    });

    const companies = await con.getRepository(Company).find();
    expect(companies).toHaveLength(0);
  });

  it('should skip enrichment when domain validation fails', async () => {
    mockCreateMessage.mockResolvedValue(
      mockAnthropicResponse(
        'Test Company',
        'Test Company',
        'invalid-domain.xyz',
      ),
    );

    // Mock failed domain validation for both with and without www
    nock('https://invalid-domain.xyz').get('/').reply(404).persist();
    nock('https://www.invalid-domain.xyz').get('/').reply(404).persist();

    await expectSuccessfulTypedBackground(worker, {
      experienceId,
      customCompanyName: 'Test Company',
      userId: '1',
      experienceType: 'work',
    });

    const companies = await con.getRepository(Company).find();
    expect(companies).toHaveLength(0);
  });

  it('should create company and update UserExperience on successful enrichment', async () => {
    mockCreateMessage.mockResolvedValue(
      mockAnthropicResponse('Google', 'Google', 'google.com'),
    );

    // Mock successful domain validation
    nock('https://google.com').get('/').reply(200);

    await expectSuccessfulTypedBackground(worker, {
      experienceId,
      customCompanyName: 'Google Inc',
      userId: '1',
      experienceType: 'work',
    });

    // Verify company was created
    const companies = await con.getRepository(Company).find();
    expect(companies).toHaveLength(1);
    expect(companies[0].name).toBe('Google');
    expect(companies[0].domains).toContain('google.com');
    expect(companies[0].type).toBe(CompanyType.Company);
    expect(companies[0].altName).toBeNull();
    expect(companies[0].image).toContain('google.com');

    // Verify UserExperience was updated
    const experience = await con
      .getRepository(UserExperience)
      .findOneBy({ id: experienceId });
    expect(experience?.companyId).toBe(companies[0].id);
  });

  it('should set altName when nativeName differs from englishName', async () => {
    mockCreateMessage.mockResolvedValue(
      mockAnthropicResponse('Samsung Electronics', '삼성전자', 'samsung.com'),
    );

    nock('https://samsung.com').get('/').reply(200);

    await expectSuccessfulTypedBackground(worker, {
      experienceId,
      customCompanyName: '삼성전자',
      userId: '1',
      experienceType: 'work',
    });

    const companies = await con.getRepository(Company).find();
    expect(companies).toHaveLength(1);
    expect(companies[0].name).toBe('Samsung Electronics');
    expect(companies[0].altName).toBe('삼성전자');
  });

  it('should set company type to School for education experiences', async () => {
    // Update the experience to be education type
    await con
      .getRepository(UserExperience)
      .update({ id: experienceId }, { type: UserExperienceType.Education });

    mockCreateMessage.mockResolvedValue(
      mockAnthropicResponse('MIT', 'MIT', 'mit.edu'),
    );

    nock('https://mit.edu').get('/').reply(200);

    await expectSuccessfulTypedBackground(worker, {
      experienceId,
      customCompanyName: 'MIT',
      userId: '1',
      experienceType: 'education',
    });

    const companies = await con.getRepository(Company).find();
    expect(companies).toHaveLength(1);
    expect(companies[0].type).toBe(CompanyType.School);
  });

  it('should link to existing company if domain already exists', async () => {
    // Create an existing company with the domain
    const existingCompany = await con.getRepository(Company).save({
      id: 'existing-google',
      name: 'Google LLC',
      image: 'https://example.com/google.png',
      domains: ['google.com', 'alphabet.com'],
      type: CompanyType.Company,
    });

    mockCreateMessage.mockResolvedValue(
      mockAnthropicResponse('Google', 'Google', 'google.com'),
    );

    nock('https://google.com').get('/').reply(200);

    await expectSuccessfulTypedBackground(worker, {
      experienceId,
      customCompanyName: 'Google Inc',
      userId: '1',
      experienceType: 'work',
    });

    // Should not create a new company
    const companies = await con.getRepository(Company).find();
    expect(companies).toHaveLength(1);
    expect(companies[0].id).toBe('existing-google');

    // Should link to existing company
    const experience = await con
      .getRepository(UserExperience)
      .findOneBy({ id: experienceId });
    expect(experience?.companyId).toBe(existingCompany.id);
  });

  it('should create new company if domain does not exist in any company', async () => {
    // Create an existing company with a different domain
    await con.getRepository(Company).save({
      id: 'existing-microsoft',
      name: 'Microsoft',
      image: 'https://example.com/microsoft.png',
      domains: ['microsoft.com'],
      type: CompanyType.Company,
    });

    mockCreateMessage.mockResolvedValue(
      mockAnthropicResponse('Google', 'Google', 'google.com'),
    );

    nock('https://google.com').get('/').reply(200);

    await expectSuccessfulTypedBackground(worker, {
      experienceId,
      customCompanyName: 'Google Inc',
      userId: '1',
      experienceType: 'work',
    });

    // Should create a new company (2 total now)
    const companies = await con.getRepository(Company).find();
    expect(companies).toHaveLength(2);

    // The new company should have google.com domain
    const googleCompany = companies.find((c) =>
      c.domains.includes('google.com'),
    );
    expect(googleCompany).toBeDefined();
    expect(googleCompany?.name).toBe('Google');

    // Should link to the new company
    const experience = await con
      .getRepository(UserExperience)
      .findOneBy({ id: experienceId });
    expect(experience?.companyId).toBe(googleCompany?.id);
  });

  it('should try www subdomain if primary domain fails', async () => {
    mockCreateMessage.mockResolvedValue(
      mockAnthropicResponse('Example Corp', 'Example Corp', 'example.com'),
    );

    // Primary domain fails, www succeeds
    nock('https://example.com').get('/').reply(404);
    nock('https://www.example.com').get('/').reply(200);

    await expectSuccessfulTypedBackground(worker, {
      experienceId,
      customCompanyName: 'Example Corp',
      userId: '1',
      experienceType: 'work',
    });

    const companies = await con.getRepository(Company).find();
    expect(companies).toHaveLength(1);
    expect(companies[0].domains).toContain('www.example.com');
  });

  it('should use www domain if provided and works', async () => {
    mockCreateMessage.mockResolvedValue(
      mockAnthropicResponse('Example Corp', 'Example Corp', 'www.example.com'),
    );

    // www domain provided and works
    nock('https://www.example.com').get('/').reply(200);

    await expectSuccessfulTypedBackground(worker, {
      experienceId,
      customCompanyName: 'Example Corp',
      userId: '1',
      experienceType: 'work',
    });

    const companies = await con.getRepository(Company).find();
    expect(companies).toHaveLength(1);
    expect(companies[0].domains).toContain('www.example.com');
  });

  it('should generate Google favicon URL for company image', async () => {
    mockCreateMessage.mockResolvedValue(
      mockAnthropicResponse('Test Corp', 'Test Corp', 'testcorp.com'),
    );

    nock('https://testcorp.com').get('/').reply(200);

    await expectSuccessfulTypedBackground(worker, {
      experienceId,
      customCompanyName: 'Test Corp',
      userId: '1',
      experienceType: 'work',
    });

    const companies = await con.getRepository(Company).find();
    expect(companies).toHaveLength(1);
    expect(companies[0].image).toBe(
      'https://www.google.com/s2/favicons?domain=testcorp.com&sz=128',
    );
  });

  it('should call Anthropic API with correct parameters', async () => {
    mockCreateMessage.mockResolvedValue(
      mockAnthropicResponse('Test', 'Test', 'test.com'),
    );

    nock('https://test.com').get('/').reply(200);

    await expectSuccessfulTypedBackground(worker, {
      experienceId,
      customCompanyName: 'My Custom Company Name',
      userId: '1',
      experienceType: 'work',
    });

    expect(mockCreateMessage).toHaveBeenCalledWith({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      system: expect.stringContaining('organization'),
      messages: [
        {
          role: 'user',
          content: 'My Custom Company Name',
        },
      ],
      tools: expect.arrayContaining([
        expect.objectContaining({
          name: 'organization_info',
        }),
      ]),
      tool_choice: {
        type: 'tool',
        name: 'organization_info',
      },
    });
  });

  it('should not retry on SSL certificate errors', async () => {
    mockCreateMessage.mockResolvedValue(
      mockAnthropicResponse('Test Corp', 'Test Corp', 'badssl.com'),
    );

    // Simulate SSL certificate error
    nock('https://badssl.com')
      .get('/')
      .replyWithError({ message: 'certificate has expired' });

    // The www variant should also fail with SSL error
    nock('https://www.badssl.com')
      .get('/')
      .replyWithError({ message: 'certificate has expired' });

    await expectSuccessfulTypedBackground(worker, {
      experienceId,
      customCompanyName: 'Test Corp',
      userId: '1',
      experienceType: 'work',
    });

    // Company should not be created due to SSL errors
    const companies = await con.getRepository(Company).find();
    expect(companies).toHaveLength(0);
  });

  it('should not set altName when nativeName is null', async () => {
    mockCreateMessage.mockResolvedValue({
      id: 'msg_123',
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: '',
          input: {
            englishName: 'Test Corp',
            nativeName: null,
            domain: 'testcorp.com',
          },
        },
      ],
      model: 'claude-sonnet-4-5-20250929',
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: 50,
        output_tokens: 30,
      },
    });

    nock('https://testcorp.com').get('/').reply(200);

    await expectSuccessfulTypedBackground(worker, {
      experienceId,
      customCompanyName: 'Test Corp',
      userId: '1',
      experienceType: 'work',
    });

    const companies = await con.getRepository(Company).find();
    expect(companies).toHaveLength(1);
    expect(companies[0].altName).toBeNull();
  });

  it('should use non-www domain when www fails but non-www succeeds', async () => {
    mockCreateMessage.mockResolvedValue(
      mockAnthropicResponse('Example Corp', 'Example Corp', 'www.example.com'),
    );

    // www domain fails, non-www succeeds
    nock('https://www.example.com').get('/').reply(404);
    nock('https://example.com').get('/').reply(200);

    await expectSuccessfulTypedBackground(worker, {
      experienceId,
      customCompanyName: 'Example Corp',
      userId: '1',
      experienceType: 'work',
    });

    const companies = await con.getRepository(Company).find();
    expect(companies).toHaveLength(1);
    expect(companies[0].domains).toContain('example.com');
  });
});
