import { Code, ConnectError } from '@connectrpc/connect';
import type { ConnectRouter } from '@connectrpc/connect';
import type { JsonValue } from '@bufbuild/protobuf';
import {
  FindCompanyNewsWorkerJobChildResult,
  FindContactActivityWorkerJobChildResult,
  FindJobVacanciesWorkerJobChildResult,
  GetFindCompanyNewsWorkerJobBatchResultResponse,
  GetFindContactActivityWorkerJobBatchResultResponse,
  GetFindJobVacanciesWorkerJobBatchResultResponse,
  FindJobVacanciesRequest,
  FindJobVacanciesResponse,
  FindCompanyNewsRequest,
  FindCompanyNewsResponse,
  FindContactActivityRequest,
  FindContactActivityResponse,
  StartWorkerJobResponse,
  WorkerJobService,
  WorkerJobStatus,
  WorkerJobType,
} from '@dailydotdev/schema';
import createOrGetConnection from '../../db';
import { WorkerJob } from '../../entity/WorkerJob';
import { triggerTypedEvent } from '../../common/typedPubsub';
import { logger } from '../../logger';
import type { VerifyAuth } from '../private/workerJobRpc';

const MAX_BATCH_SIZE = 100;
const DEFAULT_BATCH_RESULT_LIMIT = 50;
const MAX_BATCH_RESULT_LIMIT = 250;

const startBatch = async (
  type: WorkerJobType,
  items: { toJson: () => unknown }[],
) => {
  if (items.length > MAX_BATCH_SIZE) {
    throw new ConnectError(
      `batch size exceeds maximum of ${MAX_BATCH_SIZE}`,
      Code.InvalidArgument,
    );
  }

  const con = await createOrGetConnection();

  const { parent, saved } = await con.transaction(async (manager) => {
    const repo = manager.getRepository(WorkerJob);

    const parent = await repo.save(
      repo.create({
        type,
        status: WorkerJobStatus.RUNNING,
        input: null,
      }),
    );

    const children = items.map((item) =>
      repo.create({
        type,
        status: WorkerJobStatus.PENDING,
        parentId: parent.id,
        input: item.toJson() as Record<string, unknown>,
      }),
    );
    const saved = await repo.save(children);

    return { parent, saved };
  });

  await Promise.allSettled(
    saved.map((child) =>
      triggerTypedEvent(logger, 'api.v1.worker-job-execute', {
        jobId: child.id,
      }),
    ),
  );

  return new StartWorkerJobResponse({ jobId: parent.id });
};

const getBatchChildren = async (
  jobId: string,
  limit?: number,
  offset?: number,
) => {
  const con = await createOrGetConnection();
  const repo = con.getRepository(WorkerJob);

  const parent = await repo.findOneBy({ id: jobId });
  if (!parent) {
    throw new ConnectError('job not found', Code.NotFound);
  }

  const effectiveLimit = Math.min(
    limit || DEFAULT_BATCH_RESULT_LIMIT,
    MAX_BATCH_RESULT_LIMIT,
  );
  const effectiveOffset = offset || 0;

  const [children, total] = await repo.findAndCount({
    where: { parentId: parent.id },
    order: { createdAt: 'ASC' },
    take: effectiveLimit,
    skip: effectiveOffset,
  });

  return {
    parent,
    children,
    total,
    hasMore: effectiveOffset + effectiveLimit < total,
  };
};

export const createJobRpc =
  (verifyAuth: VerifyAuth) => (router: ConnectRouter) => {
    router.rpc(
      WorkerJobService,
      WorkerJobService.methods.startFindJobVacanciesBatch,
      async (req, context) => {
        verifyAuth(context);
        return startBatch(WorkerJobType.FIND_JOB_VACANCIES, req.items);
      },
    );

    router.rpc(
      WorkerJobService,
      WorkerJobService.methods.getFindJobVacanciesBatchResult,
      async (req, context) => {
        verifyAuth(context);
        const { parent, children, total, hasMore } = await getBatchChildren(
          req.jobId,
          req.limit,
          req.offset,
        );

        return new GetFindJobVacanciesWorkerJobBatchResultResponse({
          jobId: parent.id,
          status: parent.status,
          children: children.map(
            (child) =>
              new FindJobVacanciesWorkerJobChildResult({
                jobId: child.id,
                status: child.status,
                input: child.input
                  ? FindJobVacanciesRequest.fromJson(child.input as JsonValue)
                  : undefined,
                results: child.result
                  ? FindJobVacanciesResponse.fromJson(child.result as JsonValue)
                      .vacancies
                  : [],
                error: child.error ?? undefined,
              }),
          ),
          total,
          hasMore,
        });
      },
    );

    router.rpc(
      WorkerJobService,
      WorkerJobService.methods.startFindCompanyNewsBatch,
      async (req, context) => {
        verifyAuth(context);
        return startBatch(WorkerJobType.FIND_COMPANY_NEWS, req.items);
      },
    );

    router.rpc(
      WorkerJobService,
      WorkerJobService.methods.getFindCompanyNewsBatchResult,
      async (req, context) => {
        verifyAuth(context);
        const { parent, children, total, hasMore } = await getBatchChildren(
          req.jobId,
          req.limit,
          req.offset,
        );

        return new GetFindCompanyNewsWorkerJobBatchResultResponse({
          jobId: parent.id,
          status: parent.status,
          children: children.map(
            (child) =>
              new FindCompanyNewsWorkerJobChildResult({
                jobId: child.id,
                status: child.status,
                input: child.input
                  ? FindCompanyNewsRequest.fromJson(child.input as JsonValue)
                  : undefined,
                results: child.result
                  ? FindCompanyNewsResponse.fromJson(child.result as JsonValue)
                      .newsItems
                  : [],
                error: child.error ?? undefined,
              }),
          ),
          total,
          hasMore,
        });
      },
    );

    router.rpc(
      WorkerJobService,
      WorkerJobService.methods.startFindContactActivityBatch,
      async (req, context) => {
        verifyAuth(context);
        return startBatch(WorkerJobType.FIND_CONTACT_ACTIVITY, req.items);
      },
    );

    router.rpc(
      WorkerJobService,
      WorkerJobService.methods.getFindContactActivityBatchResult,
      async (req, context) => {
        verifyAuth(context);
        const { parent, children, total, hasMore } = await getBatchChildren(
          req.jobId,
          req.limit,
          req.offset,
        );

        return new GetFindContactActivityWorkerJobBatchResultResponse({
          jobId: parent.id,
          status: parent.status,
          children: children.map(
            (child) =>
              new FindContactActivityWorkerJobChildResult({
                jobId: child.id,
                status: child.status,
                input: child.input
                  ? FindContactActivityRequest.fromJson(
                      child.input as JsonValue,
                    )
                  : undefined,
                results: child.result
                  ? FindContactActivityResponse.fromJson(
                      child.result as JsonValue,
                    ).activities
                  : [],
                error: child.error ?? undefined,
              }),
          ),
          total,
          hasMore,
        });
      },
    );
  };
