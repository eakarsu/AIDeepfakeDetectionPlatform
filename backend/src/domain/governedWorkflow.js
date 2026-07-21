/**
 * Pure, dependency-free policy for the governed media-authenticity workflow.
 * Provider/model output is evidence only. It can never transition a record.
 */
const POLICY = Object.freeze({
  "domain": "media-authenticity",
  "caseKind": "media_case",
  "roles": [
    "admin",
    "ingest_operator",
    "analyst",
    "senior_analyst",
    "evidence_custodian",
    "appeals_reviewer"
  ],
  "required": [
    "mediaRef",
    "sha256",
    "sourceRef",
    "retentionPolicy"
  ],
  "initial": "ingested",
  "transitions": {
    "ingested": [
      "hashed"
    ],
    "hashed": [
      "analyzed"
    ],
    "analyzed": [
      "analyst_review"
    ],
    "analyst_review": [
      "inconclusive",
      "authenticity_concern",
      "no_evidence_of_manipulation"
    ],
    "inconclusive": [
      "appeal",
      "closed"
    ],
    "authenticity_concern": [
      "appeal",
      "closed"
    ],
    "no_evidence_of_manipulation": [
      "appeal",
      "closed"
    ],
    "appeal": [
      "analyst_review",
      "closed"
    ],
    "closed": []
  },
  "approvals": {
    "authenticity_concern": [
      "senior_analyst"
    ],
    "closed": [
      "evidence_custodian",
      "appeals_reviewer"
    ]
  },
  "evidence": {
    "hashed": [
      "custody_hash"
    ],
    "analyzed": [
      "detector_run"
    ],
    "analyst_review": [
      "provenance_check"
    ],
    "authenticity_concern": [
      "analyst_finding"
    ],
    "closed": [
      "retention_disposition"
    ]
  },
  "connectors": [
    "secure_media_store",
    "provenance_registry",
    "model_worker",
    "fact_check_source",
    "case_system"
  ],
  "stopFlags": [
    "chain_of_custody_broken",
    "hash_mismatch",
    "subject_redress_pending",
    "detector_version_missing"
  ]
});

const KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const SHA256 = /^[a-f0-9]{64}$/i;

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function validateCreate(input = {}) {
  const errors = [];
  if (!KEY.test(cleanString(input.idempotencyKey))) errors.push('idempotencyKey must be 8-128 safe characters');
  for (const field of POLICY.required) {
    if (!cleanString(input[field])) errors.push(`${field} is required`);
  }
  if (input.sha256 && !SHA256.test(cleanString(input.sha256))) errors.push('sha256 must be a 64 character hex digest');
  if (input.tenantId !== undefined) errors.push('tenantId is derived from the authenticated identity');
  if (input.state !== undefined) errors.push('initial state is controlled by policy');
  if (input.aiDecision !== undefined) errors.push('model output cannot be submitted as a domain decision');
  const submittedKeys = Object.keys(input).join(' ');
  if (/patient.?name|child.?name|consumer.?name|raw.?media|plaintext/i.test(submittedKeys)) {
    errors.push('direct identifiers or raw sensitive content are forbidden; submit governed references');
  }
  return { ok: errors.length === 0, errors };
}

function authorizeTransition({ record, to, actor, evidence = [], approval, flags = [] } = {}) {
  const errors = [];
  if (!record || !record.state) return { ok: false, errors: ['record state is required'] };
  const role = cleanString(actor && actor.role);
  if (!POLICY.roles.includes(role)) errors.push('actor role is not authorized for this workflow');
  const allowed = POLICY.transitions[record.state] || [];
  if (!allowed.includes(to)) errors.push(`transition ${record.state} -> ${to} is not allowed`);

  const activeStops = flags.filter((flag) => POLICY.stopFlags.includes(flag));
  if (activeStops.length) errors.push(`safety hold: ${activeStops.join(', ')}`);

  const evidenceKinds = new Set(evidence.map((item) => item && item.kind));
  const missing = (POLICY.evidence[to] || []).filter((kind) => !evidenceKinds.has(kind));
  if (missing.length) errors.push(`missing evidence: ${missing.join(', ')}`);

  const approvalRoles = POLICY.approvals[to] || [];
  if (approvalRoles.length) {
    if (!approval || !approvalRoles.includes(approval.role)) errors.push(`approval by one of [${approvalRoles.join(', ')}] is required`);
    if (approval && String(approval.actorId) === String(actor && actor.id)) errors.push('requester cannot self-approve this transition');
    if (approval && !cleanString(approval.reason)) errors.push('approval reason is required');
  }

  return { ok: errors.length === 0, errors };
}

function validateIntegration(input = {}) {
  const errors = [];
  if (!POLICY.connectors.includes(input.connector)) errors.push('connector is not allowlisted');
  if (!KEY.test(cleanString(input.idempotencyKey))) errors.push('idempotencyKey must be 8-128 safe characters');
  if (!cleanString(input.credentialRef)) errors.push('a vault credentialRef is required');
  if (input.secret || input.password || input.apiKey || input.token) errors.push('raw secrets are forbidden; submit only a vault reference');
  if (!['pull', 'push', 'verify'].includes(input.operation)) errors.push('operation must be pull, push, or verify');
  return { ok: errors.length === 0, errors };
}

function qualitySummary(records = []) {
  const total = records.length;
  const failed = records.filter((item) => item.outcome === 'failed').length;
  const held = records.filter((item) => item.outcome === 'held').length;
  const reproducible = records.filter((item) => item.reproducible === true).length;
  return {
    total,
    failureRate: total ? failed / total : 0,
    holdRate: total ? held / total : 0,
    reproducibilityRate: total ? reproducible / total : 0,
  };
}

function redactSensitive(value) {
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => {
    if (/password|secret|token|api.?key|patient.?name|child.?name|consumer.?name/i.test(key)) return [key, '[REDACTED]'];
    return [key, redactSensitive(child)];
  }));
}

module.exports = { POLICY, validateCreate, authorizeTransition, validateIntegration, qualitySummary, redactSensitive };
