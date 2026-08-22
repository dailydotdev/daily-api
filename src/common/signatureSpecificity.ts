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
//
// SECOND CLASS, mirrored in full (playbook §13 v5.18, 2026-08-22):
// STANDARDS VOCABULARY. A term defined by a published specification belongs to
// the specification and to no product, so it can never identify an API on its
// own — which is the §13 bar's own sentence, applied on a third axis. The two
// existing halves both ask about SHAPE and both pass these: `invalid_grant`
// has a separator so the segment rule above calls it specific, and it is one
// word with no space so the multi-word rule leaves it alone. The string is
// perfectly distinctive and owned by nobody.
//
// This one IS mirrored, unlike the bare-word class, because a bare word may be
// a package name and a spec term may not be anything else. Measured:
// rot-bench's five-task study produced four headline findings across 34 agent
// reps and all four came from this class — `invalid_grant` matching a Spotify
// claim on a MICROSOFT OAuth diff, `access_token` matching an npm-malware
// claim and a Forgejo claim on the same diff, the malware one at corroborated
// status and the only finding the product has ever shown a working agent.
//
// NOT mirrored, and this is the deliberate line: **standard-library module
// names**, which §13 v5.18 names in the same class. That half is a question
// about the importing FILE'S LANGUAGE — `json` is Python's standard library in
// a `.py` file and Ruby's json gem in a `.rb` one — and at emission there is
// no file and no language to ask about. The bare stdlib name on its own
// claim is already refused by §13's older "never the entity name" rule.
// rot-bench's detector owns that half (stages/stdlibImports.ts).

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

// OAuth 2.0 and OpenID Connect, from the parameter and error tables of:
// RFC 6749 §3-§6 (parameters) and §4.1.2.1/§5.2 (errors), RFC 6750 §3.1
// (bearer errors), RFC 7009 (revocation), RFC 7521 (assertions), RFC 7591
// (dynamic registration), RFC 7636 §4 (PKCE), RFC 7662 (introspection),
// RFC 8414 (AS metadata), RFC 8628 (device flow), RFC 8693 (token exchange),
// RFC 8707 (resource indicators), RFC 9126 (PAR), and OpenID Connect Core 1.0
// §3.1.2.1/§3.1.2.6. These are the IANA "OAuth Parameters" registry's
// contents by another name.
// prettier-ignore
const OAUTH_OIDC = [
  // request + response parameters (RFC 6749 §3–4, §6; RFC 7636 §4; OIDC §3)
  'access_token', 'refresh_token', 'id_token', 'token_type', 'expires_in',
  'client_id', 'client_secret', 'client_assertion', 'client_assertion_type',
  'grant_type', 'response_type', 'response_mode', 'redirect_uri', 'scope',
  'state', 'nonce', 'code', 'code_verifier', 'code_challenge',
  'code_challenge_method', 'device_code', 'user_code', 'verification_uri',
  'assertion', 'audience', 'resource', 'username', 'password',
  'prompt', 'display', 'max_age', 'login_hint', 'id_token_hint', 'acr_values',
  'request_uri', 'claims_locales', 'ui_locales',
  // token-introspection + revocation (RFC 7662, RFC 7009)
  'token_type_hint', 'active',
  // authorization-server metadata (RFC 8414)
  'authorization_endpoint', 'token_endpoint', 'userinfo_endpoint',
  'jwks_uri', 'issuer', 'introspection_endpoint', 'revocation_endpoint',
  // error codes (RFC 6749 §4.1.2.1, §5.2; RFC 6750 §3.1; OIDC §3.1.2.6)
  'invalid_request', 'invalid_client', 'invalid_grant', 'invalid_scope',
  'invalid_token', 'unauthorized_client', 'unsupported_grant_type',
  'unsupported_response_type', 'unsupported_token_type', 'access_denied',
  'server_error', 'temporarily_unavailable', 'insufficient_scope',
  'interaction_required', 'login_required', 'consent_required',
  'account_selection_required', 'authorization_pending', 'slow_down',
  'expired_token', 'invalid_client_metadata',
  // the two OAuth grant/auth scheme names, which are protocol words too
  'authorization_code', 'client_credentials', 'urn:ietf:params:oauth:grant-type:device_code',
];

// IANA "Hypertext Transfer Protocol (HTTP) Field Name Registry"
// (https://www.iana.org/assignments/http-fields/) — the permanent registrations
// in common use. Registered names only: a vendor's `X-…` header is not here.
// prettier-ignore
const HTTP_HEADERS = [
  'accept', 'accept-charset', 'accept-encoding', 'accept-language',
  'accept-ranges', 'access-control-allow-credentials',
  'access-control-allow-headers', 'access-control-allow-methods',
  'access-control-allow-origin', 'access-control-expose-headers',
  'access-control-max-age', 'access-control-request-headers',
  'access-control-request-method', 'age', 'allow', 'alt-svc', 'authorization',
  'cache-control', 'clear-site-data', 'connection', 'content-disposition',
  'content-encoding', 'content-language', 'content-length', 'content-location',
  'content-range', 'content-security-policy',
  'content-security-policy-report-only', 'content-type', 'cookie', 'date',
  'etag', 'expect', 'expires', 'forwarded', 'from', 'host', 'if-match',
  'if-modified-since', 'if-none-match', 'if-range', 'if-unmodified-since',
  'keep-alive', 'last-modified', 'link', 'location', 'max-forwards', 'origin',
  'permissions-policy', 'pragma', 'proxy-authenticate',
  'proxy-authorization', 'range', 'referer', 'referrer-policy', 'retry-after',
  'sec-fetch-dest', 'sec-fetch-mode', 'sec-fetch-site', 'sec-fetch-user',
  'server', 'set-cookie', 'strict-transport-security', 'te', 'trailer',
  'transfer-encoding', 'upgrade', 'user-agent', 'vary', 'via',
  'www-authenticate', 'x-content-type-options', 'x-frame-options',
];

