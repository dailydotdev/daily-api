import type { FastifyInstance } from 'fastify';
import type z from 'zod';
import type { DataSource, EntityManager } from 'typeorm';
import { In } from 'typeorm';
import createOrGetConnection from '../../db';
import { parseSchema } from './utils';
import {
  claimCandidateListSchema,
  claimCandidateResolveSchema,
  claimEvidenceCreateSchema,
  claimEvidenceUpdateSchema,
  claimMergeSchema,
  claimStatusUpdateSchema,
  claimUpdateSchema,
  claimsQuerySchema,
  ledgerEntityAliasSchema,
  ledgerEntityCreateSchema,
  ledgerEntityQuerySchema,
  ledgerEntityUpdateSchema,
} from '../../common/schema/claimLedger';
import {
  assertLedgerNamesAvailable,
  expandLedgerEntityIds,
  findLedgerEntitiesByName,
} from '../../common/claimLedger';
import { Claim, ClaimStatus } from '../../entity/claim/Claim';
import {
  ClaimCandidate,
  ClaimCandidateStatus,
} from '../../entity/claim/ClaimCandidate';
import { ClaimEvidence } from '../../entity/claim/ClaimEvidence';
import { LedgerEntity } from '../../entity/claim/LedgerEntity';
import { Post } from '../../entity/posts/Post';
import { ConflictError } from '../../errors';
import { queryReadReplica } from '../../common/queryReadReplica';

const statusRank = [
  ClaimStatus.Candidate,
  ClaimStatus.Corroborated,
  ClaimStatus.Verified,
];

const resolveCandidateEntity = async ({
  manager,
  candidate,
}: {
  manager: EntityManager;
  candidate: ClaimCandidate;
}): Promise<LedgerEntity> => {
  const names = [candidate.rawEntityName, ...candidate.entityAliases];
  const matches = await findLedgerEntitiesByName({ con: manager, names });

  if (matches.length > 1) {
    throw new ConflictError(
      `Candidate names match ${matches.length} ledger entities, resolve them manually`,
    );
  }

  if (matches.length === 1) {
    return matches[0];
  }

  return manager.getRepository(LedgerEntity).save({
    canonicalName: candidate.rawEntityName,
    kind: candidate.entityKind,
    aliases: candidate.entityAliases,
  });
};

// Any post type can carry a claim, and single table inheritance keeps url and
// publishedAt on the shared post table, so read them off the base entity
// instead of narrowing to one post type.
const findEvidenceSource = ({
  con,
  postId,
}: {
  con: DataSource | EntityManager;
  postId: string;
}) =>
  con
    .getRepository(Post)
    .createQueryBuilder('p')
    .select('p."url"', 'url')
    .addSelect('p."publishedAt"', 'publishedAt')
    .where('p.id = :postId', { postId })
    .getRawOne<{ url: string | null; publishedAt: Date | null }>();

const pickOverride = <T>(override: T | undefined, original: T): T =>
  typeof override === 'undefined' ? original : override;

// Reviewer overrides shape the claim only: the candidate keeps the extractor's
// original output, so the candidate-to-claim delta stays usable as ground truth
// for measuring extraction defects.
const createClaimFromCandidate = async ({
  manager,
  candidate,
  body,
}: {
  manager: EntityManager;
  candidate: ClaimCandidate;
  body: z.infer<typeof claimCandidateResolveSchema>;
}): Promise<string> => {
  // An explicit entityId settles what the raw names cannot: a claim about a
  // child product named after its parent, or names shared by two entities.
  const entityId =
    body.entityId ?? (await resolveCandidateEntity({ manager, candidate })).id;
  const claim = await manager.getRepository(Claim).save({
    entityId,
    changeType: pickOverride(body.changeType, candidate.changeType),
    statement: pickOverride(body.statement, candidate.statement),
    versionScope: pickOverride(body.versionScope, candidate.versionScope),
    effectiveDate: pickOverride(body.effectiveDate, candidate.effectiveDate),
    sunsetDate: pickOverride(body.sunsetDate, candidate.sunsetDate),
  });

  return claim.id;
};

