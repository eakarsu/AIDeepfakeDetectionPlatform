/**
 * Trust & Safety — GIFCT Signal Sharing
 * Table: ts_gifct_signals
 * Mount: /api/ts/signal-sharing-gifct
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

const TABLE = 'ts_gifct_signals';
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
    if (req.query.signal_type) { params.push(req.query.signal_type); where.push(`signal_type = $${params.length}`); }
    if (req.query.signal_tier) { params.push(req.query.signal_tier); where.push(`signal_tier = $${params.length}`); }
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
    if (req.query.shareable === 'true') { params.push(true); where.push(`shareable = $${params.length}`); }
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
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE signal_type ILIKE $1 OR signal_tier ILIKE $1 OR attribution_source ILIKE $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, [`%${q}%`, limit, offset]);
    const cr = await pool.query(`SELECT COUNT(*) FROM ${TABLE} WHERE signal_type ILIKE $1 OR signal_tier ILIKE $1 OR attribution_source ILIKE $1`, [`%${q}%`]);
    res.json({ data: rows, pagination: { page, limit, total: parseInt(cr.rows[0].count) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/by-type/:type', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE signal_type = $1 ORDER BY created_at DESC`, [req.params.type]);
    res.json({ data: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/by-tier/:tier', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE signal_tier = $1 ORDER BY quality_score DESC`, [req.params.tier]);
    res.json({ data: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/export/csv', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} ORDER BY created_at DESC`);
    const fields = ['id', 'signal_type', 'signal_tier', 'quality_score', 'shareable', 'attribution_source', 'shared_at', 'revoked', 'poisoned_flag', 'mutual_defense_score', 'status', 'created_at'];
    const header = fields.join(',');
    const csvRows = rows.map(r => fields.map(f => `"${String(r[f] ?? '').replace(/"/g, '""')}"`).join(','));
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="gifct_signals.csv"');
    res.send([header, ...csvRows].join('\n'));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/stats/summary', async (req, res) => {
  try {
    const [byType, byTier, shared, poisoned, total] = await Promise.all([
      pool.query(`SELECT signal_type, COUNT(*) FROM ${TABLE} GROUP BY signal_type`),
      pool.query(`SELECT signal_tier, COUNT(*) FROM ${TABLE} GROUP BY signal_tier`),
      pool.query(`SELECT COUNT(*) FROM ${TABLE} WHERE shared_at IS NOT NULL`),
      pool.query(`SELECT COUNT(*) FROM ${TABLE} WHERE poisoned_flag = true`),
      pool.query(`SELECT COUNT(*) FROM ${TABLE}`),
    ]);
    res.json({ byType: byType.rows, byTier: byTier.rows, sharedCount: parseInt(shared.rows[0].count), poisonedCount: parseInt(poisoned.rows[0].count), total: parseInt(total.rows[0].count) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/batch', async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'items array required' });
    const created = [];
    for (const item of items) {
      const { rows } = await pool.query(`INSERT INTO ${TABLE} (signal_hash, signal_type, signal_tier, quality_score, shareable, share_restrictions, attribution_source, partner_platforms, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [item.signal_hash, item.signal_type, item.signal_tier, item.quality_score, item.shareable || false, item.share_restrictions, item.attribution_source, item.partner_platforms ? JSON.stringify(item.partner_platforms) : null, req.user?.id || null]);
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
      const { rows } = await pool.query(`INSERT INTO ${TABLE} (signal_type, signal_tier, attribution_source, created_by) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING *`,
        [obj.signal_type, obj.signal_tier, obj.attribution_source, req.user?.id || null]);
      if (rows[0]) created.push(rows[0]);
    }
    res.status(201).json({ data: created, count: created.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Signal not found' });
    res.json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { signal_hash, signal_type, signal_tier, quality_score, shareable, share_restrictions, attribution_source, partner_platforms } = req.body;
    const { rows } = await pool.query(`INSERT INTO ${TABLE} (signal_hash, signal_type, signal_tier, quality_score, shareable, share_restrictions, attribution_source, partner_platforms, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [signal_hash, signal_type, signal_tier, quality_score, shareable || false, share_restrictions, attribution_source, partner_platforms ? JSON.stringify(partner_platforms) : null, req.user?.id || null]);
    res.status(201).json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const allowed = ['signal_type', 'signal_tier', 'quality_score', 'shareable', 'share_restrictions', 'attribution_source', 'partner_platforms', 'shared_at', 'revoked', 'revocation_reason', 'poisoned_flag', 'actor_network', 'mutual_defense_score', 'status'];
    const fields = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    if (!Object.keys(fields).length) return res.status(400).json({ error: 'No updatable fields' });
    const sets = Object.keys(fields).map((k, i) => `${k} = $${i + 2}`).join(', ');
    const { rows } = await pool.query(`UPDATE ${TABLE} SET ${sets}, updated_at = NOW() WHERE id = $1 RETURNING *`, [req.params.id, ...Object.values(fields)]);
    if (!rows[0]) return res.status(404).json({ error: 'Signal not found' });
    res.json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`UPDATE ${TABLE} SET status = 'deleted', updated_at = NOW() WHERE id = $1 RETURNING *`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Signal not found' });
    res.json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/archive', async (req, res) => {
  try {
    const { rows } = await pool.query(`UPDATE ${TABLE} SET is_archived = true, updated_at = NOW() WHERE id = $1 RETURNING *`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Signal not found' });
    res.json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/restore', async (req, res) => {
  try {
    const { rows } = await pool.query(`UPDATE ${TABLE} SET is_archived = false, status = 'pending', updated_at = NOW() WHERE id = $1 RETURNING *`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Signal not found' });
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

router.post('/ai/classify-signal-shareable', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Signal not found' });
    const sig = rows[0];
    const raw = await callAI('You are a GIFCT signal shareability classifier. Respond with valid JSON only.',
      `Classify whether this signal is shareable across GIFCT partner platforms.
Signal type: ${sig.signal_type} | Tier: ${sig.signal_tier} | Quality: ${sig.quality_score} | Poisoned: ${sig.poisoned_flag} | Source: ${sig.attribution_source}
Respond: { "shareable": true|false, "shareability_tier": "immediate|standard|restricted|not_shareable", "blocking_factors": [...], "prerequisites": [...] }`);
    const result = parseAI(raw);
    await pool.query(`UPDATE ${TABLE} SET ai_result = $1, updated_at = NOW() WHERE id = $2`, [JSON.stringify(result), id]);
    res.json({ success: true, result, model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/score-signal-quality', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Signal not found' });
    const sig = rows[0];
    const raw = await callAI('You are a signal quality assessor. Respond with valid JSON only.',
      `Score the quality of this GIFCT signal.
Type: ${sig.signal_type} | Tier: ${sig.signal_tier} | Has hash: ${!!sig.signal_hash} | Attribution: ${sig.attribution_source} | Poisoned: ${sig.poisoned_flag}
Respond: { "quality_score": 0-100, "quality_dimensions": {...}, "reliability_assessment": "...", "improvement_suggestions": [...] }`);
    const result = parseAI(raw);
    await pool.query(`UPDATE ${TABLE} SET quality_score = $1, updated_at = NOW() WHERE id = $2`, [result.quality_score || null, id]);
    res.json({ success: true, result, model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/predict-cross-platform-utility', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Signal not found' });
    const sig = rows[0];
    const raw = await callAI('You are a cross-platform signal utility predictor. Respond with valid JSON only.',
      `Predict the utility of this signal if shared across platforms.
Type: ${sig.signal_type} | Quality: ${sig.quality_score} | Tier: ${sig.signal_tier} | Partner platforms: ${JSON.stringify(sig.partner_platforms)}
Respond: { "utility_score": 0-100, "high_utility_platforms": [...], "low_utility_platforms": [...], "expected_coverage_improvement": "...", "sharing_recommendation": "..." }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/recommend-signal-tier', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Signal not found' });
    const sig = rows[0];
    const raw = await callAI('You are a signal tiering advisor. Respond with valid JSON only.',
      `Recommend the appropriate tier for this signal.
Type: ${sig.signal_type} | Quality: ${sig.quality_score} | Current tier: ${sig.signal_tier} | Source: ${sig.attribution_source}
Respond: { "recommended_tier": "tier1|tier2|tier3|restricted", "tier_rationale": "...", "tier_criteria_met": [...], "tier_change_required": true|false }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/generate-signal-package', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Signal not found' });
    const sig = rows[0];
    const raw = await callAI('You are a GIFCT signal package generator. Respond with valid JSON only.',
      `Generate a shareable signal package for GIFCT partners.
Type: ${sig.signal_type} | Tier: ${sig.signal_tier} | Quality: ${sig.quality_score} | Restrictions: ${sig.share_restrictions || 'none'}
Respond: { "package_format": "GIFCT_v2", "signal_metadata": {...}, "sharing_instructions": [...], "recipient_requirements": [...], "expiry_recommendation": "..." }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/summarize-shared-signals', aiRateLimiter, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT signal_type, signal_tier, COUNT(*) AS count, AVG(quality_score) AS avg_quality FROM ${TABLE} WHERE shared_at IS NOT NULL GROUP BY signal_type, signal_tier ORDER BY count DESC`);
    const raw = await callAI('You are a GIFCT sharing summary analyst. Respond with valid JSON only.',
      `Summarize signals that have been shared across the GIFCT network.
Data: ${JSON.stringify(rows)}
Respond: { "total_shared": "...", "type_distribution": {...}, "avg_quality": "...", "high_impact_types": [...], "sharing_effectiveness": "..." }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/validate-signal-attribution', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Signal not found' });
    const sig = rows[0];
    const raw = await callAI('You are a signal attribution validator. Respond with valid JSON only.',
      `Validate the attribution of this signal.
Attribution source: ${sig.attribution_source} | Signal type: ${sig.signal_type} | Tier: ${sig.signal_tier}
Respond: { "attribution_valid": true|false, "reliability_assessment": "...", "verification_gaps": [...], "recommended_additional_validation": [...] }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/suggest-share-restrictions', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Signal not found' });
    const sig = rows[0];
    const raw = await callAI('You are a signal sharing restrictions advisor. Respond with valid JSON only.',
      `Suggest appropriate sharing restrictions for this signal.
Type: ${sig.signal_type} | Tier: ${sig.signal_tier} | Quality: ${sig.quality_score} | Attribution: ${sig.attribution_source} | Current restrictions: ${sig.share_restrictions || 'none'}
Respond: { "recommended_restrictions": [...], "permitted_recipients": [...], "prohibited_uses": [...], "expiry_recommendation": "...", "revocation_triggers": [...] }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/detect-poisoned-signal', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Signal not found' });
    const sig = rows[0];
    const raw = await callAI('You are a signal integrity analyst specializing in poisoned signal detection. Respond with valid JSON only.',
      `Detect signs that this signal may be poisoned or compromised.
Type: ${sig.signal_type} | Attribution: ${sig.attribution_source} | Quality: ${sig.quality_score} | Tier: ${sig.signal_tier} | Current poison flag: ${sig.poisoned_flag}
Respond: { "poisoning_detected": true|false, "poisoning_indicators": [...], "confidence": "high|medium|low", "recommended_action": "quarantine|revoke|monitor|clear", "investigation_steps": [...] }`);
    const result = parseAI(raw);
    if (result.poisoning_detected) {
      await pool.query(`UPDATE ${TABLE} SET poisoned_flag = true, updated_at = NOW() WHERE id = $1`, [id]);
    }
    res.json({ success: true, result, model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/classify-actor-network', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Signal not found' });
    const sig = rows[0];
    const raw = await callAI('You are an actor network classifier for trust & safety. Respond with valid JSON only.',
      `Classify the actor network associated with this signal.
Actor network metadata: ${JSON.stringify(sig.actor_network)} | Signal type: ${sig.signal_type}
Respond: { "network_type": "individual|coordinated|state_sponsored|criminal|unknown", "network_sophistication": "low|medium|high|advanced", "cross_platform_presence": "...", "coordination_indicators": [...] }`);
    const result = parseAI(raw);
    await pool.query(`UPDATE ${TABLE} SET actor_network = $1, updated_at = NOW() WHERE id = $2`, [JSON.stringify(result), id]);
    res.json({ success: true, result, model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/predict-platform-coverage', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Signal not found' });
    const sig = rows[0];
    const raw = await callAI('You are a platform coverage analyst. Respond with valid JSON only.',
      `Predict the platform coverage improvement from sharing this signal.
Signal type: ${sig.signal_type} | Quality: ${sig.quality_score} | Partner platforms: ${JSON.stringify(sig.partner_platforms)} | Tier: ${sig.signal_tier}
Respond: { "coverage_improvement_estimate": "...", "platforms_benefiting": [...], "detection_uplift": "...", "coverage_gaps_remaining": [...] }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/recommend-additional-signal-type', aiRateLimiter, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT signal_type, COUNT(*) AS count, AVG(quality_score) AS avg_quality FROM ${TABLE} GROUP BY signal_type ORDER BY count DESC`);
    const raw = await callAI('You are a GIFCT signal portfolio advisor. Respond with valid JSON only.',
      `Recommend additional signal types to expand the GIFCT signal portfolio.
Current signal types: ${JSON.stringify(rows)}
Respond: { "recommended_new_types": [...], "coverage_gaps": [...], "high_value_additions": [...], "collection_feasibility": {...} }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/generate-partner-report', aiRateLimiter, async (req, res) => {
  try {
    const [shared, byPartner, quality] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM ${TABLE} WHERE shared_at IS NOT NULL`),
      pool.query(`SELECT partner_platforms, COUNT(*) FROM ${TABLE} WHERE shared_at IS NOT NULL GROUP BY partner_platforms LIMIT 10`),
      pool.query(`SELECT AVG(quality_score) FROM ${TABLE} WHERE shared_at IS NOT NULL`),
    ]);
    const raw = await callAI('You are a GIFCT partner report generator. Respond with valid JSON only.',
      `Generate a partner report for GIFCT signal sharing activity.
Total shared: ${shared.rows[0].count} | Avg quality: ${quality.rows[0].avg} | By partner: ${JSON.stringify(byPartner.rows.slice(0, 5))}
Respond: { "report_period": "...", "total_signals_shared": ${shared.rows[0].count}, "avg_signal_quality": "...", "top_contributing_platforms": [...], "impact_assessment": "...", "recommended_partnership_actions": [...] }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/score-mutual-defense-value', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Signal not found' });
    const sig = rows[0];
    const raw = await callAI('You are a mutual defense value assessor for cross-platform signal sharing. Respond with valid JSON only.',
      `Score the mutual defense value of sharing this signal with GIFCT partners.
Type: ${sig.signal_type} | Quality: ${sig.quality_score} | Tier: ${sig.signal_tier} | Partner platforms: ${JSON.stringify(sig.partner_platforms)}
Respond: { "mutual_defense_score": 0-100, "value_to_network": "...", "reciprocity_expectation": "...", "strategic_benefit": "...", "share_recommendation": "..." }`);
    const result = parseAI(raw);
    await pool.query(`UPDATE ${TABLE} SET mutual_defense_score = $1, updated_at = NOW() WHERE id = $2`, [result.mutual_defense_score || null, id]);
    res.json({ success: true, result, model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/suggest-signal-revocation', aiRateLimiter, async (req, res) => {
  try {
    const { id, reason } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Signal not found' });
    const sig = rows[0];
    const raw = await callAI('You are a signal revocation advisor. Respond with valid JSON only.',
      `Assess whether this signal should be revoked and advise on revocation.
Type: ${sig.signal_type} | Poisoned: ${sig.poisoned_flag} | Shared: ${sig.shared_at ? 'yes' : 'no'} | Quality: ${sig.quality_score} | Reason provided: ${reason || 'not provided'}
Respond: { "revocation_recommended": true|false, "urgency": "immediate|standard|optional", "revocation_rationale": "...", "partner_notification_required": [...], "steps": [...] }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/summarize-network-health', aiRateLimiter, async (req, res) => {
  try {
    const [total, shared, revoked, poisoned, avgQuality] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM ${TABLE}`),
      pool.query(`SELECT COUNT(*) FROM ${TABLE} WHERE shared_at IS NOT NULL`),
      pool.query(`SELECT COUNT(*) FROM ${TABLE} WHERE revoked = true`),
      pool.query(`SELECT COUNT(*) FROM ${TABLE} WHERE poisoned_flag = true`),
      pool.query(`SELECT AVG(quality_score) FROM ${TABLE} WHERE quality_score IS NOT NULL`),
    ]);
    const raw = await callAI('You are a GIFCT network health analyst. Respond with valid JSON only.',
      `Summarize the overall health of the signal sharing network.
Total signals: ${total.rows[0].count} | Shared: ${shared.rows[0].count} | Revoked: ${revoked.rows[0].count} | Poisoned: ${poisoned.rows[0].count} | Avg quality: ${avgQuality.rows[0].avg}
Respond: { "network_health_score": 0-100, "health_status": "healthy|degraded|at_risk|critical", "strengths": [...], "concerns": [...], "recommended_actions": [...], "summary": "..." }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

module.exports = router;
