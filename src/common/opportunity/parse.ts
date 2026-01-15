import z from 'zod';
import { FastifyBaseLogger } from 'fastify';
import { DataSource, DeepPartial, IsNull, Not } from 'typeorm';
import { fileTypeFromBuffer } from 'file-type';
import {
  LocationType,
  OpportunityContent,
  OpportunityState,
  BrokkrParseRequest,
  FileBlob,
} from '@dailydotdev/schema';

import { getBufferFromStream } from '../utils';
import { ValidationError } from 'apollo-server-errors';
import { garmScraperService } from '../scraper';
import {
  acceptedOpportunityFileTypes,
  opportunityMatchBatchSize,
} from '../../types';
import { getBrokkrClient } from '../brokkr';
import { opportunityCreateParseSchema } from '../schema/opportunities';
import { markdown } from '../markdown';
import { OpportunityJob } from '../../entity/opportunities/OpportunityJob';
import { OpportunityLocation } from '../../entity/opportunities/OpportunityLocation';
import { OpportunityKeyword } from '../../entity/OpportunityKeyword';
import { findDatasetLocation } from '../../entity/dataset/utils';
import { addOpportunityDefaultQuestionFeedback } from './question';
import type { Opportunity } from '../../entity/opportunities/Opportunity';
import { EntityManager } from 'typeorm';
import { logger } from '../../logger';
import { randomUUID } from 'node:crypto';

interface FileUpload {
  filename: string;
  createReadStream: () => NodeJS.ReadableStream;
}

export interface ParseOpportunityPayload {
  url?: string;
  file?: Promise<FileUpload>;
}

export interface OpportunityFileBufferResult {
  buffer: Buffer;
  extension: string;
}

export interface OpportunityFileValidationResult {
  mime: string;
}

export interface ParsedOpportunityResult {
  opportunity: z.infer<typeof opportunityCreateParseSchema>;
  content: OpportunityContent;
}

export interface ParseOpportunityContext {
  con: DataSource;
  userId?: string;
  trackingId?: string;
  log: FastifyBaseLogger;
}

/**
 * Fetches opportunity content from a URL and converts it to a PDF buffer
 */