export default async (fastify: FastifyInstance): Promise<void> => {
  fastify.addHook('preHandler', async (req, res) => {
    if (!req.service) {
      return res.status(404).send();
    }
  });

  fastify.setErrorHandler((error, req, res) => {
    if (error instanceof ConflictError) {
      return res.status(409).send({ error: error.message });
    }

    req.log.error({ err: error }, 'Claim ledger request failed');

    return res.status(500).send({ error: 'Internal server error' });
  });

  fastify.get<{
    Querystring: z.infer<typeof claimCandidateListSchema>;
  }>('/candidates', async (req, res) => {
    const query = parseSchema({
      schema: claimCandidateListSchema,
      value: req.query,
      res,
    });
    if (!query) {
      return;
    }

    const con = await createOrGetConnection();
    const builder = con
      .getRepository(ClaimCandidate)
      .createQueryBuilder('cc')
      .where('cc.status = :status', { status: query.status })
      // Candidates land in bulk with the same timestamp, so offset paging needs
      // a total order or a page boundary can repeat or skip a row.
      .orderBy('cc."createdAt"', 'DESC')
      .addOrderBy('cc.id', 'DESC')
      .limit(query.limit)
      .offset(query.offset);

    if (query.entityName) {
      builder.andWhere('lower(cc."rawEntityName") = :entityName', {
        entityName: query.entityName.toLowerCase(),
      });
    }

    return res.status(200).send({ candidates: await builder.getMany() });
  });

  fastify.post<{
    Body: z.infer<typeof claimCandidateResolveSchema>;
  }>('/candidates/resolve', async (req, res) => {
    const body = parseSchema({
      schema: claimCandidateResolveSchema,
      value: req.body,
      res,
    });
    if (!body) {
      return;
    }

    const con = await createOrGetConnection();
    const candidate = await con
      .getRepository(ClaimCandidate)
      .findOneBy({ id: body.candidateId });

    if (!candidate) {
      return res.status(404).send({ error: 'Claim candidate not found' });
    }

    // A post can state several facts at once, so a merged candidate may be
    // merged again: a statement files the next fact as a claim of its own, a
    // claimId cites the same post as evidence for a claim that already exists.
    // Without either, re-resolving stays an accidental double merge.
    const isReMerge =
      candidate.status === ClaimCandidateStatus.Merged &&
      body.action === 'merge' &&
      (typeof body.statement !== 'undefined' || !!body.claimId);

    if (candidate.status !== ClaimCandidateStatus.Pending && !isReMerge) {
      return res
        .status(400)
        .send({ error: 'Claim candidate is already resolved' });
    }

    if (body.action === 'deny') {
      await con
        .getRepository(ClaimCandidate)
        .update(candidate.id, { status: ClaimCandidateStatus.Denied });

      return res.status(200).send({ success: true });
    }

    // Merging cites the candidate's post as evidence, so it needs a url: the
    // post's own, or one the reviewer supplies when the post carries none.
    const source = await findEvidenceSource({ con, postId: candidate.postId });
    const url = body.url ?? source?.url;

    if (!url) {
      return res
        .status(400)
        .send({ error: 'Evidence url is required when the post has none' });
    }

    if (
      body.claimId &&
      !(await con.getRepository(Claim).findOneBy({ id: body.claimId }))
    ) {
      return res.status(404).send({ error: 'Claim not found' });
    }

    if (
      body.entityId &&
      !(await con.getRepository(LedgerEntity).findOneBy({ id: body.entityId }))
    ) {
      return res.status(404).send({ error: 'Ledger entity not found' });
    }

    const claimId = await con.transaction(async (manager) => {
      // Without a claimId the candidate becomes a claim of its own, filed
      // against the ledger entity its names resolve to.
      const targetClaimId =
        body.claimId ??
        (await createClaimFromCandidate({ manager, candidate, body }));

      // Re-merging the same post into the same claim is a no-op, guarded by the
      // unique index on (claimId, url).
      await manager
        .getRepository(ClaimEvidence)
        .createQueryBuilder()
        .insert()
        .values({
          claimId: targetClaimId,
          postId: candidate.postId,
          url,
          sourceClass: body.sourceClass,
          publishedAt: source?.publishedAt ?? null,
        })
        .orIgnore()
        .execute();

      // A re-merge leaves the candidate pointing at the first claim it produced.
      if (!isReMerge) {
        await manager.getRepository(ClaimCandidate).update(candidate.id, {
          status: ClaimCandidateStatus.Merged,
          claimId: targetClaimId,
        });
      }

      return targetClaimId;
    });

    return res.status(200).send({ claimId });
  });

  // A name can straddle several entities, so the lookup answers with every
  // match and leaves picking one to the reviewer.
  fastify.get<{
    Querystring: z.infer<typeof ledgerEntityQuerySchema>;
  }>('/entities', async (req, res) => {
    const query = parseSchema({
      schema: ledgerEntityQuerySchema,
      value: req.query,
      res,
    });
    if (!query) {
      return;
    }

    const con = await createOrGetConnection();
    const entities = await queryReadReplica(con, ({ queryRunner }) =>
      findLedgerEntitiesByName({
        con: queryRunner.manager,
        names: [query.name],
      }),
    );

    return res.status(200).send({ entities });
  });

  fastify.post<{
    Body: z.infer<typeof ledgerEntityCreateSchema>;
  }>('/entities', async (req, res) => {
    const body = parseSchema({
      schema: ledgerEntityCreateSchema,
      value: req.body,
      res,
    });
    if (!body) {
      return;
    }

    const con = await createOrGetConnection();
    await assertLedgerNamesAvailable({
      con,
      names: [body.canonicalName, ...body.aliases],
    });

    const entity = await con.getRepository(LedgerEntity).save({
      canonicalName: body.canonicalName,
      kind: body.kind,
      aliases: body.aliases,
      keywordValue: body.keywordValue ?? null,
      parentId: body.parentId ?? null,
    });

    return res.status(201).send(entity);
  });

  // Only the fields the reviewer sends change, so a null clears a nullable
  // column while an absent key leaves it alone.
  fastify.post<{
    Body: z.infer<typeof ledgerEntityUpdateSchema>;
  }>('/entities/update', async (req, res) => {
    const body = parseSchema({
      schema: ledgerEntityUpdateSchema,
      value: req.body,
      res,
    });
    if (!body) {
      return;
    }

    const con = await createOrGetConnection();
    const entity = await con
      .getRepository(LedgerEntity)
      .findOneBy({ id: body.entityId });

    if (!entity) {
      return res.status(404).send({ error: 'Ledger entity not found' });
    }

    const update = {
      ...(typeof body.canonicalName !== 'undefined' && {
        canonicalName: body.canonicalName,
      }),
      ...(typeof body.kind !== 'undefined' && { kind: body.kind }),
      ...(typeof body.keywordValue !== 'undefined' && {
        keywordValue: body.keywordValue,
      }),
      ...(typeof body.parentId !== 'undefined' && { parentId: body.parentId }),
    };

    if (!Object.keys(update).length) {
      return res.status(200).send(entity);
    }

    if (typeof body.canonicalName !== 'undefined') {
      await assertLedgerNamesAvailable({
        con,
        names: [body.canonicalName],
        excludeId: entity.id,
      });
    }

    if (body.parentId) {
      if (body.parentId === entity.id) {
        return res
          .status(400)
          .send({ error: 'A ledger entity cannot be its own parent' });
      }

      if (
        !(await con
          .getRepository(LedgerEntity)
          .findOneBy({ id: body.parentId }))
      ) {
        return res
          .status(404)
          .send({ error: 'Parent ledger entity not found' });
      }
    }

    await con.getRepository(LedgerEntity).update(entity.id, update);

    return res.status(200).send({ ...entity, ...update });
  });

  fastify.post<{
    Body: z.infer<typeof ledgerEntityAliasSchema>;
  }>('/entities/alias', async (req, res) => {
    const body = parseSchema({
      schema: ledgerEntityAliasSchema,
      value: req.body,
      res,
    });
    if (!body) {
      return;
    }

    const con = await createOrGetConnection();
    const entity = await con
      .getRepository(LedgerEntity)
      .findOneBy({ id: body.entityId });

    if (!entity) {
      return res.status(404).send({ error: 'Ledger entity not found' });
    }

    await assertLedgerNamesAvailable({
      con,
      names: [body.alias],
      excludeId: entity.id,
    });

    if (
      entity.aliases.some(
        (alias) => alias.toLowerCase() === body.alias.toLowerCase(),
      )
    ) {
      return res.status(200).send({ aliases: entity.aliases });
    }

    const aliases = [...entity.aliases, body.alias];
    await con.getRepository(LedgerEntity).update(entity.id, { aliases });

    return res.status(200).send({ aliases });
  });

  fastify.post<{
    Body: z.infer<typeof claimStatusUpdateSchema>;
  }>('/claims/status', async (req, res) => {
    const body = parseSchema({
      schema: claimStatusUpdateSchema,
      value: req.body,
      res,
    });
    if (!body) {
      return;
    }

    const con = await createOrGetConnection();
    const { affected } = await con
      .getRepository(Claim)
      .update(body.claimId, { status: body.status });

    if (!affected) {
      return res.status(404).send({ error: 'Claim not found' });
    }

    return res.status(200).send({ success: true });
  });

  // A contradicted field is nulled and the claim kept: rejecting a claim that
  // is true costs the ledger the fact, so only the field that moved changes.
  fastify.post<{
    Body: z.infer<typeof claimUpdateSchema>;
  }>('/claims/update', async (req, res) => {
    const body = parseSchema({
      schema: claimUpdateSchema,
      value: req.body,
      res,
    });
    if (!body) {
      return;
    }

    const con = await createOrGetConnection();
    const claim = await con
      .getRepository(Claim)
      .findOneBy({ id: body.claimId });

    if (!claim) {
      return res.status(404).send({ error: 'Claim not found' });
    }

    const update = {
      ...(typeof body.changeType !== 'undefined' && {
        changeType: body.changeType,
      }),
      ...(typeof body.statement !== 'undefined' && {
        statement: body.statement,
      }),
      ...(typeof body.versionScope !== 'undefined' && {
        versionScope: body.versionScope,
      }),
      ...(typeof body.effectiveDate !== 'undefined' && {
        effectiveDate: body.effectiveDate,
      }),
      ...(typeof body.sunsetDate !== 'undefined' && {
        sunsetDate: body.sunsetDate,
      }),
      ...(typeof body.supersededByEntityId !== 'undefined' && {
        supersededByEntityId: body.supersededByEntityId,
      }),
      ...(typeof body.supersededByClaimId !== 'undefined' && {
        supersededByClaimId: body.supersededByClaimId,
      }),
    };

    if (!Object.keys(update).length) {
      return res.status(200).send(claim);
    }

    if (body.supersededByClaimId) {
      if (body.supersededByClaimId === claim.id) {
        return res
          .status(400)
          .send({ error: 'A claim cannot supersede itself' });
      }

      if (
        !(await con
          .getRepository(Claim)
          .findOneBy({ id: body.supersededByClaimId }))
      ) {
        return res.status(404).send({ error: 'Superseding claim not found' });
      }
    }

    await con.getRepository(Claim).update(claim.id, update);

    return res.status(200).send({ ...claim, ...update });
  });

  // Two reviewers filing the same fact leave a duplicate claim holding evidence
  // of its own, so the duplicate is absorbed: everything cited against it moves
  // to the claim that keeps it, and the emptied one is marked as absorbed.
  fastify.post<{
    Body: z.infer<typeof claimMergeSchema>;
  }>('/claims/merge', async (req, res) => {
    const body = parseSchema({
      schema: claimMergeSchema,
      value: req.body,
      res,
    });
    if (!body) {
      return;
    }

    const con = await createOrGetConnection();
    const [from, into] = await Promise.all([
      con.getRepository(Claim).findOneBy({ id: body.fromClaimId }),
      con.getRepository(Claim).findOneBy({ id: body.intoClaimId }),
    ]);

    if (!from || !into) {
      return res.status(404).send({ error: 'Claim not found' });
    }

    if (into.supersededByClaimId === from.id) {
      return res.status(400).send({
        error: 'The claim kept is superseded by the claim being merged',
      });
    }

    await con.transaction(async (manager) => {
      const evidenceRepo = manager.getRepository(ClaimEvidence);
      const [absorbed, cited] = await Promise.all([
        evidenceRepo.find({
          select: ['id', 'url'],
          where: { claimId: from.id },
        }),
        evidenceRepo.find({ select: ['url'], where: { claimId: into.id } }),
      ]);

      // The kept claim may already cite a url, and (claimId, url) is unique, so
      // the duplicate row is dropped instead of moved.
      const taken = new Set(cited.map(({ url }) => url));
      const duplicated = absorbed
        .filter(({ url }) => taken.has(url))
        .map(({ id }) => id);
      const moved = absorbed
        .filter(({ url }) => !taken.has(url))
        .map(({ id }) => id);

      if (duplicated.length) {
        await evidenceRepo.delete({ id: In(duplicated) });
      }

      if (moved.length) {
        await evidenceRepo.update({ id: In(moved) }, { claimId: into.id });
      }

      await manager
        .getRepository(ClaimCandidate)
        .update({ claimId: from.id }, { claimId: into.id });

      // Claims pointing at the duplicate keep their successor, so they are
      // repointed before the duplicate takes its own superseder.
      await manager
        .getRepository(Claim)
        .update(
          { supersededByClaimId: from.id },
          { supersededByClaimId: into.id },
        );

      await manager.getRepository(Claim).update(from.id, {
        status: ClaimStatus.Rejected,
        supersededByClaimId: into.id,
      });
    });

    return res.status(200).send({ success: true });
  });

  // Evidence a reviewer verified against a primary source: no post backs it,
  // so the url and its source class are all the proof there is.
  fastify.post<{
    Body: z.infer<typeof claimEvidenceCreateSchema>;
  }>('/claims/evidence', async (req, res) => {
    const body = parseSchema({
      schema: claimEvidenceCreateSchema,
      value: req.body,
      res,
    });
    if (!body) {
      return;
    }

    const con = await createOrGetConnection();

    if (!(await con.getRepository(Claim).findOneBy({ id: body.claimId }))) {
      return res.status(404).send({ error: 'Claim not found' });
    }

    if (
      await con
        .getRepository(ClaimEvidence)
        .findOneBy({ claimId: body.claimId, url: body.url })
    ) {
      throw new ConflictError('Claim already cites this url as evidence');
    }

    const evidence = await con.getRepository(ClaimEvidence).save({
      claimId: body.claimId,
      postId: null,
      url: body.url,
      sourceClass: body.sourceClass,
      publishedAt: body.publishedAt ?? null,
    });

    return res.status(201).send(evidence);
  });

  // A post crawled off a vendor blog enters as community evidence, so a
  // reviewer who verifies it is the primary source promotes the row in place:
  // corroboration counts across source classes, not across urls.
  fastify.post<{
    Body: z.infer<typeof claimEvidenceUpdateSchema>;
  }>('/claims/evidence/update', async (req, res) => {
    const body = parseSchema({
      schema: claimEvidenceUpdateSchema,
      value: req.body,
      res,
    });
    if (!body) {
      return;
    }

    const con = await createOrGetConnection();
    const { affected } = await con
      .getRepository(ClaimEvidence)
      .update(
        { claimId: body.claimId, url: body.url },
        { sourceClass: body.sourceClass },
      );

    if (!affected) {
      return res.status(404).send({ error: 'Claim evidence not found' });
    }

    return res.status(200).send({ success: true });
  });

  fastify.get<{
    Querystring: z.infer<typeof claimsQuerySchema>;
  }>('/claims', async (req, res) => {
    const query = parseSchema({
      schema: claimsQuerySchema,
      value: req.query,
      res,
    });
    if (!query) {
      return;
    }

    const con = await createOrGetConnection();
    const claims = await queryReadReplica(con, async ({ queryRunner }) => {
      const matched = await findLedgerEntitiesByName({
        con: queryRunner.manager,
        names: query.entities,
      });

      if (!matched.length) {
        return [];
      }

      const entityIds = await expandLedgerEntityIds({
        con: queryRunner.manager,
        entityIds: matched.map(({ id }) => id),
      });

      return queryRunner.manager
        .getRepository(Claim)
        .createQueryBuilder('c')
        .innerJoin(LedgerEntity, 'le', 'le.id = c."entityId"')
        .leftJoin(ClaimEvidence, 'ce', 'ce."claimId" = c.id')
        .select([
          'c.id AS id',
          'c."entityId" AS "entityId"',
          'le."canonicalName" AS "entityName"',
          'c."changeType" AS "changeType"',
          'c.statement AS statement',
          'c."versionScope" AS "versionScope"',
          'c."effectiveDate" AS "effectiveDate"',
          'c."sunsetDate" AS "sunsetDate"',
          'c."supersededByEntityId" AS "supersededByEntityId"',
          'c."supersededByClaimId" AS "supersededByClaimId"',
          'c.status AS status',
          `COALESCE(json_agg(json_build_object('url', ce.url, 'postId', ce."postId", 'sourceClass', ce."sourceClass", 'publishedAt', ce."publishedAt")) FILTER (WHERE ce.id IS NOT NULL), '[]') AS evidence`,
        ])
        .where('c."entityId" IN (:...entityIds)', { entityIds })
        .andWhere('c.status IN (:...statuses)', {
          statuses: statusRank.slice(statusRank.indexOf(query.minStatus)),
        })
        .andWhere(
          'COALESCE(c."effectiveDate", c."createdAt"::date) >= :since',
          { since: query.since },
        )
        .groupBy('c.id')
        .addGroupBy('le."canonicalName"')
        .orderBy('c."effectiveDate"', 'DESC', 'NULLS LAST')
        .addOrderBy('c.id', 'DESC')
        .getRawMany();
    });

    return res.status(200).send({ claims });
  });
};
