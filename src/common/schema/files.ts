import z from 'zod';
import { Readable } from 'node:stream';
import { getBufferFromStream } from '../utils';
import { fileTypeFromBuffer } from 'file-type';
import { defineAcceptedFilesMap, type AcceptedFilesMap } from '../../types';
import { isNullOrUndefined } from '../object';
import { GQL_MAX_FILE_SIZE } from '../../config';

export const acceptedResumeFiles = defineAcceptedFilesMap({
  pdf: { mime: ['application/pdf'] },
  docx: {
    mime: [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  },
});

export const acceptedEmploymentAgreementFiles = defineAcceptedFilesMap({
  pdf: { mime: ['application/pdf'] },
});

/**
 * Creates a file schema with optional restrictions on accepted file types.
 *
 * @param acceptedFilesMap - Optional map of accepted file extensions to their corresponding MIME types.
 * @returns A Zod schema for validating file uploads.
 */
export const createFileSchema = (acceptedFilesMap?: AcceptedFilesMap) => {
  const getSupportedMimesForExt = (
    map: AcceptedFilesMap,
    ext?: string,
  ): string[] | null => {
    if (!ext) return null;
    const entry = map[ext];
    return entry?.mime ?? null;
  };

  // Internal type for the createReadStream function
  const createReadStreamSchema = z.function() as unknown as z.ZodFunction<
    z.ZodTuple<[]>,
    z.ZodType<Readable>
  >;

  return (
    z
      .object({
        filename: z.string(),
        mimetype: z.string(),
        encoding: z.string(),
        createReadStream: createReadStreamSchema,
      })
      // First, extract and normalize the file extension
      .transform((file) => ({
        ...file,
        extension: file.filename?.split('.').pop()?.toLowerCase(),
      }))
      // Then, validate the presence and type of the file stream
      .superRefine((file, ctx) => {
        const stream = file.createReadStream();
        if (!(stream instanceof Readable)) {
          ctx.addIssue({
            code: 'custom',
            message: 'Invalid file stream',
          });
        }

        if (isNullOrUndefined(acceptedFilesMap)) {
          return;
        }

        const supportedMimes = getSupportedMimesForExt(
          acceptedFilesMap,
          file.extension,
        );

        if (!supportedMimes) {
          ctx.addIssue({
            code: 'custom',
            message: 'Unsupported file type',
            path: ['extension'],
          });
          return;
        }

        if (!supportedMimes.includes(file.mimetype)) {
          ctx.addIssue({
            code: 'custom',
            message: 'File type does not match file extension',
            path: ['mimetype'],
          });
        }
      })
      // Next, read the file stream into a buffer for further validation
      .transform(async (file) => ({
        ...file,
        buffer: await getBufferFromStream(file.createReadStream()),
      }))
      // Finally, validate the actual file content against the expected MIME types
      .superRefine(async (file, ctx) => {
        if (isNullOrUndefined(acceptedFilesMap)) {
          return;
        }

        const fileType = await fileTypeFromBuffer(file.buffer);
        const supportedMimes = getSupportedMimesForExt(
          acceptedFilesMap,
          file.extension,
        );

        // If extension is unsupported, we already added an issue earlier.
        if (!supportedMimes) {
          return;
        }

        // fileType may be undefined for unknown formats
        if (!fileType || !supportedMimes.includes(fileType.mime)) {
          ctx.addIssue({
            code: 'custom',
            message: 'File content does not match file extension',
            path: ['buffer'],
          });
        }
      })
      // Enforce a maximum file size limit
      .refine((file) => file.buffer.length <= GQL_MAX_FILE_SIZE, {
        message: 'File size exceeds limit',
      })
  );
};

/**
 * Default file schema without restrictions on file types.
 *
 * It is recommended to use this schema only when absolutely necessary,
 *
 * Use `createFileSchema(acceptedFilesMap)` to create a schema with restrictions
 * on accepted file types.
 */
export const fileSchema = createFileSchema();
