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
  claimEvidenceDeleteSchema,
  claimEvidenceUpdateSchema,
  claimMergeSchema,
  claimMoveSchema,
  claimStatusUpdateSchema,
  claimUpdateSchema,
  claimsQuerySchema,
  ledgerEntityAliasSchema,
  ledgerEntityCreateSchema,
  ledgerEntityDeleteSchema,
  ledgerEntityDiscoverSchema,
  ledgerEntityMergeSchema,
  ledgerEntityQuerySchema,
  ledgerEntityUpdateSchema,
} from '../../common/schema/claimLedger';
import {
  assertLedgerNamesAvailable,
  expandLedgerEntityIds,
  findLedgerEntitiesByName,
  normalizeEvidenceUrl,
} from '../../common/claimLedger';
import {
  LEDGER_EMBEDDING_MODEL,
  toVectorLiteral,
} from '../../common/ledgerEmbedding';
import { embedLedgerText } from '../../integrations/bragi/embedding';
import { Claim, ClaimDateSource, ClaimStatus } from '../../entity/claim/Claim';
import {
  ClaimCandidate,
  ClaimCandidateStatus,
} from '../../entity/claim/ClaimCandidate';
import { ClaimEvidence } from '../../entity/claim/ClaimEvidence';
import { LedgerEntity } from '../../entity/claim/LedgerEntity';
import { Post } from '../../entity/posts/Post';
import { ConflictError } from '../../errors';
import { queryReadReplica } from '../../common/queryReadReplica';
import { getDiscussionLink } from '../../common/links';

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
    .addSelect('p."slug"', 'slug')
    .addSelect('p."publishedAt"', 'publishedAt')
    .where('p.id = :postId', { postId })
    .getRawOne<{
      url: string | null;
      slug: string;
      publishedAt: Date | null;
    }>();

// Rows written before urls were normalized keep their trailing slash, so the
// form the reviewer sends is looked up first and the normalized form only
// stands in for a variant of a row already stored normalized.
const resolveCitedUrl = async ({
  con,
  claimId,
  url,
}: {
  con: DataSource;
  claimId: string;
  url: string;
}): Promise<string> => {
  const normalized = normalizeEvidenceUrl(url);

  if (normalized === url) {
    return url;
  }

  const cited = await con
    .getRepository(ClaimEvidence)
    .findOneBy({ claimId, url });

  return cited ? url : normalized;
};

