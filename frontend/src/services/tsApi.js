/**
 * Trust & Safety API helpers
 * All calls go to /api/ts/<feature>
 */

const API_BASE = '/api/ts';
const getToken = () => localStorage.getItem('token');
const headers = () => ({
  'Content-Type': 'application/json',
  ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
});
const handleResponse = async (res) => {
  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
};

export const tsApi = {
  list: (feat, params = {}) => {
    const q = new URLSearchParams(params).toString();
    return fetch(`${API_BASE}/${feat}${q ? '?' + q : ''}`, { headers: headers() }).then(handleResponse);
  },
  get: (feat, id) =>
    fetch(`${API_BASE}/${feat}/${id}`, { headers: headers() }).then(handleResponse),
  create: (feat, data) =>
    fetch(`${API_BASE}/${feat}`, { method: 'POST', headers: headers(), body: JSON.stringify(data) }).then(handleResponse),
  update: (feat, id, data) =>
    fetch(`${API_BASE}/${feat}/${id}`, { method: 'PUT', headers: headers(), body: JSON.stringify(data) }).then(handleResponse),
  remove: (feat, id) =>
    fetch(`${API_BASE}/${feat}/${id}`, { method: 'DELETE', headers: headers() }).then(handleResponse),
  archive: (feat, id) =>
    fetch(`${API_BASE}/${feat}/${id}/archive`, { method: 'POST', headers: headers() }).then(handleResponse),
  restore: (feat, id) =>
    fetch(`${API_BASE}/${feat}/${id}/restore`, { method: 'POST', headers: headers() }).then(handleResponse),
  history: (feat, id) =>
    fetch(`${API_BASE}/${feat}/${id}/history`, { headers: headers() }).then(handleResponse),
  stats: (feat) =>
    fetch(`${API_BASE}/${feat}/stats/summary`, { headers: headers() }).then(handleResponse),
  aiVerb: (feat, verb, body = {}) =>
    fetch(`${API_BASE}/${feat}/ai/${verb}`, { method: 'POST', headers: headers(), body: JSON.stringify(body) }).then(handleResponse),
  search: (feat, q, params = {}) => {
    const qs = new URLSearchParams({ q, ...params }).toString();
    return fetch(`${API_BASE}/${feat}/search?${qs}`, { headers: headers() }).then(handleResponse);
  },
};