async function fetchOpportunityFromUrl(url: string): Promise<Buffer> {
  const response = await garmScraperService.execute(async () => {
    const response = await fetch(`${process.env.SCRAPER_URL}/pdf`, {
      method: 'POST',
      body: JSON.stringify({ url }),
      headers: { 'content-type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch job from URL');
    }

    return response;
  });

  return Buffer.from(await response.arrayBuffer());
}

/**
 * Gets the opportunity file buffer from either a URL or file upload
 *
 * @param payload - The parsed opportunity payload containing either url or file
 * @returns The file buffer and its extension
 */
export async function getOpportunityFileBuffer(
  payload: ParseOpportunityPayload,
): Promise<OpportunityFileBufferResult> {
  if (payload.url) {
    const buffer = await fetchOpportunityFromUrl(payload.url);
    return { buffer, extension: 'pdf' };
  }

  if (!payload.file) {
    throw new ValidationError('Either url or file must be provided');
  }

  const fileUpload = await payload.file;
  const extension =
    fileUpload.filename?.split('.')?.pop()?.toLowerCase() || 'pdf';
  const buffer = await getBufferFromStream(fileUpload.createReadStream());

  return { buffer, extension };
}

/**
 * Validates the opportunity file type against accepted types
 *
 * @param buffer - The file buffer to validate
 * @param extension - The file extension
 * @returns The validated MIME type
 * @throws ValidationError if file type is not supported
 */
export async function validateOpportunityFileType(
  buffer: Buffer,
  extension: string,
): Promise<OpportunityFileValidationResult> {
  const supportedFileType = acceptedOpportunityFileTypes.find(
    (type) => type.ext === extension,
  );

  if (!supportedFileType) {
    throw new ValidationError('File extension not supported');
  }

  const fileType = await fileTypeFromBuffer(buffer);

  if (supportedFileType.mime !== fileType?.mime) {
    throw new ValidationError('File type not supported');
  }

  return { mime: fileType.mime };
}

/**
 * Renders markdown content for opportunity fields
 */
function renderOpportunityMarkdownContent(
  content: Record<string, { content?: string }> | undefined,
): OpportunityContent {
  const renderedContent: Record<string, { content: string; html: string }> = {};

  Object.entries(content || {}).forEach(([key, value]) => {
    if (typeof value?.content !== 'string') {
      return;
    }

    renderedContent[key] = {
      content: value.content,
      html: markdown.render(value.content),
    };
  });

  return new OpportunityContent(renderedContent);
}

/**
 * Parses an opportunity file using the Brokkr service
 *
 * Handles:
 * - Sending the file blob to Brokkr for parsing
 * - Rendering markdown content
 *
 * @export
 * @param {{
 *   buffer: Buffer;
 *   mime: string;
 *   extension: string;
 *   opportunityId?: string;
 * }} {
 *   buffer,
 *   mime,
 *   extension,
 *   opportunityId
 * }
 * @return {*}  {Promise<ParsedOpportunityResult>}
 */
export async function parseOpportunityWithBrokkr({
  buffer,
  mime,
  extension,
  opportunityId,
}: {
  buffer: Buffer;
  mime: string;
  extension: string;
  opportunityId?: string;
}): Promise<ParsedOpportunityResult> {
  const filename = `job-opportunity-parse-${opportunityId || randomUUID()}.pdf`;

  const brokkrClient = getBrokkrClient();

  const result = await brokkrClient.garmr.execute(() => {
    return brokkrClient.instance.parseOpportunity(
      new BrokkrParseRequest({
        blobName: filename,
        blob: new FileBlob({
          mime,
          ext: extension,
          content: buffer,
        }),
      }),
    );
  });

  logger.info(result, 'brokkrParseOpportunityResponse');

  // Sanitize Brokkr response - filter out invalid locations
  const sanitizedOpportunity = {
    ...result.opportunity,
    location: Array.isArray(result.opportunity?.location)
      ? result.opportunity.location
          .map((loc) => {
            if (
              !loc.country &&
              loc.continent?.toLowerCase().trim() === 'europe'
            ) {
              return {
                continent: 'Europe',
                country: undefined,
                iso2: undefined,
              };
            }

            // Jobs may indicate Remote Europe with no country
            if (!loc?.country?.trim() && loc?.continent?.trim()) {
              return {
                ...loc,
                country: loc?.continent,
              };
            }
            return loc;
          })
          .filter((loc) => {
            const isContinent = loc.continent && !loc.country && !loc.iso2;

            // continent has specific handling in gondul and does not have iso2 code
            if (isContinent) {
              return true;
            }

            // Only keep locations with valid country and iso2
            // Both are required for downstream processing in gondul
            return (
              loc?.country &&
              loc.country.trim().length > 0 &&
              loc?.iso2 &&
              loc.iso2.trim().length > 0
            );
          })
      : [],
  };

  const parsedOpportunity =
    await opportunityCreateParseSchema.parseAsync(sanitizedOpportunity);

  const content = renderOpportunityMarkdownContent(parsedOpportunity.content);

  return {
    opportunity: parsedOpportunity,
    content,
  };
}

/**
 * Creates or updates an opportunity and all related entities from parsed data
 *
 * Handles:
 * - Creating or updating the opportunity record
 * - Creating location relationships
 * - Creating keywords
 * - Adding default feedback questions
 * - Assigning recruiter (if userId provided)
 * - Associating with existing organization (if user has one)
 *
 * @param ctx - Context with database connection and user info
 * @param parsedData - The parsed opportunity data from Brokkr
 * @param opportunityId - Optional ID of existing opportunity to update (for async worker flow)
 * @returns The created or updated opportunity
 */
export async function createOpportunityFromParsedData(
  ctx: ParseOpportunityContext,
  parsedData: ParsedOpportunityResult,
  opportunityId?: string,
): Promise<OpportunityJob> {
  const { opportunity: parsedOpportunity, content } = parsedData;
  const locationData = parsedOpportunity.location || [];

  return ctx.con.transaction(async (entityManager) => {
    const flags: Opportunity['flags'] = {};

    if (!ctx.userId) {
      flags.anonUserId = ctx.trackingId;
    }

    flags.batchSize = opportunityMatchBatchSize;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { location, ...opportunityData } = parsedOpportunity;

    // Associate with existing organization if user has one
    if (ctx.userId) {
      const existingOrganizationOpportunity: Pick<
        OpportunityJob,
        'id' | 'organizationId'
      > | null = await entityManager.getRepository(OpportunityJob).findOne({
        select: ['id', 'organizationId'],
        where: {
          users: {
            userId: ctx.userId,
          },
          organizationId: Not(IsNull()),
        },
      });

      if (existingOrganizationOpportunity) {
        opportunityData.organizationId =
          existingOrganizationOpportunity.organizationId;
      }
    }

    const opportunity = await entityManager.getRepository(OpportunityJob).save(
      entityManager.getRepository(OpportunityJob).create({
        id: opportunityId,
        ...opportunityData,
        state: OpportunityState.DRAFT,
        content,
        flags,
      } as DeepPartial<OpportunityJob>),
    );

    // Create location entries
    for (const loc of locationData) {
      const datasetLocation = await findDatasetLocation(ctx.con, loc);

      if (datasetLocation) {
        await entityManager.getRepository(OpportunityLocation).save({
          opportunityId: opportunity.id,
          locationId: datasetLocation.id,
          type: loc.type || LocationType.REMOTE,
        });
      }
    }

    await addOpportunityDefaultQuestionFeedback({
      entityManager,
      opportunityId: opportunity.id,
    });

    if (parsedOpportunity.keywords) {
      await entityManager.getRepository(OpportunityKeyword).insert(
        parsedOpportunity.keywords.map((keyword) => ({
          opportunityId: opportunity.id,
          keyword: keyword.keyword,
        })),
      );
    }

    return opportunity;
  });
}

export interface UpdateOpportunityContext {
  con: DataSource;
  log: FastifyBaseLogger;
}

/**
 * Handles opportunity keywords updates
 * Replaces all existing keywords with the new set
 */
export async function handleOpportunityKeywordsUpdate(
  entityManager: EntityManager,
  opportunityId: string,
  keywords: Array<{ keyword: string }> | undefined,
): Promise<void> {
  if (!Array.isArray(keywords)) {
    return;
  }

  await entityManager.getRepository(OpportunityKeyword).delete({
    opportunityId,
  });

  await entityManager.getRepository(OpportunityKeyword).insert(
    keywords.map((keyword) => ({
      opportunityId,
      keyword: keyword.keyword,
    })),
  );
}

/**
 * Updates an existing opportunity with all parsed data.
 *
 * @param ctx - Context with database connection and logger
 * @param opportunityId - ID of the opportunity to update
 * @param parsedData - The parsed opportunity data from Brokkr
 * @returns The opportunity ID
 */
export async function updateOpportunityFromParsedData(
  ctx: UpdateOpportunityContext,
  opportunityId: string,
  parsedData: ParsedOpportunityResult,
): Promise<string> {
  const { opportunity: parsedOpportunity, content } = parsedData;

  return ctx.con.transaction(async (entityManager) => {
    // Fetch the existing opportunity
    const existingOpportunity = await entityManager
      .getRepository(OpportunityJob)
      .findOne({
        where: { id: opportunityId },
      });

    if (!existingOpportunity) {
      throw new ValidationError('Opportunity not found');
    }

    // Build update object with all parsed data
    const updateData: Partial<OpportunityJob> = {};

    if (parsedOpportunity.title) {
      updateData.title = parsedOpportunity.title;
    }

    if (parsedOpportunity.tldr) {
      updateData.tldr = parsedOpportunity.tldr;
    }

    // Update content - merge with existing to preserve any sections not in parsed data
    // Explicitly list content block keys to avoid iterating over protobuf methods
    const contentBlockKeys = [
      'overview',
      'responsibilities',
      'requirements',
      'whatYoullDo',
      'interviewProcess',
    ] as const;
    const mergedContent: Partial<OpportunityContent> = {};
    for (const key of contentBlockKeys) {
      if (content[key]) {
        mergedContent[key] = content[key];
      }
    }
    updateData.content = {
      ...existingOpportunity.content,
      ...mergedContent,
    } as OpportunityContent;

    // Update the opportunity
    if (Object.keys(updateData).length > 0) {
      await entityManager
        .getRepository(OpportunityJob)
        .update({ id: opportunityId }, updateData);
    }

    // Update keywords if present in parsed data
    if (parsedOpportunity.keywords?.length) {
      await handleOpportunityKeywordsUpdate(
        entityManager,
        opportunityId,
        parsedOpportunity.keywords,
      );
    }

    // Return the opportunity ID
    return opportunityId;
  });
}
