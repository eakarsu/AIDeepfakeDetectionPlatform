/**
 * Trust & Safety — Region Rules
 * Table: ts_region_rules
 * Mount: /api/ts/region-rules
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

const TABLE = 'ts_region_rules';
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
    if (req.query.jurisdiction) { params.push(req.query.jurisdiction); where.push(`jurisdiction = $${params.length}`); }
    if (req.query.regulation_framework) { params.push(req.query.regulation_framework); where.push(`regulation_framework = $${params.length}`); }
    if (req.query.status) { params.push(req.query.status); where.push(`status = $${params.length}`); }
    const wc = where.length ? `WHERE ${where.join(' AND ')}` : '';
    params.push(limit); params.push(offset);
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} ${wc} ORDER BY jurisdiction, created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    const cr = await pool.query(`SELECT COUNT(*) FROM ${TABLE} ${wc}`, params.slice(0, params.length - 2));
    res.json({ data: rows, pagination: { page, limit, total: parseInt(cr.rows[0].count), totalPages: Math.ceil(parseInt(cr.rows[0].count) / limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/count', async (req, res) => {
  try {
    const where = []; const params = [];
    if (req.query.jurisdiction) { params.push(req.query.jurisdiction); where.push(`jurisdiction = $${params.length}`); }
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
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE rule_name ILIKE $1 OR jurisdiction ILIKE $1 OR regulation_framework ILIKE $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, [`%${q}%`, limit, offset]);
    const cr = await pool.query(`SELECT COUNT(*) FROM ${TABLE} WHERE rule_name ILIKE $1 OR jurisdiction ILIKE $1 OR regulation_framework ILIKE $1`, [`%${q}%`]);
    res.json({ data: rows, pagination: { page, limit, total: parseInt(cr.rows[0].count) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/by-jurisdiction/:jurisdiction', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE jurisdiction = $1 ORDER BY effective_from DESC`, [req.params.jurisdiction]);
    res.json({ data: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/by-framework/:framework', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE regulation_framework = $1 ORDER BY created_at DESC`, [req.params.framework]);
    res.json({ data: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/export/csv', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} ORDER BY jurisdiction, created_at DESC`);
    const fields = ['id', 'rule_name', 'jurisdiction', 'regulation_framework', 'rule_version', 'geo_block_required', 'overrides_global', 'cross_border_flag', 'compliance_score', 'effective_from', 'effective_until', 'status', 'created_at'];
    const header = fields.join(',');
    const csvRows = rows.map(r => fields.map(f => `"${String(r[f] ?? '').replace(/"/g, '""')}"`).join(','));
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="region_rules.csv"');
    res.send([header, ...csvRows].join('\n'));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/stats/summary', async (req, res) => {
  try {
    const [byJurisdiction, byFramework, geoBlocks, total] = await Promise.all([
      pool.query(`SELECT jurisdiction, COUNT(*) FROM ${TABLE} GROUP BY jurisdiction ORDER BY COUNT(*) DESC`),
      pool.query(`SELECT regulation_framework, COUNT(*) FROM ${TABLE} GROUP BY regulation_framework ORDER BY COUNT(*) DESC`),
      pool.query(`SELECT COUNT(*) FROM ${TABLE} WHERE geo_block_required = true`),
      pool.query(`SELECT COUNT(*) FROM ${TABLE}`),
    ]);
    res.json({ byJurisdiction: byJurisdiction.rows, byFramework: byFramework.rows, geoBlockCount: parseInt(geoBlocks.rows[0].count), total: parseInt(total.rows[0].count) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/batch', async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'items array required' });
    const created = [];
    for (const item of items) {
      if (!item.rule_name || !item.jurisdiction) continue;
      const { rows } = await pool.query(`INSERT INTO ${TABLE} (rule_name, jurisdiction, regulation_framework, rule_version, rule_text, effective_from, effective_until, geo_block_required, overrides_global, cross_border_flag, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [item.rule_name, item.jurisdiction, item.regulation_framework, item.rule_version, item.rule_text, item.effective_from, item.effective_until, item.geo_block_required || false, item.overrides_global || false, item.cross_border_flag || false, req.user?.id || null]);
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
      if (!obj.rule_name || !obj.jurisdiction) continue;
      const { rows } = await pool.query(`INSERT INTO ${TABLE} (rule_name, jurisdiction, regulation_framework, created_by) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING *`,
        [obj.rule_name, obj.jurisdiction, obj.regulation_framework, req.user?.id || null]);
      if (rows[0]) created.push(rows[0]);
    }
    res.status(201).json({ data: created, count: created.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Region rule not found' });
    res.json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { rule_name, jurisdiction, regulation_framework, rule_version, rule_text, effective_from, effective_until, geo_block_required, overrides_global, cross_border_flag, regulator_contact } = req.body;
    if (!rule_name || !jurisdiction) return res.status(400).json({ error: 'rule_name and jurisdiction required' });
    const { rows } = await pool.query(`INSERT INTO ${TABLE} (rule_name, jurisdiction, regulation_framework, rule_version, rule_text, effective_from, effective_until, geo_block_required, overrides_global, cross_border_flag, regulator_contact, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [rule_name, jurisdiction, regulation_framework, rule_version, rule_text, effective_from, effective_until, geo_block_required || false, overrides_global || false, cross_border_flag || false, regulator_contact ? JSON.stringify(regulator_contact) : null, req.user?.id || null]);
    res.status(201).json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const allowed = ['rule_name', 'jurisdiction', 'regulation_framework', 'rule_version', 'rule_text', 'effective_from', 'effective_until', 'geo_block_required', 'overrides_global', 'cross_border_flag', 'compliance_score', 'regulator_contact', 'status'];
    const fields = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    if (!Object.keys(fields).length) return res.status(400).json({ error: 'No updatable fields' });
    const sets = Object.keys(fields).map((k, i) => `${k} = $${i + 2}`).join(', ');
    const { rows } = await pool.query(`UPDATE ${TABLE} SET ${sets}, updated_at = NOW() WHERE id = $1 RETURNING *`, [req.params.id, ...Object.values(fields)]);
    if (!rows[0]) return res.status(404).json({ error: 'Region rule not found' });
    res.json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`UPDATE ${TABLE} SET status = 'deleted', updated_at = NOW() WHERE id = $1 RETURNING *`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Region rule not found' });
    res.json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/archive', async (req, res) => {
  try {
    const { rows } = await pool.query(`UPDATE ${TABLE} SET is_archived = true, updated_at = NOW() WHERE id = $1 RETURNING *`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Region rule not found' });
    res.json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/restore', async (req, res) => {
  try {
    const { rows } = await pool.query(`UPDATE ${TABLE} SET is_archived = false, status = 'active', updated_at = NOW() WHERE id = $1 RETURNING *`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Region rule not found' });
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

router.post('/ai/classify-region-applicability', aiRateLimiter, async (req, res) => {
  try {
    const { id, content_jurisdiction } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Region rule not found' });
    const rule = rows[0];
    const raw = await callAI('You are a jurisdictional applicability classifier. Respond with valid JSON only.',
      `Classify the applicability of this region rule to the given content jurisdiction.
Rule jurisdiction: ${rule.jurisdiction} | Framework: ${rule.regulation_framework} | Content jurisdiction: ${content_jurisdiction || 'unknown'} | Override global: ${rule.overrides_global}
Respond: { "applicable": true|false, "applicability_scope": "...", "jurisdictional_basis": "...", "exceptions": [...] }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/detect-rule-conflict', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const [ruleRes, otherRes] = await Promise.all([
      pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]),
      pool.query(`SELECT id, rule_name, jurisdiction, regulation_framework, overrides_global FROM ${TABLE} WHERE id != $1 LIMIT 20`, [id]),
    ]);
    if (!ruleRes.rows[0]) return res.status(404).json({ error: 'Region rule not found' });
    const raw = await callAI('You are a regulatory conflict detection specialist. Respond with valid JSON only.',
      `Detect conflicts between this rule and others.
Rule: ${JSON.stringify(ruleRes.rows[0])} | Other rules: ${JSON.stringify(otherRes.rows)}
Respond: { "conflicts_detected": true|false, "conflicting_rules": [...], "conflict_type": "...", "resolution_options": [...] }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/suggest-region-specific-policy', aiRateLimiter, async (req, res) => {
  try {
    const { jurisdiction, regulation_framework } = req.body;
    const raw = await callAI('You are a regional content policy advisor. Respond with valid JSON only.',
      `Suggest a content policy tailored to this jurisdiction and regulatory framework.
Jurisdiction: ${jurisdiction || 'unknown'} | Framework: ${regulation_framework || 'unknown'}
Respond: { "policy_suggestions": [...], "mandatory_elements": [...], "optional_elements": [...], "compliance_requirements": [...], "implementation_notes": "..." }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/predict-regulator-finding', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Region rule not found' });
    const rule = rows[0];
    const raw = await callAI('You are a regulatory risk predictor. Respond with valid JSON only.',
      `Predict how a regulator might assess compliance with this rule.
Rule: ${rule.rule_name} | Framework: ${rule.regulation_framework} | Jurisdiction: ${rule.jurisdiction} | Compliance score: ${rule.compliance_score}
Respond: { "predicted_finding": "compliant|minor_breach|major_breach|unclear", "risk_rating": "low|medium|high", "regulator_focus_areas": [...], "mitigation_actions": [...] }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/recommend-rule-update', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Region rule not found' });
    const rule = rows[0];
    const raw = await callAI('You are a regulatory compliance advisor. Respond with valid JSON only.',
      `Recommend updates to this regional rule to improve compliance and effectiveness.
Rule: ${rule.rule_name} | Framework: ${rule.regulation_framework} | Version: ${rule.rule_version} | Effective until: ${rule.effective_until}
Respond: { "updates_recommended": [...], "obsolete_provisions": [...], "new_requirements_to_add": [...], "urgency": "immediate|soon|scheduled", "legal_review_needed": true|false }`);
    const result = parseAI(raw);
    await pool.query(`UPDATE ${TABLE} SET ai_result = $1, updated_at = NOW() WHERE id = $2`, [JSON.stringify(result), id]);
    res.json({ success: true, result, model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/generate-jurisdiction-summary', aiRateLimiter, async (req, res) => {
  try {
    const { jurisdiction } = req.body;
    if (!jurisdiction) return res.status(400).json({ error: 'jurisdiction required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE jurisdiction = $1`, [jurisdiction]);
    const raw = await callAI('You are a jurisdiction compliance summarizer. Respond with valid JSON only.',
      `Generate a compliance summary for ${jurisdiction}.
Rules (${rows.length}): ${JSON.stringify(rows.map(r => ({ name: r.rule_name, framework: r.regulation_framework, geo_block: r.geo_block_required, compliance: r.compliance_score })))}
Respond: { "jurisdiction": "${jurisdiction}", "total_rules": ${rows.length}, "compliance_overview": "...", "key_requirements": [...], "high_risk_areas": [...], "action_items": [...] }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/summarize-rule-changes', aiRateLimiter, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE updated_at > NOW() - INTERVAL '90 days' ORDER BY updated_at DESC LIMIT 50`);
    const raw = await callAI('You are a regulatory change tracker. Respond with valid JSON only.',
      `Summarize recent rule changes over the past 90 days.
Changed rules (${rows.length}): ${JSON.stringify(rows.map(r => ({ name: r.rule_name, jurisdiction: r.jurisdiction, framework: r.regulation_framework, updated: r.updated_at })))}
Respond: { "total_changes": ${rows.length}, "jurisdictions_affected": [...], "change_categories": [...], "high_impact_changes": [...], "summary": "..." }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/score-rule-coverage', aiRateLimiter, async (req, res) => {
  try {
    const [byJurisdiction, byFramework, geoBlocks] = await Promise.all([
      pool.query(`SELECT jurisdiction, COUNT(*) FROM ${TABLE} GROUP BY jurisdiction`),
      pool.query(`SELECT regulation_framework, COUNT(*) FROM ${TABLE} GROUP BY regulation_framework`),
      pool.query(`SELECT COUNT(*) FROM ${TABLE} WHERE geo_block_required = true`),
    ]);
    const raw = await callAI('You are a regulatory coverage assessor. Respond with valid JSON only.',
      `Score the coverage of regulatory rules.
Jurisdictions covered: ${JSON.stringify(byJurisdiction.rows)} | Frameworks: ${JSON.stringify(byFramework.rows)} | Geo-blocks: ${geoBlocks.rows[0].count}
Respond: { "coverage_score": 0-100, "well_covered_regions": [...], "coverage_gaps": [...], "recommended_additions": [...], "coverage_breadth": "..." }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/validate-rule-vs-legal-text', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Region rule not found' });
    const rule = rows[0];
    const raw = await callAI('You are a legal text validation specialist. Respond with valid JSON only.',
      `Validate this rule implementation against the stated regulatory framework.
Rule: ${rule.rule_name} | Framework: ${rule.regulation_framework} | Rule text: ${rule.rule_text || 'not provided'} | Jurisdiction: ${rule.jurisdiction}
Respond: { "validation_status": "aligned|partial|misaligned|needs_review", "compliance_gaps": [...], "well_implemented_provisions": [...], "legal_review_priority": "...", "recommendations": [...] }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/suggest-rule-versioning', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Region rule not found' });
    const rule = rows[0];
    const raw = await callAI('You are a regulatory versioning advisor. Respond with valid JSON only.',
      `Suggest a versioning strategy for this rule.
Current version: ${rule.rule_version || 'unversioned'} | Framework: ${rule.regulation_framework} | Effective from: ${rule.effective_from} | Until: ${rule.effective_until}
Respond: { "new_version": "...", "version_scheme": "...", "change_summary": "...", "sunset_plan": "...", "notification_required": [...] }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/classify-content-by-jurisdiction', aiRateLimiter, async (req, res) => {
  try {
    const { content_type, origin_jurisdiction, destination_jurisdiction } = req.body;
    const { rows } = await pool.query(`SELECT id, rule_name, jurisdiction, geo_block_required, overrides_global FROM ${TABLE} WHERE jurisdiction IN ($1, $2, 'global') ORDER BY overrides_global DESC`, [origin_jurisdiction || 'global', destination_jurisdiction || 'global']);
    const raw = await callAI('You are a cross-jurisdictional content classifier. Respond with valid JSON only.',
      `Classify this content across the applicable jurisdictions.
Content type: ${content_type || 'unknown'} | Origin: ${origin_jurisdiction} | Destination: ${destination_jurisdiction}
Applicable rules: ${JSON.stringify(rows)}
Respond: { "classification": "permitted|restricted|blocked|review_required", "applicable_rules": [...], "most_restrictive_jurisdiction": "...", "actions_required": [...] }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/predict-cross-border-issue', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Region rule not found' });
    const rule = rows[0];
    const raw = await callAI('You are a cross-border regulatory risk analyst. Respond with valid JSON only.',
      `Predict cross-border issues that may arise from this rule.
Jurisdiction: ${rule.jurisdiction} | Framework: ${rule.regulation_framework} | Overrides global: ${rule.overrides_global} | Cross border flag: ${rule.cross_border_flag}
Respond: { "cross_border_risks": [...], "conflicting_jurisdictions": [...], "enforcement_gaps": [...], "recommended_mitigations": [...], "likelihood": "low|medium|high" }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/recommend-geo-block', aiRateLimiter, async (req, res) => {
  try {
    const { content_type, jurisdictions } = req.body;
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE jurisdiction = ANY($1) AND geo_block_required = true`, [jurisdictions || []]);
    const raw = await callAI('You are a geo-blocking policy advisor. Respond with valid JSON only.',
      `Recommend geo-blocking actions for this content type across given jurisdictions.
Content type: ${content_type || 'unknown'} | Jurisdictions: ${JSON.stringify(jurisdictions)} | Rules requiring geo-block: ${JSON.stringify(rows.map(r => ({ jurisdiction: r.jurisdiction, rule: r.rule_name, framework: r.regulation_framework })))}
Respond: { "recommended_geo_blocks": [...], "exemptions": [...], "implementation_guidance": "...", "legal_basis": [...] }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/generate-regulator-response', aiRateLimiter, async (req, res) => {
  try {
    const { id, inquiry_topic } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Region rule not found' });
    const rule = rows[0];
    const raw = await callAI('You are a regulatory affairs officer drafting responses to regulators. Respond with valid JSON only.',
      `Draft a response to a regulator inquiry about this rule.
Rule: ${rule.rule_name} | Framework: ${rule.regulation_framework} | Jurisdiction: ${rule.jurisdiction} | Inquiry topic: ${inquiry_topic || 'general compliance'}
Respond: { "response_subject": "...", "response_body": "...", "supporting_evidence": [...], "commitments_offered": [...], "tone": "formal|cooperative|factual" }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/score-multi-jurisdiction-compliance', aiRateLimiter, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT jurisdiction, AVG(compliance_score) AS avg_score, COUNT(*) AS rules FROM ${TABLE} GROUP BY jurisdiction ORDER BY avg_score ASC`);
    const raw = await callAI('You are a multi-jurisdictional compliance assessor. Respond with valid JSON only.',
      `Score compliance across all jurisdictions.
Data: ${JSON.stringify(rows)}
Respond: { "overall_compliance_score": 0-100, "strongest_jurisdictions": [...], "weakest_jurisdictions": [...], "systemic_gaps": [...], "priority_remediation": [...] }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/detect-overreach', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Region rule not found' });
    const rule = rows[0];
    const raw = await callAI('You are a regulatory proportionality analyst. Respond with valid JSON only.',
      `Assess whether this rule may constitute regulatory overreach.
Rule: ${rule.rule_name} | Jurisdiction: ${rule.jurisdiction} | Framework: ${rule.regulation_framework} | Overrides global: ${rule.overrides_global} | Geo-block required: ${rule.geo_block_required}
Respond: { "overreach_detected": true|false, "overreach_indicators": [...], "proportionality_assessment": "...", "affected_rights": [...], "recommended_scope_adjustment": "..." }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

module.exports = router;