// The vector is derived from the description, so the two are written together
// and a cleared description clears it: a stale vector would answer for text the
// entity no longer carries.
const describedColumns = async (
  description: string | null,
): Promise<Record<string, unknown>> => {
  if (!description) {
    return {
      description: null,
      descriptionEmbedding: null,
      descriptionEmbeddingModel: null,
    };
  }

  const [embedding] = await embedLedgerText([description]);

  return {
    description,
    descriptionEmbedding: embedding,
    descriptionEmbeddingModel: LEDGER_EMBEDDING_MODEL,
  };
};

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
  const effectiveDate = pickOverride(
    body.effectiveDate,
    candidate.effectiveDate,
  );
  const claim = await manager.getRepository(Claim).save({
    entityId,
    changeType: pickOverride(body.changeType, candidate.changeType),
    statement: pickOverride(body.statement, candidate.statement),
    versionScope: pickOverride(body.versionScope, candidate.versionScope),
    effectiveDate,
    sunsetDate: pickOverride(body.sunsetDate, candidate.sunsetDate),
    dateSource: effectiveDate ? ClaimDateSource.Extracted : null,
    affected: pickOverride(body.affected, candidate.affected),
    superseding: pickOverride(body.superseding, candidate.superseding),
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

    // A post can state several facts at once, so a merged candidate splits into
    // a second claim, but only when the reviewer asks for it: every other
    // re-resolve is a runner replaying its own work and would duplicate a claim
    // or pile redundant evidence onto one.
    const isSplit =
      candidate.status === ClaimCandidateStatus.Merged && body.split === true;
    // A policy ruling can legitimize a class of denials after the fact, so a
    // denied candidate merges after all, but only on an explicit exception: a
    // denial is otherwise final and a runner replaying its work must not undo
    // a reviewer's call.
    const isRevive =
      candidate.status === ClaimCandidateStatus.Denied && body.revive === true;

    if (
      candidate.status !== ClaimCandidateStatus.Pending &&
      !isSplit &&
      !isRevive
    ) {
      throw new ConflictError('Claim candidate is already resolved');
    }

    // The playbook asks for a rule-citing rationale per decision, and it is only
    // worth anything to the recall audit if it sits on the row it explains.
    const note = typeof body.note === 'undefined' ? {} : { note: body.note };

    if (body.action === 'deny') {
      await con
        .getRepository(ClaimCandidate)
        .update(candidate.id, { status: ClaimCandidateStatus.Denied, ...note });

      return res.status(200).send({ success: true });
    }

    // Merging cites the candidate's post as evidence, so it needs a url: the
    // one the reviewer supplies, the post's own, or the post's permalink for the
    // post types that carry no url of their own.
    const source = await findEvidenceSource({ con, postId: candidate.postId });
    const citedUrl =
      body.url ??
      source?.url ??
      (source ? getDiscussionLink(source.slug) : null);

    if (!citedUrl) {
      return res.status(404).send({ error: 'Claim candidate post not found' });
    }

    const url = normalizeEvidenceUrl(citedUrl);

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

      // A split leaves the candidate pointing at the first claim it produced,
      // so only its note moves.
      const candidateUpdate = {
        ...(!isSplit && {
          status: ClaimCandidateStatus.Merged,
          claimId: targetClaimId,
        }),
        ...note,
      };

      if (Object.keys(candidateUpdate).length) {
        await manager
          .getRepository(ClaimCandidate)
          .update(candidate.id, candidateUpdate);
      }

      return targetClaimId;
    });

    return res.status(200).send({ claimId });
  });

  // The case no name can answer: a plan that reaches for an approach without
  // knowing what implements it. The nearest descriptions come back as entities
  // to check — the claims filed against them decide whether anything is stale,
  // so a loose neighbour costs a lookup rather than a false finding.
  fastify.post<{
    Body: z.infer<typeof ledgerEntityDiscoverSchema>;
  }>('/entities/discover', async (req, res) => {
    const body = parseSchema({
      schema: ledgerEntityDiscoverSchema,
      value: req.body,
      res,
    });
    if (!body) {
      return;
    }

    const [embedding] = await embedLedgerText([body.text]);
    const con = await createOrGetConnection();
    const entities = await queryReadReplica(con, ({ queryRunner }) =>
      queryRunner.manager
        .getRepository(LedgerEntity)
        .createQueryBuilder('le')
        .select('le.id', 'id')
        .addSelect('le."canonicalName"', 'canonicalName')
        .addSelect('le.kind', 'kind')
        .addSelect('le.description', 'description')
        .addSelect('1 - (le."descriptionEmbedding" <=> :vector)', 'similarity')
        .where('le."descriptionEmbedding" IS NOT NULL')
        .andWhere('le."descriptionEmbeddingModel" = :model')
        .andWhere(
          '1 - (le."descriptionEmbedding" <=> :vector) >= :minSimilarity',
        )
        .orderBy('le."descriptionEmbedding" <=> :vector')
        .setParameters({
          vector: toVectorLiteral(embedding),
          model: LEDGER_EMBEDDING_MODEL,
          minSimilarity: body.minSimilarity,
        })
        .limit(body.limit)
        .getRawMany(),
    );

    return res.status(200).send({ entities });
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
      ...(await describedColumns(body.description ?? null)),
    });

    return res.status(201).send({ ...entity, descriptionEmbedding: undefined });
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
      ...(typeof body.description !== 'undefined' &&
        (await describedColumns(body.description ?? null))),
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

    return res
      .status(200)
      .send({ ...entity, ...update, descriptionEmbedding: undefined });
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

    // Two reviewers aliasing the same entity at once each wrote back the array
    // they had read, so one alias was lost: the append and its dedupe both
    // happen in the row's own update instead.
    const { affected, raw } = await con
      .getRepository(LedgerEntity)
      .createQueryBuilder()
      .update()
      .set({
        aliases: () =>
          `CASE WHEN EXISTS (SELECT 1 FROM unnest(aliases) existing WHERE lower(existing) = lower(:alias)) THEN aliases ELSE aliases || ARRAY[:alias]::text[] END`,
      })
      .where({ id: entity.id })
      .setParameter('alias', body.alias)
      .returning('aliases')
      .execute();

    if (!affected) {
      return res.status(404).send({ error: 'Ledger entity not found' });
    }

    return res.status(200).send({ aliases: raw[0].aliases });
  });

  fastify.post<{
    Body: z.infer<typeof ledgerEntityAliasSchema>;
  }>('/entities/alias/remove', async (req, res) => {
    const body = parseSchema({
      schema: ledgerEntityAliasSchema,
      value: req.body,
      res,
    });
    if (!body) {
      return;
    }

    const con = await createOrGetConnection();
    const { affected, raw } = await con
      .getRepository(LedgerEntity)
      .createQueryBuilder()
      .update()
      .set({
        aliases: () =>
          `ARRAY(SELECT existing FROM unnest(aliases) existing WHERE lower(existing) <> lower(:alias))`,
      })
      .where({ id: body.entityId })
      .setParameter('alias', body.alias)
      .returning('aliases')
      .execute();

    if (!affected) {
      return res.status(404).send({ error: 'Ledger entity not found' });
    }

    return res.status(200).send({ aliases: raw[0].aliases });
  });

  // Extraction can file one artifact as two entities, so the duplicate is
  // absorbed: its claims, children and every name it answered to move to the
  // entity that keeps them, and the emptied row is dropped.
  fastify.post<{
    Body: z.infer<typeof ledgerEntityMergeSchema>;
  }>('/entities/merge', async (req, res) => {
    const body = parseSchema({
      schema: ledgerEntityMergeSchema,
      value: req.body,
      res,
    });
    if (!body) {
      return;
    }

    const con = await createOrGetConnection();
    const [from, into] = await Promise.all([
      con.getRepository(LedgerEntity).findOneBy({ id: body.fromEntityId }),
      con.getRepository(LedgerEntity).findOneBy({ id: body.intoEntityId }),
    ]);

    if (!from || !into) {
      return res.status(404).send({ error: 'Ledger entity not found' });
    }

    const merged = await con.transaction(async (manager) => {
      const entityRepo = manager.getRepository(LedgerEntity);
      const claimRepo = manager.getRepository(Claim);

      await claimRepo.update({ entityId: from.id }, { entityId: into.id });
      await claimRepo.update(
        { supersededByEntityId: from.id },
        { supersededByEntityId: into.id },
      );
      await entityRepo.update({ parentId: from.id }, { parentId: into.id });

      // A name the duplicate answered to may already belong to a third entity,
      // and every name in the ledger is unique, so that one is dropped.
      const names = [from.canonicalName, ...from.aliases];
      const owners = await findLedgerEntitiesByName({ con: manager, names });
      const unavailable = new Set(
        owners
          .filter(({ id }) => id !== from.id && id !== into.id)
          .flatMap((owner) => [owner.canonicalName, ...owner.aliases])
          .map((name) => name.toLowerCase()),
      );
      const kept = new Set(
        [into.canonicalName, ...into.aliases].map((name) => name.toLowerCase()),
      );
      const aliases = [...into.aliases];

      names.forEach((name) => {
        const normalized = name.toLowerCase();

        if (kept.has(normalized) || unavailable.has(normalized)) {
          return;
        }

        kept.add(normalized);
        aliases.push(name);
      });

      await entityRepo.update(into.id, { aliases });
      await entityRepo.delete(from.id);

      // Verifying the merge against the replica reads it before the merge
      // lands, so the entity the reviewer ends up with is answered from inside
      // the transaction that made it.
      return entityRepo.findOne({
        select: ['id', 'canonicalName', 'aliases', 'parentId'],
        where: { id: into.id },
      });
    });

    return res.status(200).send(merged);
  });

  // Extraction probes entities into existence that never take a claim, and
  // merging one away only moves its names onto a neighbour, so an entity
  // nothing stands on is dropped outright.
  fastify.post<{
    Body: z.infer<typeof ledgerEntityDeleteSchema>;
  }>('/entities/delete', async (req, res) => {
    const body = parseSchema({
      schema: ledgerEntityDeleteSchema,
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

    // Deleting cascades to the claims filed against the entity and orphans its
    // children, so both have to be empty before the row can go.
    const [claims, children] = await Promise.all([
      con
        .getRepository(Claim)
        .countBy([
          { entityId: entity.id },
          { supersededByEntityId: entity.id },
        ]),
      con.getRepository(LedgerEntity).countBy({ parentId: entity.id }),
    ]);

    if (claims) {
      return res
        .status(400)
        .send({ error: 'Ledger entity is still referenced by claims' });
    }

    if (children) {
      return res
        .status(400)
        .send({ error: 'Ledger entity still has child entities' });
    }

    await con.getRepository(LedgerEntity).delete(entity.id);

    return res.status(200).send({ success: true });
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
        // A reviewer setting the date read the change itself, so it stops
        // being whatever a backfill inferred from the reporting post.
        dateSource: body.effectiveDate ? ClaimDateSource.Extracted : null,
      }),
      ...(typeof body.sunsetDate !== 'undefined' && {
        sunsetDate: body.sunsetDate,
      }),
      ...(typeof body.affected !== 'undefined' && { affected: body.affected }),
      ...(typeof body.superseding !== 'undefined' && {
        superseding: body.superseding,
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
      const taken = new Set(cited.map(({ url }) => normalizeEvidenceUrl(url)));
      const duplicated = absorbed
        .filter(({ url }) => taken.has(normalizeEvidenceUrl(url)))
        .map(({ id }) => id);
      const moved = absorbed
        .filter(({ url }) => !taken.has(normalizeEvidenceUrl(url)))
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

  // A claim filed against the wrong entity is otherwise unrepairable: the
  // entity is chosen when the claim is created and nothing since could change
  // it. Its evidence hangs off the post, not the entity, so it stays as it is.
  fastify.post<{
    Body: z.infer<typeof claimMoveSchema>;
  }>('/claims/move', async (req, res) => {
    const body = parseSchema({
      schema: claimMoveSchema,
      value: req.body,
      res,
    });
    if (!body) {
      return;
    }

    const con = await createOrGetConnection();
    const [claim, entity] = await Promise.all([
      con.getRepository(Claim).findOneBy({ id: body.claimId }),
      con.getRepository(LedgerEntity).findOneBy({ id: body.entityId }),
    ]);

    if (!claim) {
      return res.status(404).send({ error: 'Claim not found' });
    }

    if (!entity) {
      return res.status(404).send({ error: 'Ledger entity not found' });
    }

    if (claim.entityId === entity.id) {
      return res
        .status(400)
        .send({ error: 'Claim already belongs to this ledger entity' });
    }

    await con.getRepository(Claim).update(claim.id, { entityId: entity.id });

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

    const url = normalizeEvidenceUrl(body.url);

    if (
      await con.getRepository(ClaimEvidence).findOneBy({
        claimId: body.claimId,
        url: In([...new Set([url, body.url])]),
      })
    ) {
      throw new ConflictError('Claim already cites this url as evidence');
    }

    const evidence = await con.getRepository(ClaimEvidence).save({
      claimId: body.claimId,
      postId: null,
      url,
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
    const url = await resolveCitedUrl({
      con,
      claimId: body.claimId,
      url: body.url,
    });
    const { affected } = await con
      .getRepository(ClaimEvidence)
      .update(
        { claimId: body.claimId, url },
        { sourceClass: body.sourceClass },
      );

    if (!affected) {
      return res.status(404).send({ error: 'Claim evidence not found' });
    }

    return res.status(200).send({ success: true });
  });

  // Evidence that on review says nothing about the claim still counts towards
  // its corroboration, so the row is dropped instead of reclassified.
  fastify.post<{
    Body: z.infer<typeof claimEvidenceDeleteSchema>;
  }>('/claims/evidence/delete', async (req, res) => {
    const body = parseSchema({
      schema: claimEvidenceDeleteSchema,
      value: req.body,
      res,
    });
    if (!body) {
      return;
    }

    const con = await createOrGetConnection();
    const url = await resolveCitedUrl({
      con,
      claimId: body.claimId,
      url: body.url,
    });
    const { affected } = await con
      .getRepository(ClaimEvidence)
      .delete({ claimId: body.claimId, url });

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
    const { entities, ids, since } = query;
    const claims = await queryReadReplica(con, async ({ queryRunner }) => {
      const builder = queryRunner.manager
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
          'c."versionParsed" AS "versionParsed"',
          'c.affected AS affected',
          'c.superseding AS superseding',
          'c."effectiveDate" AS "effectiveDate"',
          'c."dateSource" AS "dateSource"',
          'c."sunsetDate" AS "sunsetDate"',
          'c."supersededByEntityId" AS "supersededByEntityId"',
          'c."supersededByClaimId" AS "supersededByClaimId"',
          'c.status AS status',
          `COALESCE(json_agg(json_build_object('url', ce.url, 'postId', ce."postId", 'sourceClass', ce."sourceClass", 'publishedAt', ce."publishedAt")) FILTER (WHERE ce.id IS NOT NULL), '[]') AS evidence`,
        ])
        .groupBy('c.id')
        .addGroupBy('le."canonicalName"')
        .orderBy('c."effectiveDate"', 'DESC', 'NULLS LAST')
        .addOrderBy('c.id', 'DESC');

      // Ids name the claims outright, so the status floor and the date window
      // would only hide a claim the caller already holds the id of.
      if (ids) {
        return builder.where('c.id IN (:...ids)', { ids }).getRawMany();
      }

      if (!entities || !since) {
        return [];
      }

      const matched = await findLedgerEntitiesByName({
        con: queryRunner.manager,
        names: entities,
      });

      if (!matched.length) {
        return [];
      }

      const entityIds = await expandLedgerEntityIds({
        con: queryRunner.manager,
        entityIds: matched.map(({ id }) => id),
      });

      builder
        .where('c."entityId" IN (:...entityIds)', { entityIds })
        .andWhere('c.status IN (:...statuses)', {
          statuses: statusRank.slice(statusRank.indexOf(query.minStatus)),
        });

      // Falling back to "createdAt" dated every undated claim to the day it was
      // written, which for a backfill is one day for all of them.
      return query.dated
        ? builder
            .andWhere('c."effectiveDate" >= :since', { since })
            .getRawMany()
        : builder
            .andWhere(
              '(c."effectiveDate" IS NULL OR c."effectiveDate" >= :since)',
              { since },
            )
            .getRawMany();
    });

    return res.status(200).send({ claims });
  });
};
