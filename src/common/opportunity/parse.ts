import z from 'zod';
import { randomUUID } from 'node:crypto';
import { Storage } from '@google-cloud/storage';
import { FastifyBaseLogger } from 'fastify';
import { DataSource, DeepPartial, IsNull, Not } from 'typeorm';
import { fileTypeFromBuffer } from 'file-type';
import {
  LocationType,
  OpportunityContent,
  OpportunityState,
  BrokkrParseRequest,
} from '@dailydotdev/schema';

import { getBufferFromStream } from '../utils';
import { ValidationError } from 'apollo-server-errors';
import { garmScraperService } from '../scraper';
import {
  acceptedOpportunityFileTypes,
  opportunityMatchBatchSize,
} from '../../types';
import { RESUME_BUCKET_NAME } from '../../config';
import { deleteFileFromBucket, uploadResumeFromBuffer } from '../googleCloud';
import { getBrokkrClient } from '../brokkr';
import { opportunityCreateParseSchema } from '../schema/opportunities';
import { markdown } from '../markdown';
import { OpportunityJob } from '../../entity/opportunities/OpportunityJob';
import { OpportunityLocation } from '../../entity/opportunities/OpportunityLocation';
import { OpportunityKeyword } from '../../entity/OpportunityKeyword';
import { OpportunityUserRecruiter } from '../../entity/opportunities/user/OpportunityUserRecruiter';
import { findDatasetLocation } from '../../entity/dataset/utils';
import { addOpportunityDefaultQuestionFeedback } from './question';
import type { Opportunity } from '../../entity/opportunities/Opportunity';

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
 * - Uploading file to GCS
 * - Calling Brokkr to parse the opportunity
 * - Cleaning up the uploaded file
 * - Rendering markdown content
 *
 * @param buffer - The file buffer to parse
 * @param mime - The MIME type of the file
 * @param log - Logger instance for debugging
 * @returns The parsed opportunity data with rendered content
 */
export async function parseOpportunityWithBrokkr(
  buffer: Buffer,
  mime: string,
  log: FastifyBaseLogger,
): Promise<ParsedOpportunityResult> {
  const filename = `job-opportunity-${randomUUID()}.pdf`;

  try {
    await uploadResumeFromBuffer(filename, buffer, {
      contentType: mime,
    });

    const brokkrClient = getBrokkrClient();

    const result = await brokkrClient.garmr.execute(() => {
      return brokkrClient.instance.parseOpportunity(
        new BrokkrParseRequest({
          bucketName: RESUME_BUCKET_NAME,
          blobName: filename,
        }),
      );
    });

    log.info(result, 'brokkrParseOpportunityResponse');

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
                  ...loc,
                  country: 'Europe',
                  iso2: 'EU',
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
              // Only keep locations with valid country
              return loc?.country && loc.country.trim().length > 0;
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
  } finally {
    const storage = new Storage();
    const bucket = storage.bucket(RESUME_BUCKET_NAME);
    await deleteFileFromBucket(bucket, filename);
  }
}

/**
 * Creates an opportunity and all related entities from parsed data
 *
 * Handles:
 * - Creating the opportunity record
 * - Creating location relationships
 * - Creating keywords
 * - Adding default feedback questions
 * - Assigning recruiter (if userId provided)
 * - Associating with existing organization (if user has one)
 *
 * @param ctx - Context with database connection and user info
 * @param parsedData - The parsed opportunity data from Brokkr
 * @returns The created opportunity
 */
export async function createOpportunityFromParsedData(
  ctx: ParseOpportunityContext,
  parsedData: ParsedOpportunityResult,
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

    if (ctx.userId) {
      await entityManager.getRepository(OpportunityUserRecruiter).insert(
        entityManager.getRepository(OpportunityUserRecruiter).create({
          opportunityId: opportunity.id,
          userId: ctx.userId,
        }),
      );
    }

    return opportunity;
  });
}
