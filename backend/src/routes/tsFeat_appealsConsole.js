/**
 * Trust & Safety — Appeals Console
 * Table: ts_appeals
 * Mount: /api/ts/appeals-console
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

const TABLE = 'ts_appeals';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022';

async function callAI(sys, user) {
  if (!OPENROUTER_API_KEY) throw Object.assign(new Error('AI unavailable: OPENROUTER_API_KEY not configured'), { status: 503 });
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'http://localhost:3000', 'X-Title': 'AI Deepfake Detection Platform' },
    body: JSON.stringify({ model: OPENROUTER_MODEL, messages: [{ role: 'system', content: sys }, { role: 'user', content: user }], temperature: 0.3, max_tokens: 1500 }),
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
    if (req.query.appeal_status) { params.push(req.query.appeal_status); where.push(`appeal_status = $${params.length}`); }
    if (req.query.appeal_tier) { params.push(req.query.appeal_tier); where.push(`appeal_tier = $${params.length}`); }
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
    if (req.query.appeal_status) { params.push(req.query.appeal_status); where.push(`appeal_status = $${params.length}`); }
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
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE appealed_by ILIKE $1 OR appeal_type ILIKE $1 OR appeal_tier ILIKE $1 OR appeal_status ILIKE $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, [`%${q}%`, limit, offset]);
    const cr = await pool.query(`SELECT COUNT(*) FROM ${TABLE} WHERE appealed_by ILIKE $1 OR appeal_type ILIKE $1 OR appeal_tier ILIKE $1 OR appeal_status ILIKE $1`, [`%${q}%`]);
    res.json({ data: rows, pagination: { page, limit, total: parseInt(cr.rows[0].count) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/by-user/:userId', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE appealed_by = $1 ORDER BY created_at DESC`, [req.params.userId]);
    res.json({ data: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/by-decision/:decisionId', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE original_decision_id = $1 ORDER BY created_at DESC`, [req.params.decisionId]);
    res.json({ data: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/export/csv', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} ORDER BY created_at DESC`);
    const fields = ['id', 'original_decision_id', 'appealed_by', 'appeal_type', 'appeal_tier', 'appeal_status', 'reviewer_decision', 'reviewed_at', 'reversed', 'bad_faith_flag', 'status', 'created_at'];
    const header = fields.join(',');
    const csvRows = rows.map(r => fields.map(f => `"${String(r[f] ?? '').replace(/"/g, '""')}"`).join(','));
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="appeals.csv"');
    res.send([header, ...csvRows].join('\n'));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/stats/summary', async (req, res) => {
  try {
    const [byStatus, byTier, reversed, total] = await Promise.all([
      pool.query(`SELECT appeal_status, COUNT(*) FROM ${TABLE} GROUP BY appeal_status`),
      pool.query(`SELECT appeal_tier, COUNT(*) FROM ${TABLE} GROUP BY appeal_tier`),
      pool.query(`SELECT COUNT(*) FROM ${TABLE} WHERE reversed = true`),
      pool.query(`SELECT COUNT(*) FROM ${TABLE}`),
    ]);
    res.json({ byStatus: byStatus.rows, byTier: byTier.rows, reversedCount: parseInt(reversed.rows[0].count), total: parseInt(total.rows[0].count) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/batch', async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'items array required' });
    const created = [];
    for (const item of items) {
      const { rows } = await pool.query(`INSERT INTO ${TABLE} (original_decision_id, appealed_by, appeal_type, appeal_tier, evidence_submitted, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [item.original_decision_id, item.appealed_by, item.appeal_type, item.appeal_tier || 'standard', item.evidence_submitted ? JSON.stringify(item.evidence_submitted) : null, req.user?.id || null]);
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
      const { rows } = await pool.query(`INSERT INTO ${TABLE} (appealed_by, appeal_type, appeal_tier, created_by) VALUES ($1,$2,$3,$4) RETURNING *`,
        [obj.appealed_by, obj.appeal_type, obj.appeal_tier || 'standard', req.user?.id || null]);
      created.push(rows[0]);
    }
    res.status(201).json({ data: created, count: created.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Appeal not found' });
    res.json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { original_decision_id, appealed_by, appeal_type, appeal_tier, evidence_submitted } = req.body;
    const { rows } = await pool.query(`INSERT INTO ${TABLE} (original_decision_id, appealed_by, appeal_type, appeal_tier, evidence_submitted, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [original_decision_id, appealed_by, appeal_type, appeal_tier || 'standard', evidence_submitted ? JSON.stringify(evidence_submitted) : null, req.user?.id || null]);
    res.status(201).json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const allowed = ['appeal_type', 'appeal_tier', 'evidence_submitted', 'appeal_status', 'reviewer_decision', 'reviewer_notes', 'reviewed_at', 'reversed', 'precedent_citation', 'user_letter', 'process_quality_score', 'bad_faith_flag', 'status'];
    const fields = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    if (!Object.keys(fields).length) return res.status(400).json({ error: 'No updatable fields' });
    const sets = Object.keys(fields).map((k, i) => `${k} = $${i + 2}`).join(', ');
    const { rows } = await pool.query(`UPDATE ${TABLE} SET ${sets}, updated_at = NOW() WHERE id = $1 RETURNING *`, [req.params.id, ...Object.values(fields)]);
    if (!rows[0]) return res.status(404).json({ error: 'Appeal not found' });
    res.json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`UPDATE ${TABLE} SET status = 'deleted', updated_at = NOW() WHERE id = $1 RETURNING *`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Appeal not found' });
    res.json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/archive', async (req, res) => {
  try {
    const { rows } = await pool.query(`UPDATE ${TABLE} SET is_archived = true, updated_at = NOW() WHERE id = $1 RETURNING *`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Appeal not found' });
    res.json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/restore', async (req, res) => {
  try {
    const { rows } = await pool.query(`UPDATE ${TABLE} SET is_archived = false, status = 'active', updated_at = NOW() WHERE id = $1 RETURNING *`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Appeal not found' });
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

router.post('/ai/classify-appeal-strength', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Appeal not found' });
    const appeal = rows[0];
    const raw = await callAI('You are an appeals strength classifier. Respond with valid JSON only.',
      `Classify the strength of this appeal based on metadata only.
Appeal type: ${appeal.appeal_type} | Tier: ${appeal.appeal_tier} | Evidence submitted: ${appeal.evidence_submitted ? 'yes' : 'no'} | Bad faith flag: ${appeal.bad_faith_flag}
Respond: { "strength": "strong|moderate|weak|frivolous", "strength_factors": [...], "evidence_completeness": "...", "recommended_priority": "..." }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/predict-appeal-outcome', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Appeal not found' });
    const appeal = rows[0];
    const raw = await callAI('You are an appeals outcome predictor. Respond with valid JSON only.',
      `Predict the likely outcome of this appeal.
Tier: ${appeal.appeal_tier} | Type: ${appeal.appeal_type} | Evidence: ${appeal.evidence_submitted ? 'submitted' : 'none'} | Bad faith: ${appeal.bad_faith_flag}
Respond: { "predicted_outcome": "upheld|reversed|partial_reversal|pending_evidence", "confidence": "high|medium|low", "key_factors": [...], "similar_case_pattern": "..." }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/suggest-evidence-needed', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Appeal not found' });
    const appeal = rows[0];
    const raw = await callAI('You are an appeals evidence advisor. Respond with valid JSON only.',
      `Suggest what additional evidence would strengthen this appeal.
Type: ${appeal.appeal_type} | Tier: ${appeal.appeal_tier} | Current evidence: ${appeal.evidence_submitted ? JSON.stringify(appeal.evidence_submitted) : 'none'}
Respond: { "missing_evidence_types": [...], "priority_evidence": "...", "evidence_gathering_tips": [...], "likelihood_improvement": "..." }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/generate-appeal-response', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Appeal not found' });
    const appeal = rows[0];
    const raw = await callAI('You are a trust & safety appeals response writer. Respond with valid JSON only.',
      `Generate a draft response to this appeal.
Decision: ${appeal.reviewer_decision || 'pending'} | Type: ${appeal.appeal_type} | Tier: ${appeal.appeal_tier} | Reversed: ${appeal.reversed}
Respond: { "response_letter": "...", "decision_explanation": "...", "next_steps": [...], "further_appeal_rights": "...", "tone": "formal|empathetic|firm" }`);
    const result = parseAI(raw);
    await pool.query(`UPDATE ${TABLE} SET user_letter = $1, updated_at = NOW() WHERE id = $2`, [result.response_letter || JSON.stringify(result), id]);
    res.json({ success: true, result, model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/summarize-appeal-history', aiRateLimiter, async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });
    const { rows } = await pool.query(`SELECT id, appeal_type, appeal_tier, appeal_status, reversed, bad_faith_flag, created_at FROM ${TABLE} WHERE appealed_by = $1 ORDER BY created_at DESC`, [user_id]);
    const raw = await callAI('You are an appeals history analyst. Respond with valid JSON only.',
      `Summarize the appeal history for user ${user_id} (${rows.length} appeals).
History: ${JSON.stringify(rows.slice(0, 20))}
Respond: { "total_appeals": ${rows.length}, "reversal_rate": "...", "pattern": "...", "bad_faith_risk": "...", "summary": "..." }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/score-original-decision', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Appeal not found' });
    const appeal = rows[0];
    const raw = await callAI('You are a decision quality reviewer for appeals. Respond with valid JSON only.',
      `Score the quality of the original enforcement decision based on the appeal metadata.
Appeal type: ${appeal.appeal_type} | Evidence submitted: ${appeal.evidence_submitted ? 'yes' : 'no'} | Reversed: ${appeal.reversed} | Process quality: ${appeal.process_quality_score}
Respond: { "original_decision_quality_score": 0-100, "procedural_issues": [...], "evidence_handling": "...", "improvement_recommendations": [...] }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/validate-procedural-fairness', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Appeal not found' });
    const appeal = rows[0];
    const raw = await callAI('You are a procedural fairness validator for content appeals. Respond with valid JSON only.',
      `Validate procedural fairness for this appeal process.
Tier: ${appeal.appeal_tier} | Evidence accepted: ${appeal.evidence_submitted ? 'yes' : 'no'} | Reviewed at: ${appeal.reviewed_at || 'pending'} | Process quality score: ${appeal.process_quality_score}
Respond: { "fairness_score": 0-100, "procedural_compliance": "compliant|minor_issues|major_issues", "due_process_elements": {...}, "remediation_needed": [...] }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/recommend-policy-clarification', aiRateLimiter, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT appeal_type, COUNT(*) AS cnt, SUM(CASE WHEN reversed THEN 1 ELSE 0 END) AS reversals FROM ${TABLE} GROUP BY appeal_type ORDER BY reversals DESC LIMIT 10`);
    const raw = await callAI('You are a policy improvement analyst. Respond with valid JSON only.',
      `Based on appeals patterns, recommend policy clarifications.
Appeals by type with reversal rates: ${JSON.stringify(rows)}
Respond: { "high_reversal_patterns": [...], "recommended_clarifications": [...], "policy_gaps_identified": [...], "priority_actions": [...] }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/classify-appeal-tier', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Appeal not found' });
    const appeal = rows[0];
    const raw = await callAI('You are an appeals tier classifier. Respond with valid JSON only.',
      `Classify the appropriate appeal tier for this case.
Type: ${appeal.appeal_type} | Evidence: ${appeal.evidence_submitted ? 'submitted' : 'none'} | Current tier: ${appeal.appeal_tier}
Respond: { "recommended_tier": "standard|expedited|executive|legal", "tier_rationale": "...", "tier_criteria_met": [...], "escalation_warranted": true|false }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/detect-bad-faith-appeal', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const [appealRes, histRes] = await Promise.all([
      pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]),
      pool.query(`SELECT COUNT(*) AS total, SUM(CASE WHEN bad_faith_flag THEN 1 ELSE 0 END) AS bad_faith_count FROM ${TABLE} WHERE appealed_by = (SELECT appealed_by FROM ${TABLE} WHERE id = $1)`, [id]),
    ]);
    if (!appealRes.rows[0]) return res.status(404).json({ error: 'Appeal not found' });
    const raw = await callAI('You are a bad-faith appeal detector. Respond with valid JSON only.',
      `Assess whether this appeal shows signs of bad faith.
Appeal type: ${appealRes.rows[0].appeal_type} | Previous appeals: ${histRes.rows[0].total} | Prior bad faith flags: ${histRes.rows[0].bad_faith_count}
Respond: { "bad_faith_detected": true|false, "bad_faith_score": 0-100, "indicators": [...], "recommended_action": "...", "pattern_type": "..." }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/predict-reversal-rate', aiRateLimiter, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT appeal_tier, appeal_type, COUNT(*) AS total, SUM(CASE WHEN reversed THEN 1 ELSE 0 END) AS reversals FROM ${TABLE} WHERE appeal_status = 'decided' GROUP BY appeal_tier, appeal_type`);
    const raw = await callAI('You are an appeals outcome statistician. Respond with valid JSON only.',
      `Predict reversal rates by category.
Historical data: ${JSON.stringify(rows)}
Respond: { "overall_reversal_rate": "...", "by_tier": {...}, "by_type": {...}, "trend": "...", "recommendations": [...] }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/recommend-precedent-citation', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Appeal not found' });
    const appeal = rows[0];
    const similar = await pool.query(`SELECT id, appeal_type, appeal_tier, reviewer_decision, reversed FROM ${TABLE} WHERE appeal_type = $1 AND appeal_status = 'decided' ORDER BY reviewed_at DESC LIMIT 10`, [appeal.appeal_type]);
    const raw = await callAI('You are an appeals precedent researcher. Respond with valid JSON only.',
      `Recommend precedent citations for this appeal.
Current: ${appeal.appeal_type} / ${appeal.appeal_tier} | Similar decided cases: ${JSON.stringify(similar.rows)}
Respond: { "recommended_precedents": [...], "most_analogous_case_id": "...", "distinguishing_factors": [...], "precedent_strength": "strong|moderate|weak" }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/generate-user-letter', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Appeal not found' });
    const appeal = rows[0];
    const raw = await callAI('You are a user communications writer for a trust & safety team. Respond with valid JSON only.',
      `Generate a clear, empathetic user notification letter for this appeal outcome.
Decision: ${appeal.reviewer_decision || 'pending'} | Reversed: ${appeal.reversed} | Tier: ${appeal.appeal_tier}
Respond: { "letter_subject": "...", "letter_body": "...", "tone": "...", "key_messages": [...], "next_steps_for_user": [...] }`);
    const result = parseAI(raw);
    await pool.query(`UPDATE ${TABLE} SET user_letter = $1, updated_at = NOW() WHERE id = $2`, [result.letter_body || JSON.stringify(result), id]);
    res.json({ success: true, result, model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/score-appeal-process-quality', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Appeal not found' });
    const appeal = rows[0];
    const raw = await callAI('You are a process quality auditor. Respond with valid JSON only.',
      `Score the quality of the appeals process for this case.
Evidence accepted: ${appeal.evidence_submitted ? 'yes' : 'no'} | Response provided: ${appeal.user_letter ? 'yes' : 'no'} | Precedent cited: ${appeal.precedent_citation ? 'yes' : 'no'} | Decision documented: ${appeal.reviewer_notes ? 'yes' : 'no'}
Respond: { "process_quality_score": 0-100, "completeness_gaps": [...], "best_practice_compliance": "...", "improvement_actions": [...] }`);
    const result = parseAI(raw);
    await pool.query(`UPDATE ${TABLE} SET process_quality_score = $1, updated_at = NOW() WHERE id = $2`, [result.process_quality_score || null, id]);
    res.json({ success: true, result, model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/suggest-appeals-policy-change', aiRateLimiter, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT appeal_type, appeal_tier, COUNT(*) AS total, SUM(CASE WHEN reversed THEN 1 ELSE 0 END) AS reversals, AVG(process_quality_score) AS avg_quality FROM ${TABLE} GROUP BY appeal_type, appeal_tier ORDER BY reversals DESC`);
    const raw = await callAI('You are a policy reform advisor for appeals processes. Respond with valid JSON only.',
      `Suggest appeals policy changes based on outcomes data.
Data: ${JSON.stringify(rows)}
Respond: { "policy_changes": [...], "structural_improvements": [...], "sla_recommendations": [...], "tier_restructuring": "...", "expected_outcomes": [...] }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/summarize-appeals-trends', aiRateLimiter, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT DATE_TRUNC('month', created_at) AS month, COUNT(*) AS total, SUM(CASE WHEN reversed THEN 1 ELSE 0 END) AS reversals FROM ${TABLE} GROUP BY 1 ORDER BY 1 DESC LIMIT 12`);
    const raw = await callAI('You are a trend analyst for appeals data. Respond with valid JSON only.',
      `Summarize appeals trends over the past 12 months.
Monthly data: ${JSON.stringify(rows)}
Respond: { "trend_direction": "increasing|stable|decreasing", "reversal_rate_trend": "...", "peak_month": "...", "yoy_change": "...", "forecast": "...", "summary": "..." }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

module.exports = router;
