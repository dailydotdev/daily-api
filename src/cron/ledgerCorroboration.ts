import { Cron } from './cron';
import { corroborateClaims } from '../common/claimCorroboration';

// Promotes `candidate` claims whose evidence names >= 2 independent publishers.
// The rule and every guarantee it carries live in `src/common/claimCorroboration.ts`;
// this file only decides how often it runs and what is worth logging.
//
// WHY THIS IS NOT A STEP IN `ledger-hygiene`, which is the established home for
// recurring ledger passes and was the obvious candidate:
//
//   - Hygiene REPAIRS defects — it nulls a date that should never have been
//     written, clears a link that points at itself. Every write it makes restores
//     an invariant. This cron does something categorically different: it CHANGES
//     WHAT CONSUMERS READ, by moving claims onto the status the plan-reviewer
//     floors at. Filing a promotion under a janitorial name is how a consequential
//     write stops being reviewed.
//   - Hygiene's own header states its admission rule ("a defect extraction keeps
//     re-emitting, or a field that goes stale"). Corroboration is neither; the
//     evidence pile is not stale, it grew.
//   - They want different schedules. Hygiene runs every six hours so a stalled
//     review lane is caught within a working day. Promotion is daily, because
//     evidence arrives over days and there is nothing to catch early.
//   - Separability is the practical argument: this can be turned off without
//     also turning off date repair, and its counts get their own log line
//     instead of being averaged into a hygiene summary.
export const ledgerCorroborationCron: Cron = {
  name: 'ledger-corroboration',
  handler: async (con, logger) => {
    const counts = await corroborateClaims(con);

    // Logged unconditionally, unlike hygiene's abnormal-only lines. A promotion
    // pass that finds nothing is itself the signal worth seeing: it means either
    // the evidence pile stopped growing or this lane has stopped, and those look
    // identical in the data — the failure mode product-wiki/claim-ledger.md §6
    // records for the upstream worker.
    logger.info(counts, 'ledger corroboration pass');
  },
};