export const TS_FEATURES = [
  {
    key: 'csam-hash-match',
    name: 'CSAM Hash Match',
    icon: '🔐',
    color: 'from-red-700 to-red-900',
    description: 'Cryptographic hash matching for CSAM detection. Hash-only — no content access.',
    isCsam: true,
    aiVerbs: [
      'classify-match-confidence','recommend-immediate-report','score-hash-quality',
      'generate-ncmec-cybertip-draft','summarize-match-events','validate-hash-set-version',
      'suggest-additional-hash-source','detect-hash-collision-risk','classify-content-tier-1-2-3',
      'predict-recidivism-actor','recommend-cross-platform-share','generate-law-enforcement-package',
      'score-evidence-preservation','suggest-account-action-tier','summarize-actor-history',
      'score-hash-coverage',
    ],
    fields: [
      { name: 'hash_value', label: 'Hash Value', type: 'text', required: true },
      { name: 'hash_algorithm', label: 'Hash Algorithm', type: 'select', options: ['MD5','SHA-1','SHA-256','PDQ','PhotoDNA'] },
      { name: 'hash_set_version', label: 'Hash Set Version', type: 'text' },
      { name: 'match_source', label: 'Match Source', type: 'text' },
      { name: 'severity_label', label: 'Severity Label', type: 'select', options: ['unknown','low','medium','high','critical'] },
      { name: 'confidence_score', label: 'Confidence Score', type: 'number' },
      { name: 'content_id', label: 'Content ID', type: 'text' },
      { name: 'platform_origin', label: 'Platform Origin', type: 'text' },
      { name: 'actor_id', label: 'Actor ID', type: 'text' },
    ],
  },
  {
    key: 'policy-engine',
    name: 'Policy Engine',
    icon: '📜',
    color: 'from-blue-600 to-blue-800',
    description: 'Manage and enforce content moderation policies.',
    isCsam: false,
    aiVerbs: [
      'classify-policy-match','suggest-policy-rule','detect-policy-drift',
      'predict-decision-consistency','recommend-policy-refinement','score-policy-clarity',
      'generate-policy-explanation','summarize-policy-events','validate-policy-against-law',
      'suggest-cross-policy-conflict-resolution','detect-policy-ambiguity','classify-edge-case',
      'predict-precedent-application','recommend-deprecation','generate-reviewer-training-example',
      'score-decision-explainability',
    ],
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'policy_type', label: 'Policy Type', type: 'text' },
      { name: 'status', label: 'Status', type: 'select', options: ['draft','active','deprecated'] },
      { name: 'jurisdiction', label: 'Jurisdiction', type: 'text' },
      { name: 'severity_level', label: 'Severity Level', type: 'select', options: ['low','medium','high','critical'] },
    ],
  },
  {
    key: 'human-review-queue',
    name: 'Human Review Queue',
    icon: '👤',
    color: 'from-amber-600 to-amber-800',
    description: 'Manage human reviewer queues and SLA tracking.',
    isCsam: false,
    aiVerbs: [
      'predict-review-time','classify-queue-priority','recommend-assignee','detect-reviewer-fatigue',
      'score-queue-health','generate-queue-summary','summarize-reviewer-throughput',
      'validate-sla-adherence','suggest-batch-grouping','detect-coaching-need',
      'classify-decision-disagreement','predict-overflow-risk','recommend-staffing-adjust',
      'generate-coaching-feedback','score-decision-quality','summarize-decision-variance',
    ],
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'priority', label: 'Priority', type: 'select', options: ['low','medium','high','urgent'] },
      { name: 'status', label: 'Status', type: 'select', options: ['pending','in_review','resolved','escalated'] },
      { name: 'assignee_id', label: 'Assignee ID', type: 'text' },
      { name: 'content_type', label: 'Content Type', type: 'text' },
      { name: 'sla_deadline', label: 'SLA Deadline', type: 'datetime-local' },
    ],
  },
  {
    key: 'appeals-console',
    name: 'Appeals Console',
    icon: '⚖️',
    color: 'from-violet-600 to-violet-800',
    description: 'Manage content moderation appeals and decisions.',
    isCsam: false,
    aiVerbs: [
      'classify-appeal-strength','predict-appeal-outcome','suggest-evidence-needed',
      'generate-appeal-response','summarize-appeal-history','score-original-decision',
      'validate-procedural-fairness','recommend-policy-clarification','classify-appeal-tier',
      'detect-bad-faith-appeal','predict-reversal-rate','recommend-precedent-citation',
      'generate-user-letter','score-appeal-process-quality','suggest-appeals-policy-change',
      'summarize-appeals-trends',
    ],
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'description', label: 'Appeal Reason', type: 'textarea' },
      { name: 'original_decision', label: 'Original Decision', type: 'text' },
      { name: 'status', label: 'Status', type: 'select', options: ['pending','under_review','upheld','overturned','dismissed'] },
      { name: 'appeal_tier', label: 'Appeal Tier', type: 'select', options: ['tier1','tier2','tier3'] },
      { name: 'content_type', label: 'Content Type', type: 'text' },
    ],
  },
  {
    key: 'region-rules',
    name: 'Region Rules',
    icon: '🌍',
    color: 'from-emerald-600 to-emerald-800',
    description: 'Jurisdiction-specific content rules and regulatory compliance.',
    isCsam: false,
    aiVerbs: [
      'classify-region-applicability','detect-rule-conflict','suggest-region-specific-policy',
      'predict-regulator-finding','recommend-rule-update','generate-jurisdiction-summary',
      'summarize-rule-changes','score-rule-coverage','validate-rule-vs-legal-text',
      'suggest-rule-versioning','classify-content-by-jurisdiction','predict-cross-border-issue',
      'recommend-geo-block','generate-regulator-response','score-multi-jurisdiction-compliance',
      'detect-overreach',
    ],
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'region_code', label: 'Region Code', type: 'text', required: true },
      { name: 'status', label: 'Status', type: 'select', options: ['active','draft','deprecated'] },
      { name: 'legal_basis', label: 'Legal Basis', type: 'text' },
      { name: 'enforcement_level', label: 'Enforcement Level', type: 'select', options: ['advisory','mandatory','strict'] },
    ],
  },
  {
    key: 'transparency-reports',
    name: 'Transparency Reports',
    icon: '📊',
    color: 'from-cyan-600 to-cyan-800',
    description: 'Generate and manage public transparency disclosures.',
    isCsam: false,
    aiVerbs: [
      'classify-report-section','suggest-metric-definition','detect-metric-anomaly',
      'predict-stakeholder-question','recommend-narrative-framing','generate-report-section',
      'summarize-period-trends','score-report-completeness','validate-metric-reproducibility',
      'suggest-additional-disclosure','classify-disclosure-sensitivity','predict-media-pickup',
      'recommend-comparative-baseline','generate-press-summary','score-comparability-vs-peers',
      'summarize-yoy-changes',
    ],
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'report_period', label: 'Report Period', type: 'text' },
      { name: 'status', label: 'Status', type: 'select', options: ['draft','review','published','archived'] },
      { name: 'report_type', label: 'Report Type', type: 'text' },
      { name: 'region_scope', label: 'Region Scope', type: 'text' },
    ],
  },
  {
    key: 'creator-comms',
    name: 'Creator Comms',
    icon: '💬',
    color: 'from-pink-600 to-pink-800',
    description: 'Communications management for creators and policy enforcement notices.',
    isCsam: false,
    aiVerbs: [
      'classify-comms-tone','draft-notice-letter','predict-creator-reaction',
      'suggest-education-resource','generate-deescalation-message','summarize-creator-history',
      'score-message-clarity','validate-comms-against-policy','recommend-channel-selection',
      'classify-creator-tier','detect-influencer-blast-radius','predict-pr-risk',
      'recommend-escalation-path','generate-press-statement-template','score-comms-effectiveness',
      'summarize-comms-history',
    ],
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'message_body', label: 'Message Body', type: 'textarea' },
      { name: 'creator_id', label: 'Creator ID', type: 'text' },
      { name: 'status', label: 'Status', type: 'select', options: ['draft','sent','acknowledged','escalated'] },
      { name: 'channel', label: 'Channel', type: 'select', options: ['email','in_app','sms','legal'] },
      { name: 'comms_type', label: 'Comms Type', type: 'text' },
    ],
  },
  {
    key: 'signal-sharing-gifct',
    name: 'Signal Sharing (GIFCT)',
    icon: '🔗',
    color: 'from-orange-600 to-orange-800',
    description: 'Cross-platform signal sharing via GIFCT and partner networks.',
    isCsam: false,
    aiVerbs: [
      'classify-signal-shareable','score-signal-quality','predict-cross-platform-utility',
      'recommend-signal-tier','generate-signal-package','summarize-shared-signals',
      'validate-signal-attribution','suggest-share-restrictions','detect-poisoned-signal',
      'classify-actor-network','predict-platform-coverage','recommend-additional-signal-type',
      'generate-partner-report','score-mutual-defense-value','suggest-signal-revocation',
      'summarize-network-health',
    ],
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'signal_type', label: 'Signal Type', type: 'text' },
      { name: 'status', label: 'Status', type: 'select', options: ['pending','shared','revoked','expired'] },
      { name: 'platform_origin', label: 'Platform Origin', type: 'text' },
      { name: 'share_tier', label: 'Share Tier', type: 'select', options: ['immediate','standard','hold'] },
    ],
  },
];
