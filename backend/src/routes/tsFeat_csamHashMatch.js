/**
 * Trust & Safety — CSAM Hash Match
 * Table: ts_csam_hash_matches
 * Mount: /api/ts/csam-hash-match
 *
 * CRITICAL: This module stores ONLY cryptographic hash references and severity
 * labels. No actual content, no descriptions of content. Hash values are
 * treated as opaque identifiers only.
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

const TABLE = 'ts_csam_hash_matches';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022';

async function callAI(systemPrompt, userPrompt) {
  if (!OPENROUTER_API_KEY) throw Object.assign(new Error('AI service unavailable: OPENROUTER_API_KEY not configured'), { status: 503 });
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'AI Deepfake Detection Platform',
    },
    body: JSON.stringify({ model: OPENROUTER_MODEL, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], temperature: 0.3, max_tokens: 1500 }),
  });
  if (!res.ok) throw new Error(`OpenRouter error: ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices[0].message.content;
}

function parseAI(raw) {
  const r = parseAIJson(raw);
  return r.success ? r.data : { raw_response: raw };
}

// ── CRUD (18) ─────────────────────────────────────────────────────────────────

// 1. List
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const where = []; const params = [];
    if (req.query.status) { params.push(req.query.status); where.push(`status = $${params.length}`); }
    if (req.query.severity_label) { params.push(req.query.severity_label); where.push(`severity_label = $${params.length}`); }
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    params.push(limit); params.push(offset);
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} ${whereClause} ORDER BY matched_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    const countRes = await pool.query(`SELECT COUNT(*) FROM ${TABLE} ${whereClause}`, params.slice(0, params.length - 2));
    res.json({ data: rows, pagination: { page, limit, total: parseInt(countRes.rows[0].count), totalPages: Math.ceil(parseInt(countRes.rows[0].count) / limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. Count
router.get('/count', async (req, res) => {
  try {
    const where = []; const params = [];
    if (req.query.status) { params.push(req.query.status); where.push(`status = $${params.length}`); }
    if (req.query.severity_label) { params.push(req.query.severity_label); where.push(`severity_label = $${params.length}`); }
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const { rows } = await pool.query(`SELECT COUNT(*) FROM ${TABLE} ${whereClause}`, params);
    res.json({ count: parseInt(rows[0].count) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 3. Search
router.get('/search', async (req, res) => {
  try {
    const q = req.query.q || '';
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const { rows } = await pool.query(
      `SELECT * FROM ${TABLE} WHERE match_source ILIKE $1 OR platform_origin ILIKE $1 OR actor_id ILIKE $1 OR severity_label ILIKE $1 ORDER BY matched_at DESC LIMIT $2 OFFSET $3`,
      [`%${q}%`, limit, offset]
    );
    const countRes = await pool.query(`SELECT COUNT(*) FROM ${TABLE} WHERE match_source ILIKE $1 OR platform_origin ILIKE $1 OR actor_id ILIKE $1 OR severity_label ILIKE $1`, [`%${q}%`]);
    res.json({ data: rows, pagination: { page, limit, total: parseInt(countRes.rows[0].count) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 4. By content_id
router.get('/by-content/:contentId', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE content_id = $1 ORDER BY matched_at DESC`, [req.params.contentId]);
    res.json({ data: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 5. By actor_id
router.get('/by-actor/:actorId', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE actor_id = $1 ORDER BY matched_at DESC`, [req.params.actorId]);
    res.json({ data: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 6. Export CSV
router.get('/export/csv', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} ORDER BY matched_at DESC`);
    const fields = ['id', 'hash_algorithm', 'hash_set_version', 'match_source', 'severity_label', 'confidence_score', 'content_id', 'platform_origin', 'actor_id', 'matched_at', 'reported_to_ncmec', 'ncmec_report_id', 'law_enforcement_notified', 'account_action', 'preservation_status', 'cross_platform_shared', 'status', 'created_at'];
    const header = fields.join(',');
    const csvRows = rows.map(r => fields.map(f => `"${String(r[f] ?? '').replace(/"/g, '""')}"`).join(','));
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="csam_hash_matches.csv"');
    res.send([header, ...csvRows].join('\n'));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 7. Stats summary
router.get('/stats/summary', async (req, res) => {
  try {
    const [bySeverity, bySource, byAction, total] = await Promise.all([
      pool.query(`SELECT severity_label, COUNT(*) AS count FROM ${TABLE} GROUP BY severity_label`),
      pool.query(`SELECT match_source, COUNT(*) AS count FROM ${TABLE} GROUP BY match_source`),
      pool.query(`SELECT account_action, COUNT(*) AS count FROM ${TABLE} GROUP BY account_action`),
      pool.query(`SELECT COUNT(*) FROM ${TABLE}`),
    ]);
    res.json({ bySeverity: bySeverity.rows, bySource: bySource.rows, byAction: byAction.rows, total: parseInt(total.rows[0].count) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 8. Batch create
router.post('/batch', async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'items array required' });
    const created = [];
    for (const item of items) {
      const { hash_value, hash_algorithm, hash_set_version, match_source, severity_label, confidence_score, content_id, platform_origin, actor_id } = item;
      if (!hash_value) continue;
      const { rows } = await pool.query(
        `INSERT INTO ${TABLE} (hash_value, hash_algorithm, hash_set_version, match_source, severity_label, confidence_score, content_id, platform_origin, actor_id, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [hash_value, hash_algorithm || 'MD5', hash_set_version, match_source, severity_label || 'unknown', confidence_score, content_id, platform_origin, actor_id, req.user?.id || null]
      );
      created.push(rows[0]);
    }
    res.status(201).json({ data: created, count: created.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 9. Batch update
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

// 10. Batch delete (soft)
router.delete('/batch', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'ids array required' });
    const { rowCount } = await pool.query(`UPDATE ${TABLE} SET status = 'deleted', updated_at = NOW() WHERE id = ANY($1::int[])`, [ids]);
    res.json({ updated: rowCount });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 11. Import CSV
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
      const obj = {};
      headers.forEach((h, i) => { obj[h] = vals[i] || null; });
      if (!obj.hash_value) continue;
      const { rows } = await pool.query(
        `INSERT INTO ${TABLE} (hash_value, hash_algorithm, match_source, severity_label, content_id, platform_origin, actor_id, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING RETURNING *`,
        [obj.hash_value, obj.hash_algorithm || 'MD5', obj.match_source, obj.severity_label || 'unknown', obj.content_id, obj.platform_origin, obj.actor_id, req.user?.id || null]
      );
      if (rows[0]) created.push(rows[0]);
    }
    res.status(201).json({ data: created, count: created.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 12. Get by ID
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Record not found' });
    res.json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 13. Create
router.post('/', async (req, res) => {
  try {
    const { hash_value, hash_algorithm, hash_set_version, match_source, severity_label, confidence_score, content_id, platform_origin, actor_id } = req.body;
    if (!hash_value) return res.status(400).json({ error: 'hash_value required' });
    const { rows } = await pool.query(
      `INSERT INTO ${TABLE} (hash_value, hash_algorithm, hash_set_version, match_source, severity_label, confidence_score, content_id, platform_origin, actor_id, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [hash_value, hash_algorithm || 'MD5', hash_set_version, match_source, severity_label || 'unknown', confidence_score, content_id, platform_origin, actor_id, req.user?.id || null]
    );
    res.status(201).json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 14. Update
router.put('/:id', async (req, res) => {
  try {
    const allowed = ['hash_algorithm', 'hash_set_version', 'match_source', 'severity_label', 'confidence_score', 'content_id', 'platform_origin', 'actor_id', 'reported_to_ncmec', 'ncmec_report_id', 'law_enforcement_notified', 'account_action', 'preservation_status', 'cross_platform_shared', 'status'];
    const fields = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    if (!Object.keys(fields).length) return res.status(400).json({ error: 'No updatable fields provided' });
    const sets = Object.keys(fields).map((k, i) => `${k} = $${i + 2}`).join(', ');
    const { rows } = await pool.query(`UPDATE ${TABLE} SET ${sets}, updated_at = NOW() WHERE id = $1 RETURNING *`, [req.params.id, ...Object.values(fields)]);
    if (!rows[0]) return res.status(404).json({ error: 'Record not found' });
    res.json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 15. Soft-delete
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`UPDATE ${TABLE} SET status = 'deleted', updated_at = NOW() WHERE id = $1 RETURNING *`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Record not found' });
    res.json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 16. Archive
router.post('/:id/archive', async (req, res) => {
  try {
    const { rows } = await pool.query(`UPDATE ${TABLE} SET is_archived = true, updated_at = NOW() WHERE id = $1 RETURNING *`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Record not found' });
    res.json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 17. Restore
router.post('/:id/restore', async (req, res) => {
  try {
    const { rows } = await pool.query(`UPDATE ${TABLE} SET is_archived = false, status = 'active', updated_at = NOW() WHERE id = $1 RETURNING *`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Record not found' });
    res.json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 18. History (audit log entries for this record)
router.get('/:id/history', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM audit_logs WHERE entity_type = $1 AND entity_id = $2 ORDER BY created_at DESC`, [TABLE, req.params.id]);
    res.json({ data: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── AI Verbs (16) ─────────────────────────────────────────────────────────────

// AI 1: classify-match-confidence
router.post('/ai/classify-match-confidence', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Record not found' });
    const rec = rows[0];
    const raw = await callAI(
      'You are a hash-match confidence classifier for a content safety platform. Respond with valid JSON only.',
      `Classify the confidence of this hash match based on metadata only (NO content evaluation).
Match source: ${rec.match_source} | Hash algorithm: ${rec.hash_algorithm} | Hash set version: ${rec.hash_set_version} | Current severity: ${rec.severity_label} | Confidence score: ${rec.confidence_score}
Respond: { "confidence_tier": "high|medium|low", "reliability_factors": [...], "recommended_action": "...", "rationale": "..." }`
    );
    const result = parseAI(raw);
    await pool.query(`UPDATE ${TABLE} SET ai_result = $1, updated_at = NOW() WHERE id = $2`, [JSON.stringify(result), id]);
    res.json({ success: true, result, model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

// AI 2: recommend-immediate-report
router.post('/ai/recommend-immediate-report', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Record not found' });
    const rec = rows[0];
    const raw = await callAI(
      'You are a legal compliance advisor for a trust & safety team. Respond with valid JSON only.',
      `Based on metadata only, assess whether immediate reporting to NCMEC is recommended.
Severity: ${rec.severity_label} | Source: ${rec.match_source} | Already reported: ${rec.reported_to_ncmec} | Law enforcement notified: ${rec.law_enforcement_notified}
Respond: { "recommend_immediate_report": true|false, "urgency": "immediate|within_24h|routine", "legal_basis": "...", "suggested_steps": [...] }`
    );
    const result = parseAI(raw);
    res.json({ success: true, result, model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

// AI 3: score-hash-quality
router.post('/ai/score-hash-quality', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Record not found' });
    const rec = rows[0];
    const raw = await callAI(
      'You are a digital forensics hash quality analyst. Respond with valid JSON only.',
      `Score the quality of this hash entry based on metadata completeness and algorithm strength.
Algorithm: ${rec.hash_algorithm} | Set version: ${rec.hash_set_version} | Source: ${rec.match_source} | Has content_id: ${!!rec.content_id} | Has actor_id: ${!!rec.actor_id}
Respond: { "quality_score": 0-100, "algorithm_strength": "strong|moderate|weak", "completeness_gaps": [...], "improvement_suggestions": [...] }`
    );
    const result = parseAI(raw);
    res.json({ success: true, result, model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

// AI 4: generate-ncmec-cybertip-draft
router.post('/ai/generate-ncmec-cybertip-draft', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Record not found' });
    const rec = rows[0];
    const raw = await callAI(
      'You are a compliance officer generating CyberTipline report drafts for NCMEC. Respond with valid JSON only. Do NOT include or describe any actual content.',
      `Generate a CyberTipline report draft based on hash metadata only.
Record ID: ${rec.id} | Match source: ${rec.match_source} | Platform: ${rec.platform_origin} | Hash algorithm: ${rec.hash_algorithm} | Severity: ${rec.severity_label} | Matched at: ${rec.matched_at}
Respond: { "report_type": "CyberTipline", "incident_type": "...", "platform_info": "...", "hash_metadata_summary": "...", "recommended_sections": [...], "draft_narrative": "..." }`
    );
    const result = parseAI(raw);
    res.json({ success: true, result, model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

// AI 5: summarize-match-events
router.post('/ai/summarize-match-events', aiRateLimiter, async (req, res) => {
  try {
    const { actor_id, limit: lim = 50 } = req.body;
    const { rows } = actor_id
      ? await pool.query(`SELECT id, hash_algorithm, severity_label, match_source, platform_origin, matched_at, reported_to_ncmec, account_action FROM ${TABLE} WHERE actor_id = $1 ORDER BY matched_at DESC LIMIT $2`, [actor_id, lim])
      : await pool.query(`SELECT id, hash_algorithm, severity_label, match_source, platform_origin, matched_at, reported_to_ncmec, account_action FROM ${TABLE} ORDER BY matched_at DESC LIMIT $1`, [lim]);
    const raw = await callAI(
      'You are a trust & safety analyst. Summarize hash match event patterns. Respond with valid JSON only.',
      `Summarize these ${rows.length} hash match event records (metadata only):
${JSON.stringify(rows.slice(0, 20))}
Respond: { "total_events": ${rows.length}, "severity_distribution": {...}, "top_sources": [...], "reporting_rate": "...", "trend_summary": "...", "recommended_focus_areas": [...] }`
    );
    const result = parseAI(raw);
    res.json({ success: true, result, model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

// AI 6: validate-hash-set-version
router.post('/ai/validate-hash-set-version', aiRateLimiter, async (req, res) => {
  try {
    const { hash_set_version, match_source } = req.body;
    const raw = await callAI(
      'You are a hash database integrity validator. Respond with valid JSON only.',
      `Validate whether this hash set version appears current and reliable for CSAM detection purposes.
Version: ${hash_set_version || 'unknown'} | Source: ${match_source || 'unknown'}
Respond: { "validation_status": "current|outdated|unknown", "version_assessment": "...", "recommended_update_action": "...", "known_version_issues": [...] }`
    );
    const result = parseAI(raw);
    res.json({ success: true, result, model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

// AI 7: suggest-additional-hash-source
router.post('/ai/suggest-additional-hash-source', aiRateLimiter, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT DISTINCT match_source FROM ${TABLE} WHERE match_source IS NOT NULL`);
    const currentSources = rows.map(r => r.match_source);
    const raw = await callAI(
      'You are a trust & safety infrastructure advisor. Respond with valid JSON only.',
      `Based on current hash sources, suggest additional reputable hash sources to improve coverage.
Current sources: ${JSON.stringify(currentSources)}
Respond: { "suggested_sources": [{ "name": "...", "type": "...", "coverage_benefit": "...", "integration_complexity": "low|medium|high" }], "priority_recommendation": "...", "coverage_gap_analysis": "..." }`
    );
    const result = parseAI(raw);
    res.json({ success: true, result, model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

// AI 8: detect-hash-collision-risk
router.post('/ai/detect-hash-collision-risk', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Record not found' });
    const rec = rows[0];
    const raw = await callAI(
      'You are a cryptographic hash collision risk analyst. Respond with valid JSON only.',
      `Assess hash collision risk for this match based on algorithm metadata only.
Algorithm: ${rec.hash_algorithm} | Source: ${rec.match_source} | Set version: ${rec.hash_set_version}
Respond: { "collision_risk": "low|medium|high|critical", "algorithm_vulnerability": "...", "recommended_algorithm": "...", "mitigation_steps": [...] }`
    );
    const result = parseAI(raw);
    res.json({ success: true, result, model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

// AI 9: classify-content-tier-1-2-3
router.post('/ai/classify-content-tier-1-2-3', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Record not found' });
    const rec = rows[0];
    const raw = await callAI(
      'You are a content tier classifier for a trust & safety platform. Classification is based on severity metadata ONLY. Respond with valid JSON only.',
      `Classify the tier level based on severity metadata for this hash match.
Severity label: ${rec.severity_label} | Match source: ${rec.match_source} | Confidence: ${rec.confidence_score}
Respond: { "tier": "1|2|3", "tier_definition": "...", "mandatory_actions": [...], "escalation_required": true|false, "rationale": "..." }`
    );
    const result = parseAI(raw);
    res.json({ success: true, result, model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

// AI 10: predict-recidivism-actor
router.post('/ai/predict-recidivism-actor', aiRateLimiter, async (req, res) => {
  try {
    const { actor_id } = req.body;
    if (!actor_id) return res.status(400).json({ error: 'actor_id required' });
    const { rows } = await pool.query(`SELECT id, severity_label, match_source, matched_at, account_action FROM ${TABLE} WHERE actor_id = $1 ORDER BY matched_at DESC`, [actor_id]);
    const raw = await callAI(
      'You are a behavioral risk analyst for trust & safety. Respond with valid JSON only.',
      `Based on this actor's match history metadata (${rows.length} records), predict recidivism risk.
History summary: ${JSON.stringify(rows.slice(0, 10))}
Respond: { "recidivism_risk": "low|medium|high|critical", "pattern_indicators": [...], "recommended_account_action": "...", "monitoring_recommendation": "..." }`
    );
    const result = parseAI(raw);
    res.json({ success: true, result, model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

// AI 11: recommend-cross-platform-share
router.post('/ai/recommend-cross-platform-share', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Record not found' });
    const rec = rows[0];
    const raw = await callAI(
      'You are a cross-platform trust & safety coordinator. Respond with valid JSON only.',
      `Should this hash match be shared cross-platform via GIFCT or similar?
Severity: ${rec.severity_label} | Source: ${rec.match_source} | Already shared: ${rec.cross_platform_shared} | Algorithm: ${rec.hash_algorithm}
Respond: { "recommend_share": true|false, "share_tier": "immediate|standard|hold", "eligible_platforms": [...], "legal_considerations": "...", "share_restrictions": "..." }`
    );
    const result = parseAI(raw);
    res.json({ success: true, result, model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

// AI 12: generate-law-enforcement-package
router.post('/ai/generate-law-enforcement-package', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Record not found' });
    const rec = rows[0];
    const raw = await callAI(
      'You are a legal compliance officer preparing law enforcement referral packages. Respond with valid JSON only. Include only metadata references, no content descriptions.',
      `Generate a law enforcement referral package template for this hash match.
Record ID: ${rec.id} | Platform: ${rec.platform_origin} | Matched at: ${rec.matched_at} | NCMEC reported: ${rec.reported_to_ncmec} | LE notified: ${rec.law_enforcement_notified}
Respond: { "package_sections": [...], "preservation_evidence": [...], "legal_authorities": [...], "timeline": "...", "contact_guidance": "..." }`
    );
    const result = parseAI(raw);
    res.json({ success: true, result, model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

// AI 13: score-evidence-preservation
router.post('/ai/score-evidence-preservation', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Record not found' });
    const rec = rows[0];
    const raw = await callAI(
      'You are a digital evidence preservation quality assessor. Respond with valid JSON only.',
      `Score the evidence preservation quality for this hash match record.
Preservation status: ${rec.preservation_status} | LE notified: ${rec.law_enforcement_notified} | NCMEC reported: ${rec.reported_to_ncmec} | Hash algorithm: ${rec.hash_algorithm}
Respond: { "preservation_score": 0-100, "chain_of_custody_completeness": "...", "gaps": [...], "recommended_actions": [...] }`
    );
    const result = parseAI(raw);
    res.json({ success: true, result, model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

// AI 14: suggest-account-action-tier
router.post('/ai/suggest-account-action-tier', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Record not found' });
    const rec = rows[0];
    const raw = await callAI(
      'You are a trust & safety account actions specialist. Respond with valid JSON only.',
      `Suggest the appropriate account action tier for this hash match.
Severity: ${rec.severity_label} | Tier: derived from severity | Current action: ${rec.account_action || 'none'} | Recidivism: unknown
Respond: { "recommended_action": "warn|restrict|suspend|terminate|report_only", "action_tier": "1|2|3", "justification": "...", "reversibility": "...", "review_period": "..." }`
    );
    const result = parseAI(raw);
    res.json({ success: true, result, model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

// AI 15: summarize-actor-history
router.post('/ai/summarize-actor-history', aiRateLimiter, async (req, res) => {
  try {
    const { actor_id } = req.body;
    if (!actor_id) return res.status(400).json({ error: 'actor_id required' });
    const { rows } = await pool.query(`SELECT id, severity_label, match_source, platform_origin, matched_at, account_action, reported_to_ncmec FROM ${TABLE} WHERE actor_id = $1 ORDER BY matched_at DESC`, [actor_id]);
    const raw = await callAI(
      'You are a trust & safety analyst summarizing actor histories. Respond with valid JSON only.',
      `Summarize the match history for actor ${actor_id} (${rows.length} records).
Records: ${JSON.stringify(rows.slice(0, 15))}
Respond: { "total_matches": ${rows.length}, "severity_trend": "...", "account_action_taken": "...", "reporting_completeness": "...", "risk_trajectory": "escalating|stable|declining", "summary": "..." }`
    );
    const result = parseAI(raw);
    res.json({ success: true, result, model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

// AI 16: score-hash-coverage
router.post('/ai/score-hash-coverage', aiRateLimiter, async (req, res) => {
  try {
    const [sourcesRes, algoRes, totalRes] = await Promise.all([
      pool.query(`SELECT match_source, COUNT(*) FROM ${TABLE} GROUP BY match_source`),
      pool.query(`SELECT hash_algorithm, COUNT(*) FROM ${TABLE} GROUP BY hash_algorithm`),
      pool.query(`SELECT COUNT(*) FROM ${TABLE}`),
    ]);
    const raw = await callAI(
      'You are a hash coverage quality analyst. Respond with valid JSON only.',
      `Score the overall hash detection coverage of this platform.
Total records: ${totalRes.rows[0].count} | By source: ${JSON.stringify(sourcesRes.rows)} | By algorithm: ${JSON.stringify(algoRes.rows)}
Respond: { "coverage_score": 0-100, "source_diversity": "...", "algorithm_diversity": "...", "coverage_gaps": [...], "improvement_recommendations": [...] }`
    );
    const result = parseAI(raw);
    res.json({ success: true, result, model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

module.exports = router;
