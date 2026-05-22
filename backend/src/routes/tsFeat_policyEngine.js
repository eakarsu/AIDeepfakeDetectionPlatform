/**
 * Trust & Safety — Policy Engine
 * Table: ts_policy_rules
 * Mount: /api/ts/policy-engine
 */
'use strict';

const express = require('express');
const fetch = require('node-fetch');
const { pool } = require('../db');
const authMiddleware = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/rateLimiter');
const { parseAIJson } = require('../utils/parseAIJson');

const router = express.Router();
router.use(authMiddleware);

const TABLE = 'ts_policy_rules';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022';

async function callAI(systemPrompt, userPrompt) {
  if (!OPENROUTER_API_KEY) throw Object.assign(new Error('AI service unavailable: OPENROUTER_API_KEY not configured'), { status: 503 });
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'http://localhost:3000', 'X-Title': 'AI Deepfake Detection Platform' },
    body: JSON.stringify({ model: OPENROUTER_MODEL, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], temperature: 0.3, max_tokens: 1500 }),
  });
  if (!res.ok) throw new Error(`OpenRouter error: ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices[0].message.content;
}

function parseAI(raw) { const r = parseAIJson(raw); return r.success ? r.data : { raw_response: raw }; }

// ── CRUD (18) ─────────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const where = []; const params = [];
    if (req.query.status) { params.push(req.query.status); where.push(`status = $${params.length}`); }
    if (req.query.category) { params.push(req.query.category); where.push(`category = $${params.length}`); }
    if (req.query.jurisdiction) { params.push(req.query.jurisdiction); where.push(`jurisdiction = $${params.length}`); }
    const wc = where.length ? `WHERE ${where.join(' AND ')}` : '';
    params.push(limit); params.push(offset);
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} ${wc} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    const cr = await pool.query(`SELECT COUNT(*) FROM ${TABLE} ${wc}`, params.slice(0, params.length - 2));
    res.json({ data: rows, pagination: { page, limit, total: parseInt(cr.rows[0].count), totalPages: Math.ceil(parseInt(cr.rows[0].count) / limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/count', async (req, res) => {
  try {
    const where = []; const params = [];
    if (req.query.status) { params.push(req.query.status); where.push(`status = $${params.length}`); }
    const wc = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const { rows } = await pool.query(`SELECT COUNT(*) FROM ${TABLE} ${wc}`, params);
    res.json({ count: parseInt(rows[0].count) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/search', async (req, res) => {
  try {
    const q = req.query.q || '';
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE policy_name ILIKE $1 OR category ILIKE $1 OR description ILIKE $1 OR jurisdiction ILIKE $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, [`%${q}%`, limit, offset]);
    const cr = await pool.query(`SELECT COUNT(*) FROM ${TABLE} WHERE policy_name ILIKE $1 OR category ILIKE $1 OR description ILIKE $1 OR jurisdiction ILIKE $1`, [`%${q}%`]);
    res.json({ data: rows, pagination: { page, limit, total: parseInt(cr.rows[0].count) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/by-category/:category', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE category = $1 ORDER BY created_at DESC`, [req.params.category]);
    res.json({ data: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/by-jurisdiction/:jurisdiction', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE jurisdiction = $1 ORDER BY created_at DESC`, [req.params.jurisdiction]);
    res.json({ data: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/export/csv', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} ORDER BY created_at DESC`);
    const fields = ['id', 'policy_name', 'policy_version', 'category', 'severity', 'action_on_match', 'jurisdiction', 'is_active', 'effective_from', 'effective_until', 'status', 'created_at'];
    const header = fields.join(',');
    const csvRows = rows.map(r => fields.map(f => `"${String(r[f] ?? '').replace(/"/g, '""')}"`).join(','));
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="policy_rules.csv"');
    res.send([header, ...csvRows].join('\n'));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/stats/summary', async (req, res) => {
  try {
    const [byCategory, bySeverity, total, active] = await Promise.all([
      pool.query(`SELECT category, COUNT(*) FROM ${TABLE} GROUP BY category`),
      pool.query(`SELECT severity, COUNT(*) FROM ${TABLE} GROUP BY severity`),
      pool.query(`SELECT COUNT(*) FROM ${TABLE}`),
      pool.query(`SELECT COUNT(*) FROM ${TABLE} WHERE is_active = true`),
    ]);
    res.json({ byCategory: byCategory.rows, bySeverity: bySeverity.rows, total: parseInt(total.rows[0].count), active: parseInt(active.rows[0].count) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/batch', async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'items array required' });
    const created = [];
    for (const item of items) {
      if (!item.policy_name) continue;
      const { rows } = await pool.query(`INSERT INTO ${TABLE} (policy_name, policy_version, category, description, rule_logic, severity, action_on_match, jurisdiction, is_active, effective_from, effective_until, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [item.policy_name, item.policy_version, item.category, item.description, item.rule_logic ? JSON.stringify(item.rule_logic) : null, item.severity || 'medium', item.action_on_match, item.jurisdiction, item.is_active !== false, item.effective_from, item.effective_until, req.user?.id || null]);
      created.push(rows[0]);
    }
    res.status(201).json({ data: created, count: created.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/batch', async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'items array required' });
    const results = [];
    for (const { id, ...fields } of items) {
      if (!id) { results.push({ error: 'missing id' }); continue; }
      const sets = Object.keys(fields).map((k, i) => `${k} = $${i + 2}`).join(', ');
      if (!sets) { results.push({ error: 'no fields' }); continue; }
      const { rows } = await pool.query(`UPDATE ${TABLE} SET ${sets}, updated_at = NOW() WHERE id = $1 RETURNING *`, [id, ...Object.values(fields)]);
      results.push(rows[0] || { error: 'not found', id });
    }
    res.json({ data: results });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/batch', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'ids array required' });
    const { rowCount } = await pool.query(`UPDATE ${TABLE} SET status = 'deleted', updated_at = NOW() WHERE id = ANY($1::int[])`, [ids]);
    res.json({ updated: rowCount });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/import/csv', async (req, res) => {
  try {
    const { csv } = req.body;
    if (!csv) return res.status(400).json({ error: 'csv field required' });
    const lines = csv.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return res.status(400).json({ error: 'CSV must have header + data rows' });
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    const created = [];
    for (const line of lines.slice(1)) {
      const vals = (line.match(/(".*?"|[^,]+)/g) || []).map(v => v.replace(/^"|"$/g, '').replace(/""/g, '"'));
      const obj = {}; headers.forEach((h, i) => { obj[h] = vals[i] || null; });
      if (!obj.policy_name) continue;
      const { rows } = await pool.query(`INSERT INTO ${TABLE} (policy_name, category, severity, jurisdiction, action_on_match, created_by) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING *`,
        [obj.policy_name, obj.category, obj.severity || 'medium', obj.jurisdiction, obj.action_on_match, req.user?.id || null]);
      if (rows[0]) created.push(rows[0]);
    }
    res.status(201).json({ data: created, count: created.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Policy rule not found' });
    res.json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { policy_name, policy_version, category, description, rule_logic, severity, action_on_match, jurisdiction, is_active, effective_from, effective_until } = req.body;
    if (!policy_name) return res.status(400).json({ error: 'policy_name required' });
    const { rows } = await pool.query(`INSERT INTO ${TABLE} (policy_name, policy_version, category, description, rule_logic, severity, action_on_match, jurisdiction, is_active, effective_from, effective_until, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [policy_name, policy_version, category, description, rule_logic ? JSON.stringify(rule_logic) : null, severity || 'medium', action_on_match, jurisdiction, is_active !== false, effective_from, effective_until, req.user?.id || null]);
    res.status(201).json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const allowed = ['policy_name', 'policy_version', 'category', 'description', 'rule_logic', 'severity', 'action_on_match', 'jurisdiction', 'is_active', 'effective_from', 'effective_until', 'precedent_ids', 'reviewer_training_example', 'status'];
    const fields = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    if (!Object.keys(fields).length) return res.status(400).json({ error: 'No updatable fields' });
    const sets = Object.keys(fields).map((k, i) => `${k} = $${i + 2}`).join(', ');
    const { rows } = await pool.query(`UPDATE ${TABLE} SET ${sets}, updated_at = NOW() WHERE id = $1 RETURNING *`, [req.params.id, ...Object.values(fields)]);
    if (!rows[0]) return res.status(404).json({ error: 'Policy rule not found' });
    res.json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`UPDATE ${TABLE} SET status = 'deleted', updated_at = NOW() WHERE id = $1 RETURNING *`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Policy rule not found' });
    res.json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/archive', async (req, res) => {
  try {
    const { rows } = await pool.query(`UPDATE ${TABLE} SET is_archived = true, updated_at = NOW() WHERE id = $1 RETURNING *`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Policy rule not found' });
    res.json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/restore', async (req, res) => {
  try {
    const { rows } = await pool.query(`UPDATE ${TABLE} SET is_archived = false, status = 'active', is_active = true, updated_at = NOW() WHERE id = $1 RETURNING *`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Policy rule not found' });
    res.json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id/history', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM audit_logs WHERE entity_type = $1 AND entity_id = $2 ORDER BY created_at DESC`, [TABLE, req.params.id]);
    res.json({ data: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── AI Verbs (16) ─────────────────────────────────────────────────────────────

router.post('/ai/classify-policy-match', aiRateLimiter, async (req, res) => {
  try {
    const { id, content_metadata } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Policy rule not found' });
    const rule = rows[0];
    const raw = await callAI('You are a content policy matching classifier. Respond with valid JSON only.',
      `Does this content metadata match the policy rule?
Policy: ${rule.policy_name} | Category: ${rule.category} | Severity: ${rule.severity} | Action: ${rule.action_on_match} | Description: ${rule.description}
Content metadata: ${JSON.stringify(content_metadata || {})}
Respond: { "is_match": true|false, "confidence": "high|medium|low", "match_factors": [...], "recommended_action": "...", "rationale": "..." }`);
    const result = parseAI(raw);
    res.json({ success: true, result, model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/suggest-policy-rule', aiRateLimiter, async (req, res) => {
  try {
    const { category, jurisdiction, observed_pattern } = req.body;
    const raw = await callAI('You are a content policy architect. Respond with valid JSON only.',
      `Suggest a new policy rule for the following context.
Category: ${category || 'general'} | Jurisdiction: ${jurisdiction || 'global'} | Observed pattern: ${observed_pattern || 'not specified'}
Respond: { "policy_name": "...", "category": "...", "description": "...", "severity": "low|medium|high|critical", "action_on_match": "...", "rule_conditions": [...], "rationale": "..." }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/detect-policy-drift', aiRateLimiter, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT id, policy_name, category, severity, effective_from, effective_until, is_active FROM ${TABLE} ORDER BY created_at DESC LIMIT 50`);
    const raw = await callAI('You are a policy governance analyst. Respond with valid JSON only.',
      `Detect policy drift across these ${rows.length} policy rules.
Rules: ${JSON.stringify(rows)}
Respond: { "drift_detected": true|false, "drift_indicators": [...], "severity_shift": "...", "coverage_gaps": [...], "recommendations": [...] }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/predict-decision-consistency', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Policy rule not found' });
    const rule = rows[0];
    const raw = await callAI('You are a policy decision consistency analyst. Respond with valid JSON only.',
      `Predict decision consistency for this policy rule across different reviewers.
Policy: ${rule.policy_name} | Severity: ${rule.severity} | Description: ${rule.description} | Category: ${rule.category}
Respond: { "consistency_score": 0-100, "ambiguity_factors": [...], "edge_case_risks": [...], "clarity_recommendations": [...] }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/recommend-policy-refinement', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Policy rule not found' });
    const rule = rows[0];
    const raw = await callAI('You are a content policy refinement advisor. Respond with valid JSON only.',
      `Recommend refinements for this policy rule.
Policy: ${rule.policy_name} | Description: ${rule.description} | Category: ${rule.category} | Severity: ${rule.severity} | Jurisdiction: ${rule.jurisdiction}
Respond: { "current_weaknesses": [...], "recommended_refinements": [...], "examples_to_add": [...], "precedent_references": [...], "expected_improvement": "..." }`);
    const result = parseAI(raw);
    await pool.query(`UPDATE ${TABLE} SET ai_result = $1, updated_at = NOW() WHERE id = $2`, [JSON.stringify(result), id]);
    res.json({ success: true, result, model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/score-policy-clarity', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Policy rule not found' });
    const rule = rows[0];
    const raw = await callAI('You are a policy clarity assessor. Respond with valid JSON only.',
      `Score the clarity of this policy rule for reviewers.
Policy: ${rule.policy_name} | Description: ${rule.description} | Category: ${rule.category}
Respond: { "clarity_score": 0-100, "readability": "...", "specificity": "...", "ambiguous_terms": [...], "improvement_suggestions": [...] }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/generate-policy-explanation', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Policy rule not found' });
    const rule = rows[0];
    const raw = await callAI('You are a policy communications writer. Respond with valid JSON only.',
      `Generate a plain-language explanation of this policy rule for users and reviewers.
Policy: ${rule.policy_name} | Description: ${rule.description} | Severity: ${rule.severity} | Action: ${rule.action_on_match}
Respond: { "user_explanation": "...", "reviewer_guidance": "...", "examples_of_violation": [...], "examples_of_compliance": [...], "appeal_rights": "..." }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/summarize-policy-events', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const [ruleRes, queueRes] = await Promise.all([
      pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]),
      pool.query(`SELECT decision, COUNT(*) FROM ts_review_queue WHERE policy_rule_id = $1 GROUP BY decision`, [id]),
    ]);
    if (!ruleRes.rows[0]) return res.status(404).json({ error: 'Policy rule not found' });
    const raw = await callAI('You are a policy event analyst. Respond with valid JSON only.',
      `Summarize enforcement events for this policy rule.
Rule: ${JSON.stringify(ruleRes.rows[0])} | Decision distribution: ${JSON.stringify(queueRes.rows)}
Respond: { "total_enforcements": "...", "decision_breakdown": {...}, "effectiveness_assessment": "...", "common_edge_cases": [...], "summary": "..." }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/validate-policy-against-law', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Policy rule not found' });
    const rule = rows[0];
    const raw = await callAI('You are a legal compliance validator for content policy. Respond with valid JSON only.',
      `Validate this policy rule against applicable legal frameworks.
Policy: ${rule.policy_name} | Jurisdiction: ${rule.jurisdiction} | Description: ${rule.description} | Action: ${rule.action_on_match}
Respond: { "legal_alignment": "aligned|partial|misaligned", "applicable_laws": [...], "compliance_gaps": [...], "recommended_legal_review": "...", "risk_rating": "low|medium|high" }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/suggest-cross-policy-conflict-resolution', aiRateLimiter, async (req, res) => {
  try {
    const { id1, id2 } = req.body;
    if (!id1 || !id2) return res.status(400).json({ error: 'id1 and id2 required' });
    const [r1, r2] = await Promise.all([pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id1]), pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id2])]);
    if (!r1.rows[0] || !r2.rows[0]) return res.status(404).json({ error: 'One or both rules not found' });
    const raw = await callAI('You are a policy conflict resolution specialist. Respond with valid JSON only.',
      `Identify and resolve conflicts between these two policy rules.
Rule 1: ${JSON.stringify(r1.rows[0])} | Rule 2: ${JSON.stringify(r2.rows[0])}
Respond: { "conflict_detected": true|false, "conflict_type": "...", "conflicting_elements": [...], "resolution_options": [...], "recommended_resolution": "..." }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/detect-policy-ambiguity', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Policy rule not found' });
    const rule = rows[0];
    const raw = await callAI('You are a policy language analyst. Respond with valid JSON only.',
      `Detect ambiguities in this policy rule that could lead to inconsistent enforcement.
Policy: ${rule.policy_name} | Description: ${rule.description} | Category: ${rule.category}
Respond: { "ambiguity_score": 0-100, "ambiguous_phrases": [...], "interpretation_risks": [...], "clarification_suggestions": [...] }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/classify-edge-case', aiRateLimiter, async (req, res) => {
  try {
    const { id, edge_case_description } = req.body;
    if (!id || !edge_case_description) return res.status(400).json({ error: 'id and edge_case_description required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Policy rule not found' });
    const rule = rows[0];
    const raw = await callAI('You are a content policy edge case classifier. Respond with valid JSON only.',
      `Classify this edge case against the policy rule.
Policy: ${rule.policy_name} | Description: ${rule.description} | Severity: ${rule.severity}
Edge case: ${edge_case_description}
Respond: { "classification": "violates|borderline|does_not_violate", "applicable_subcategory": "...", "decision_rationale": "...", "precedent_recommendation": "..." }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/predict-precedent-application', aiRateLimiter, async (req, res) => {
  try {
    const { id, scenario } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Policy rule not found' });
    const rule = rows[0];
    const raw = await callAI('You are a trust & safety precedent analyst. Respond with valid JSON only.',
      `Predict how existing precedents apply to this scenario under this policy rule.
Policy: ${rule.policy_name} | Category: ${rule.category} | Precedents: ${rule.precedent_ids || 'none on record'} | Scenario: ${scenario || 'general'}
Respond: { "applicable_precedents": [...], "predicted_outcome": "...", "confidence": "high|medium|low", "distinguishing_factors": [...] }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/recommend-deprecation', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Policy rule not found' });
    const rule = rows[0];
    const raw = await callAI('You are a policy lifecycle manager. Respond with valid JSON only.',
      `Should this policy rule be deprecated?
Policy: ${rule.policy_name} | Version: ${rule.policy_version} | Effective until: ${rule.effective_until} | Active: ${rule.is_active} | Category: ${rule.category}
Respond: { "recommend_deprecation": true|false, "rationale": "...", "replacement_suggestion": "...", "migration_path": "...", "timeline": "..." }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/generate-reviewer-training-example', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Policy rule not found' });
    const rule = rows[0];
    const raw = await callAI('You are a trust & safety training content creator. Respond with valid JSON only.',
      `Generate reviewer training examples for this policy rule. Do not use real cases; create hypothetical, generic metadata-level examples only.
Policy: ${rule.policy_name} | Description: ${rule.description} | Category: ${rule.category} | Severity: ${rule.severity}
Respond: { "clear_violation_example": "...", "borderline_example": "...", "clear_compliance_example": "...", "discussion_points": [...], "decision_guidance": "..." }`);
    const result = parseAI(raw);
    await pool.query(`UPDATE ${TABLE} SET reviewer_training_example = $1, updated_at = NOW() WHERE id = $2`, [JSON.stringify(result), id]);
    res.json({ success: true, result, model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/score-decision-explainability', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Policy rule not found' });
    const rule = rows[0];
    const raw = await callAI('You are a decision transparency evaluator. Respond with valid JSON only.',
      `Score how explainable decisions made under this policy rule would be to users who receive an enforcement action.
Policy: ${rule.policy_name} | Action: ${rule.action_on_match} | Description: ${rule.description}
Respond: { "explainability_score": 0-100, "user_understanding_likelihood": "...", "transparency_gaps": [...], "improvement_suggestions": [...] }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

module.exports = router;
