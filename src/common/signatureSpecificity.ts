// Signature-token specificity bar — the emission half of the rule in
// smith-brain/docs/claim-ledger-review-playbook.md §13 (v5.9, 2026-08-20):
// a token must be distinctive enough to identify the API on its own, because
// signatures are matched by exact equality and `affected: ["name"]` accuses
// every codebase on earth. The 2026-08-20 statement-pass backfill shipped
// without this bar and rot-bench's first harness pilot got 15 identical
// tier-A false findings on a diff with zero ecosystem exposure.
//
// The canonical rule and word list live in rot-bench
// (src/detector/signatureSpecificity.ts, SIGNATURE_COMMON_WORDS in
// src/detector/tokenize/stoplists.ts) and are mirrored by the prod cleanup
// SQL (rot-bench/scripts/gen-signature-cleanup-sql.ts). If the list changes
// in either place, the other has to change with it.
//
// Deliberately NOT mirrored here: the detector's second generic class — a
// single bare all-lowercase word ("axios", "required"). Those MAY be
// legitimate signatures (a package name), so they stay in the data and the
// detector gates the MATCH instead, requiring the claim's entity to be
// resolved in the same input. Dropping them at emission would delete real
// signal; do not "sync" that class into this function.

// Identifiers that appear in essentially every codebase, plus keywords and
// verbs that show up as bare symbols. Kept identical to rot-bench's
// SIGNATURE_COMMON_WORDS.
// prettier-ignore
export const SIGNATURE_COMMON_WORDS = new Set([
  // identifiers that appear in essentially every codebase
  'name', 'type', 'types', 'path', 'paths', 'string', 'strings', 'value',
  'values', 'key', 'keys', 'id', 'ids', 'ref', 'refs', 'tag', 'tags',
  'label', 'labels', 'field', 'fields', 'item', 'items', 'list', 'lists',
  'map', 'maps', 'array', 'object', 'objects', 'number', 'boolean', 'data',
  'index', 'count', 'size', 'length', 'file', 'files', 'filename', 'dir',
  'directory', 'url', 'uri', 'host', 'port', 'user', 'users', 'group',
  'groups', 'role', 'roles', 'admin', 'email', 'password', 'token', 'tokens',
  'secret', 'secrets', 'session', 'cookie', 'cookies', 'cache', 'config',
  'configs', 'option', 'options', 'setting', 'settings', 'param', 'params',
  'parameter', 'parameters', 'arg', 'args', 'argument', 'arguments',
  'input', 'output', 'result', 'results', 'response', 'request', 'requests',
  'query', 'queries', 'body', 'header', 'headers', 'content', 'message',
  'messages', 'text', 'title', 'description', 'status', 'state', 'code',
  'error', 'errors', 'event', 'events', 'handler', 'callback', 'context',
  'date', 'time', 'timestamp', 'format', 'mode', 'version', 'versions',
  'branch', 'commit', 'merge', 'push', 'pull', 'sha', 'uuid', 'json', 'xml',
  'yaml', 'html', 'css', 'sql', 'http', 'https', 'api', 'app', 'application',
  'server', 'client', 'service', 'plugin', 'plugins', 'module', 'modules',
  'package', 'packages', 'component', 'components', 'template', 'templates',
  // keywords / verbs that show up as bare symbols
  'true', 'false', 'null', 'none', 'nil', 'default', 'public', 'private',
  'static', 'class', 'function', 'method', 'import', 'export', 'return',
  'get', 'set', 'put', 'post', 'delete', 'patch', 'head', 'add', 'remove',
  'create', 'update', 'read', 'write', 'open', 'close', 'start', 'stop',
  'run', 'test', 'tests', 'main', 'init', 'new', 'old', 'enable', 'disable',
  'enabled', 'disabled', 'min', 'max', 'sum', 'total', 'sort', 'order',
  'filter', 'page', 'limit', 'offset', 'next', 'prev', 'first', 'last',
]);

// Split on non-alphanumerics; the token is too generic to emit when EVERY
// segment is a common word, numeric, or ≤2 chars. "name", "GET", "true",
// "user.name", "application/json", "package.json" and "3.2.1" all fail;
// "S3File.presign", "contentDispositionType", "--legacy-peer-deps" and the
// bare package name "axios" pass. Pass the token as written — case does not
// change the verdict here, but the empty/whitespace token is generic too.
export const isTooGenericToEmit = (token: string): boolean => {
  const segments = token.split(/[^a-z0-9]+/i).filter(Boolean);
  if (!segments.length) {
    return true;
  }

  return segments.every(
    (segment) =>
      segment.length <= 2 ||
      /^[0-9]+$/.test(segment) ||
      SIGNATURE_COMMON_WORDS.has(segment.toLowerCase()),
  );
};