// RFC 9110 §15 — the HTTP status codes' reason phrases, in the spelling a
// claim would write them. Honest note on reach: the tokenizer emits no token
// containing a space outside text mode's prose n-grams, so only the one-word
// phrases (`ok`, `gone`, `conflict`, `continue`) can be matched from a diff
// today. The multi-word entries are here so the group is the registry's
// rather than the tokenizer's, and they cost nothing.
// prettier-ignore
const HTTP_STATUS_PHRASES = [
  'continue', 'switching protocols', 'ok', 'created', 'accepted',
  'no content', 'partial content', 'moved permanently', 'found',
  'see other', 'not modified', 'temporary redirect', 'permanent redirect',
  'bad request', 'unauthorized', 'payment required', 'forbidden',
  'not found', 'method not allowed', 'not acceptable',
  'proxy authentication required', 'request timeout', 'conflict', 'gone',
  'length required', 'precondition failed', 'content too large',
  'payload too large', 'uri too long', 'unsupported media type',
  'range not satisfiable', 'expectation failed', 'misdirected request',
  'unprocessable content', 'unprocessable entity', 'too early',
  'upgrade required', 'precondition required', 'too many requests',
  'request header fields too large', 'unavailable for legal reasons',
  'internal server error', 'not implemented', 'bad gateway',
  'service unavailable', 'gateway timeout', 'http version not supported',
];

// IANA "Media Types" registry (https://www.iana.org/assignments/media-types/),
// the registered `application/*`, `text/*`, `multipart/*` and `image/*` names
// that appear in ordinary source. A media type is a wire format, never an
// API's own name. Unregistered `x-` names are excluded by the registry rule
// above, which is why `application/x-ndjson` is not here.
// prettier-ignore
const MIME_TYPES = [
  'application/json', 'application/ld+json', 'application/xml',
  'application/x-www-form-urlencoded', 'application/octet-stream',
  'application/pdf', 'application/zip', 'application/jwt',
  'application/problem+json', 'application/vnd.api+json',
  'multipart/form-data', 'multipart/mixed',
  'text/plain', 'text/html', 'text/csv', 'text/xml', 'text/event-stream',
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml',
];

// IANA "JSON Web Token Claims" registry — RFC 7519 §4.1's registered claims
// plus the OpenID Connect Core §5.1 registrations under it — and the JOSE
// header parameters of RFC 7515 §4.1. Two- and three-letter names are already
// weak by the class-1 bar; they are listed anyway so the group is its registry
// rather than a subset of it, and so a reader sees the right reason.
// prettier-ignore
const JWT_CLAIMS = [
  'iss', 'sub', 'aud', 'exp', 'nbf', 'iat', 'jti', 'azp', 'auth_time',
  'at_hash', 'c_hash', 'acr', 'amr', 'sid', 'nonce',
  'alg', 'kid', 'typ', 'cty', 'jku', 'jwk', 'x5t', 'x5u', 'x5c', 'crit',
  'email_verified', 'phone_number_verified', 'preferred_username',
  'given_name', 'family_name', 'middle_name',
];

// The standards-vocabulary union, lowered once. Membership is exact on the
// lowered token, which is the equality the signature route matches on.
export const STANDARDS_VOCABULARY = new Set(
  [
    ...OAUTH_OIDC,
    ...HTTP_HEADERS,
    ...HTTP_STATUS_PHRASES,
    ...MIME_TYPES,
    ...JWT_CLAIMS,
  ].map((term) => term.toLowerCase()),
);

// Two questions, in order. Is the WHOLE token standards vocabulary — a term a
// published specification defines, so it names a protocol rather than an API?
// Then, split on non-alphanumerics: is EVERY segment a common word, numeric,
// or ≤2 chars? "invalid_grant", "access_token", "Authorization", "exp" fail
// the first; "name", "GET", "true", "user.name", "application/json",
// "package.json" and "3.2.1" fail the second; "S3File.presign",
// "contentDispositionType", "--legacy-peer-deps" and the bare package name
// "axios" pass both. Pass the token as written — case does not change either
// verdict, but the empty/whitespace token is generic too.
export const isTooGenericToEmit = (token: string): boolean => {
  if (STANDARDS_VOCABULARY.has(token.trim().toLowerCase())) {
    return true;
  }

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
