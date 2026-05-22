/**
 * Trust & Safety — Creator Communications
 * Table: ts_creator_comms
 * Mount: /api/ts/creator-comms
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

const TABLE = 'ts_creator_comms';
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
    if (req.query.comms_type) { params.push(req.query.comms_type); where.push(`comms_type = $${params.length}`); }
    if (req.query.creator_tier) { params.push(req.query.creator_tier); where.push(`creator_tier = $${params.length}`); }
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
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE creator_id ILIKE $1 OR comms_type ILIKE $1 OR channel ILIKE $1 OR tone_label ILIKE $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, [`%${q}%`, limit, offset]);
    const cr = await pool.query(`SELECT COUNT(*) FROM ${TABLE} WHERE creator_id ILIKE $1 OR comms_type ILIKE $1 OR channel ILIKE $1 OR tone_label ILIKE $1`, [`%${q}%`]);
    res.json({ data: rows, pagination: { page, limit, total: parseInt(cr.rows[0].count) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/by-creator/:creatorId', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE creator_id = $1 ORDER BY created_at DESC`, [req.params.creatorId]);
    res.json({ data: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/by-channel/:channel', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE channel = $1 ORDER BY created_at DESC`, [req.params.channel]);
    res.json({ data: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/export/csv', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} ORDER BY created_at DESC`);
    const fields = ['id', 'creator_id', 'creator_tier', 'comms_type', 'channel', 'tone_label', 'policy_basis', 'sent_at', 'acknowledged_at', 'influencer_blast_radius_score', 'pr_risk_score', 'escalation_level', 'clarity_score', 'effectiveness_score', 'status', 'created_at'];
    const header = fields.join(',');
    const csvRows = rows.map(r => fields.map(f => `"${String(r[f] ?? '').replace(/"/g, '""')}"`).join(','));
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="creator_comms.csv"');
    res.send([header, ...csvRows].join('\n'));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/stats/summary', async (req, res) => {
  try {
    const [byType, byChannel, byEscalation, total] = await Promise.all([
      pool.query(`SELECT comms_type, COUNT(*) FROM ${TABLE} GROUP BY comms_type`),
      pool.query(`SELECT channel, COUNT(*) FROM ${TABLE} GROUP BY channel`),
      pool.query(`SELECT escalation_level, COUNT(*) FROM ${TABLE} GROUP BY escalation_level`),
      pool.query(`SELECT COUNT(*) FROM ${TABLE}`),
    ]);
    res.json({ byType: byType.rows, byChannel: byChannel.rows, byEscalation: byEscalation.rows, total: parseInt(total.rows[0].count) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/batch', async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'items array required' });
    const created = [];
    for (const item of items) {
      const { rows } = await pool.query(`INSERT INTO ${TABLE} (creator_id, creator_tier, comms_type, channel, message_body, tone_label, policy_basis, escalation_level, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [item.creator_id, item.creator_tier, item.comms_type, item.channel, item.message_body, item.tone_label, item.policy_basis, item.escalation_level || 'none', req.user?.id || null]);
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
      const { rows } = await pool.query(`INSERT INTO ${TABLE} (creator_id, comms_type, channel, created_by) VALUES ($1,$2,$3,$4) RETURNING *`,
        [obj.creator_id, obj.comms_type, obj.channel, req.user?.id || null]);
      created.push(rows[0]);
    }
    res.status(201).json({ data: created, count: created.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Communication not found' });
    res.json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { creator_id, creator_tier, comms_type, channel, message_body, tone_label, policy_basis, escalation_level } = req.body;
    const { rows } = await pool.query(`INSERT INTO ${TABLE} (creator_id, creator_tier, comms_type, channel, message_body, tone_label, policy_basis, escalation_level, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [creator_id, creator_tier, comms_type, channel, message_body, tone_label, policy_basis, escalation_level || 'none', req.user?.id || null]);
    res.status(201).json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const allowed = ['creator_id', 'creator_tier', 'comms_type', 'channel', 'message_body', 'tone_label', 'policy_basis', 'sent_at', 'acknowledged_at', 'influencer_blast_radius_score', 'pr_risk_score', 'escalation_level', 'clarity_score', 'effectiveness_score', 'status'];
    const fields = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    if (!Object.keys(fields).length) return res.status(400).json({ error: 'No updatable fields' });
    const sets = Object.keys(fields).map((k, i) => `${k} = $${i + 2}`).join(', ');
    const { rows } = await pool.query(`UPDATE ${TABLE} SET ${sets}, updated_at = NOW() WHERE id = $1 RETURNING *`, [req.params.id, ...Object.values(fields)]);
    if (!rows[0]) return res.status(404).json({ error: 'Communication not found' });
    res.json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`UPDATE ${TABLE} SET status = 'deleted', updated_at = NOW() WHERE id = $1 RETURNING *`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Communication not found' });
    res.json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/archive', async (req, res) => {
  try {
    const { rows } = await pool.query(`UPDATE ${TABLE} SET is_archived = true, updated_at = NOW() WHERE id = $1 RETURNING *`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Communication not found' });
    res.json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/restore', async (req, res) => {
  try {
    const { rows } = await pool.query(`UPDATE ${TABLE} SET is_archived = false, status = 'draft', updated_at = NOW() WHERE id = $1 RETURNING *`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Communication not found' });
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

router.post('/ai/classify-comms-tone', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Communication not found' });
    const comm = rows[0];
    const raw = await callAI('You are a communications tone classifier. Respond with valid JSON only.',
      `Classify the tone of this creator communication.
Type: ${comm.comms_type} | Current tone: ${comm.tone_label} | Escalation: ${comm.escalation_level} | Creator tier: ${comm.creator_tier}
Respond: { "tone_classification": "formal|empathetic|firm|educational|urgent|neutral", "appropriateness": "appropriate|too_harsh|too_soft", "recommended_adjustments": [...], "escalation_alignment": true|false }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/draft-notice-letter', aiRateLimiter, async (req, res) => {
  try {
    const { creator_tier, comms_type, policy_basis, escalation_level } = req.body;
    const raw = await callAI('You are a trust & safety notice letter writer. Respond with valid JSON only.',
      `Draft a notice letter for a creator.
Creator tier: ${creator_tier || 'standard'} | Communication type: ${comms_type || 'policy_notice'} | Policy basis: ${policy_basis || 'community guidelines'} | Escalation: ${escalation_level || 'none'}
Respond: { "letter_subject": "...", "letter_body": "...", "tone": "...", "key_messages": [...], "next_steps": [...], "appeal_rights_included": true|false }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/predict-creator-reaction', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Communication not found' });
    const comm = rows[0];
    const raw = await callAI('You are a creator relations predictor. Respond with valid JSON only.',
      `Predict how the creator may react to this communication.
Creator tier: ${comm.creator_tier} | Type: ${comm.comms_type} | Tone: ${comm.tone_label} | Escalation: ${comm.escalation_level} | Blast radius score: ${comm.influencer_blast_radius_score}
Respond: { "predicted_reaction": "compliant|appeal|ignore|public_dispute", "reaction_likelihood": {...}, "pr_risk_assessment": "...", "recommended_follow_up": "..." }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/suggest-education-resource', aiRateLimiter, async (req, res) => {
  try {
    const { policy_basis, comms_type } = req.body;
    const raw = await callAI('You are a creator education resource advisor. Respond with valid JSON only.',
      `Suggest educational resources to include with this creator communication.
Policy basis: ${policy_basis || 'community guidelines'} | Communication type: ${comms_type || 'policy_notice'}
Respond: { "recommended_resources": [...], "format": "...", "tone": "...", "key_learning_objectives": [...], "supplementary_materials": [...] }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/generate-deescalation-message', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Communication not found' });
    const comm = rows[0];
    const raw = await callAI('You are a de-escalation communications specialist. Respond with valid JSON only.',
      `Generate a de-escalation message for this creator situation.
Creator tier: ${comm.creator_tier} | Escalation level: ${comm.escalation_level} | Type: ${comm.comms_type} | PR risk: ${comm.pr_risk_score}
Respond: { "deescalation_approach": "...", "message_draft": "...", "empathy_elements": [...], "firm_boundaries": [...], "success_indicators": [...] }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/summarize-creator-history', aiRateLimiter, async (req, res) => {
  try {
    const { creator_id } = req.body;
    if (!creator_id) return res.status(400).json({ error: 'creator_id required' });
    const { rows } = await pool.query(`SELECT id, comms_type, channel, tone_label, escalation_level, sent_at, acknowledged_at FROM ${TABLE} WHERE creator_id = $1 ORDER BY created_at DESC`, [creator_id]);
    const raw = await callAI('You are a creator history analyst. Respond with valid JSON only.',
      `Summarize the communication history for creator ${creator_id}.
Total comms: ${rows.length} | History: ${JSON.stringify(rows.slice(0, 15))}
Respond: { "total_communications": ${rows.length}, "escalation_pattern": "...", "acknowledgment_rate": "...", "engagement_trend": "...", "risk_profile": "...", "summary": "..." }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/score-message-clarity', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Communication not found' });
    const comm = rows[0];
    const raw = await callAI('You are a message clarity evaluator. Respond with valid JSON only.',
      `Score the clarity of this creator communication.
Type: ${comm.comms_type} | Body length: ${comm.message_body ? comm.message_body.length : 0} chars | Tone: ${comm.tone_label}
Respond: { "clarity_score": 0-100, "readability": "...", "action_clarity": "...", "ambiguous_elements": [...], "improvement_suggestions": [...] }`);
    const result = parseAI(raw);
    await pool.query(`UPDATE ${TABLE} SET clarity_score = $1, updated_at = NOW() WHERE id = $2`, [result.clarity_score || null, id]);
    res.json({ success: true, result, model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/validate-comms-against-policy', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Communication not found' });
    const comm = rows[0];
    const raw = await callAI('You are a policy compliance validator for creator communications. Respond with valid JSON only.',
      `Validate this creator communication against stated policy basis.
Policy basis: ${comm.policy_basis || 'community guidelines'} | Communication type: ${comm.comms_type} | Escalation: ${comm.escalation_level}
Respond: { "policy_aligned": true|false, "compliance_gaps": [...], "over_enforcement_risk": "...", "under_enforcement_risk": "...", "recommended_corrections": [...] }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/recommend-channel-selection', aiRateLimiter, async (req, res) => {
  try {
    const { creator_tier, comms_type, escalation_level } = req.body;
    const raw = await callAI('You are a creator communications channel advisor. Respond with valid JSON only.',
      `Recommend the best channel for this creator communication.
Creator tier: ${creator_tier || 'standard'} | Communication type: ${comms_type || 'notice'} | Escalation: ${escalation_level || 'none'}
Respond: { "recommended_channel": "email|in-app|direct_message|certified_mail|phone", "rationale": "...", "delivery_timing": "...", "confirmation_method": "...", "alternative_channels": [...] }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/classify-creator-tier', aiRateLimiter, async (req, res) => {
  try {
    const { creator_id, follower_count, engagement_rate, historical_comms } = req.body;
    if (!creator_id) return res.status(400).json({ error: 'creator_id required' });
    const { rows } = await pool.query(`SELECT COUNT(*) AS comms, MAX(escalation_level) AS max_escalation FROM ${TABLE} WHERE creator_id = $1`, [creator_id]);
    const raw = await callAI('You are a creator tier classifier. Respond with valid JSON only.',
      `Classify the appropriate tier for this creator.
Creator: ${creator_id} | Followers: ${follower_count || 'unknown'} | Engagement: ${engagement_rate || 'unknown'} | Past comms: ${rows[0].comms} | Max escalation: ${rows[0].max_escalation || 'none'}
Respond: { "tier": "emerging|standard|partner|enterprise|vip", "tier_rationale": "...", "special_handling_required": true|false, "dedicated_contact_needed": true|false }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/detect-influencer-blast-radius', aiRateLimiter, async (req, res) => {
  try {
    const { creator_id, follower_count, platform } = req.body;
    if (!creator_id) return res.status(400).json({ error: 'creator_id required' });
    const raw = await callAI('You are an influencer impact analyst. Respond with valid JSON only.',
      `Assess the potential blast radius if this creator goes public about an enforcement action.
Creator: ${creator_id} | Followers: ${follower_count || 'unknown'} | Platform: ${platform || 'unknown'}
Respond: { "blast_radius_score": 0-100, "potential_reach": "...", "pr_risk_level": "low|medium|high|critical", "viral_potential": "...", "recommended_handling_approach": "..." }`);
    const result = parseAI(raw);
    res.json({ success: true, result, model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/predict-pr-risk', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Communication not found' });
    const comm = rows[0];
    const raw = await callAI('You are a PR risk predictor for trust & safety. Respond with valid JSON only.',
      `Predict the PR risk of this creator communication.
Creator tier: ${comm.creator_tier} | Type: ${comm.comms_type} | Escalation: ${comm.escalation_level} | Blast radius: ${comm.influencer_blast_radius_score}
Respond: { "pr_risk_score": 0-100, "risk_level": "low|medium|high|critical", "risk_scenarios": [...], "mitigation_strategies": [...] }`);
    const result = parseAI(raw);
    await pool.query(`UPDATE ${TABLE} SET pr_risk_score = $1, updated_at = NOW() WHERE id = $2`, [result.pr_risk_score || null, id]);
    res.json({ success: true, result, model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/recommend-escalation-path', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Communication not found' });
    const comm = rows[0];
    const raw = await callAI('You are an escalation path advisor. Respond with valid JSON only.',
      `Recommend the escalation path for this creator communication situation.
Current escalation: ${comm.escalation_level} | Type: ${comm.comms_type} | PR risk: ${comm.pr_risk_score} | Creator tier: ${comm.creator_tier}
Respond: { "recommended_escalation_path": [...], "decision_criteria": [...], "stakeholders_to_involve": [...], "documentation_required": [...], "timeline": "..." }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/generate-press-statement-template', aiRateLimiter, async (req, res) => {
  try {
    const { escalation_scenario, creator_tier } = req.body;
    const raw = await callAI('You are a press relations specialist for trust & safety. Respond with valid JSON only.',
      `Generate a press statement template for a creator escalation scenario.
Scenario: ${escalation_scenario || 'general enforcement action'} | Creator tier: ${creator_tier || 'standard'}
Respond: { "statement_template": "...", "key_talking_points": [...], "phrases_to_avoid": [...], "proactive_messaging": "...", "spokesperson_notes": "..." }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/score-comms-effectiveness', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Communication not found' });
    const comm = rows[0];
    const raw = await callAI('You are a communications effectiveness evaluator. Respond with valid JSON only.',
      `Score the effectiveness of this creator communication.
Sent: ${comm.sent_at ? 'yes' : 'no'} | Acknowledged: ${comm.acknowledged_at ? 'yes' : 'no'} | Type: ${comm.comms_type} | Clarity: ${comm.clarity_score}
Respond: { "effectiveness_score": 0-100, "delivery_success": "...", "response_rate": "...", "outcome_achieved": "...", "improvement_areas": [...] }`);
    const result = parseAI(raw);
    await pool.query(`UPDATE ${TABLE} SET effectiveness_score = $1, ai_result = $2, updated_at = NOW() WHERE id = $3`, [result.effectiveness_score || null, JSON.stringify(result), id]);
    res.json({ success: true, result, model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/summarize-comms-history', aiRateLimiter, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT comms_type, channel, tone_label, escalation_level, COUNT(*) AS count, AVG(effectiveness_score) AS avg_effectiveness FROM ${TABLE} WHERE created_at > NOW() - INTERVAL '90 days' GROUP BY comms_type, channel, tone_label, escalation_level`);
    const raw = await callAI('You are a communications history analyst. Respond with valid JSON only.',
      `Summarize creator communications over the past 90 days.
Data: ${JSON.stringify(rows)}
Respond: { "total_comms": "...", "most_common_type": "...", "avg_effectiveness": "...", "escalation_rate": "...", "channel_effectiveness": {...}, "improvement_opportunities": [...] }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

module.exports = router;
