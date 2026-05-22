/**
 * Trust & Safety — Human Review Queue
 * Table: ts_review_queue
 * Mount: /api/ts/human-review-queue
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

const TABLE = 'ts_review_queue';
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
    if (req.query.queue_priority) { params.push(req.query.queue_priority); where.push(`queue_priority = $${params.length}`); }
    if (req.query.assigned_reviewer) { params.push(req.query.assigned_reviewer); where.push(`assigned_reviewer = $${params.length}`); }
    const wc = where.length ? `WHERE ${where.join(' AND ')}` : '';
    params.push(limit); params.push(offset);
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} ${wc} ORDER BY sla_deadline ASC NULLS LAST, created_at ASC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    const cr = await pool.query(`SELECT COUNT(*) FROM ${TABLE} ${wc}`, params.slice(0, params.length - 2));
    res.json({ data: rows, pagination: { page, limit, total: parseInt(cr.rows[0].count), totalPages: Math.ceil(parseInt(cr.rows[0].count) / limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/count', async (req, res) => {
  try {
    const where = []; const params = [];
    if (req.query.status) { params.push(req.query.status); where.push(`status = $${params.length}`); }
    if (req.query.assigned_reviewer) { params.push(req.query.assigned_reviewer); where.push(`assigned_reviewer = $${params.length}`); }
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
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE content_id ILIKE $1 OR content_type ILIKE $1 OR batch_group ILIKE $1 OR decision ILIKE $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, [`%${q}%`, limit, offset]);
    const cr = await pool.query(`SELECT COUNT(*) FROM ${TABLE} WHERE content_id ILIKE $1 OR content_type ILIKE $1 OR batch_group ILIKE $1 OR decision ILIKE $1`, [`%${q}%`]);
    res.json({ data: rows, pagination: { page, limit, total: parseInt(cr.rows[0].count) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/by-content/:contentId', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE content_id = $1 ORDER BY created_at DESC`, [req.params.contentId]);
    res.json({ data: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/by-reviewer/:reviewerId', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE assigned_reviewer = $1 ORDER BY sla_deadline ASC NULLS LAST LIMIT $2 OFFSET $3`, [req.params.reviewerId, limit, offset]);
    res.json({ data: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/export/csv', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} ORDER BY created_at DESC`);
    const fields = ['id', 'content_id', 'content_type', 'queue_priority', 'sla_deadline', 'assigned_reviewer', 'decision', 'decision_at', 'escalated', 'batch_group', 'coaching_flag', 'status', 'created_at'];
    const header = fields.join(',');
    const csvRows = rows.map(r => fields.map(f => `"${String(r[f] ?? '').replace(/"/g, '""')}"`).join(','));
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="review_queue.csv"');
    res.send([header, ...csvRows].join('\n'));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/stats/summary', async (req, res) => {
  try {
    const [byStatus, byPriority, byDecision, overSLA] = await Promise.all([
      pool.query(`SELECT status, COUNT(*) FROM ${TABLE} GROUP BY status`),
      pool.query(`SELECT queue_priority, COUNT(*) FROM ${TABLE} GROUP BY queue_priority`),
      pool.query(`SELECT decision, COUNT(*) FROM ${TABLE} WHERE decision IS NOT NULL GROUP BY decision`),
      pool.query(`SELECT COUNT(*) FROM ${TABLE} WHERE sla_deadline < NOW() AND status = 'pending'`),
    ]);
    res.json({ byStatus: byStatus.rows, byPriority: byPriority.rows, byDecision: byDecision.rows, overSlaCount: parseInt(overSLA.rows[0].count) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/batch', async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'items array required' });
    const created = [];
    for (const item of items) {
      const { rows } = await pool.query(
        `INSERT INTO ${TABLE} (content_id, content_type, queue_priority, sla_deadline, assigned_reviewer, policy_rule_id, batch_group, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [item.content_id, item.content_type, item.queue_priority || 'normal', item.sla_deadline, item.assigned_reviewer, item.policy_rule_id, item.batch_group, req.user?.id || null]
      );
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
      const { rows } = await pool.query(`INSERT INTO ${TABLE} (content_id, content_type, queue_priority, created_by) VALUES ($1,$2,$3,$4) RETURNING *`,
        [obj.content_id, obj.content_type, obj.queue_priority || 'normal', req.user?.id || null]);
      created.push(rows[0]);
    }
    res.status(201).json({ data: created, count: created.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Queue item not found' });
    res.json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { content_id, content_type, queue_priority, sla_deadline, assigned_reviewer, policy_rule_id, batch_group } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO ${TABLE} (content_id, content_type, queue_priority, sla_deadline, assigned_reviewer, policy_rule_id, batch_group, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [content_id, content_type, queue_priority || 'normal', sla_deadline, assigned_reviewer, policy_rule_id, batch_group, req.user?.id || null]
    );
    res.status(201).json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const allowed = ['content_id', 'content_type', 'queue_priority', 'sla_deadline', 'assigned_reviewer', 'decision', 'decision_notes', 'decision_at', 'policy_rule_id', 'escalated', 'escalation_reason', 'batch_group', 'reviewer_fatigue_score', 'coaching_flag', 'status'];
    const fields = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    if (!Object.keys(fields).length) return res.status(400).json({ error: 'No updatable fields' });
    const sets = Object.keys(fields).map((k, i) => `${k} = $${i + 2}`).join(', ');
    const { rows } = await pool.query(`UPDATE ${TABLE} SET ${sets}, updated_at = NOW() WHERE id = $1 RETURNING *`, [req.params.id, ...Object.values(fields)]);
    if (!rows[0]) return res.status(404).json({ error: 'Queue item not found' });
    res.json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`UPDATE ${TABLE} SET status = 'deleted', updated_at = NOW() WHERE id = $1 RETURNING *`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Queue item not found' });
    res.json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/archive', async (req, res) => {
  try {
    const { rows } = await pool.query(`UPDATE ${TABLE} SET is_archived = true, updated_at = NOW() WHERE id = $1 RETURNING *`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Queue item not found' });
    res.json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/restore', async (req, res) => {
  try {
    const { rows } = await pool.query(`UPDATE ${TABLE} SET is_archived = false, status = 'pending', updated_at = NOW() WHERE id = $1 RETURNING *`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Queue item not found' });
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

router.post('/ai/predict-review-time', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Queue item not found' });
    const item = rows[0];
    const raw = await callAI('You are a workflow time prediction specialist. Respond with valid JSON only.',
      `Predict review time for this queue item.
Priority: ${item.queue_priority} | Content type: ${item.content_type} | SLA deadline: ${item.sla_deadline} | Escalated: ${item.escalated}
Respond: { "estimated_minutes": number, "confidence": "high|medium|low", "complexity_factors": [...], "recommended_reviewer_tier": "...", "sla_at_risk": true|false }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/classify-queue-priority', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Queue item not found' });
    const item = rows[0];
    const raw = await callAI('You are a content moderation queue prioritizer. Respond with valid JSON only.',
      `Classify the appropriate queue priority for this item.
Content type: ${item.content_type} | Current priority: ${item.queue_priority} | SLA deadline: ${item.sla_deadline} | Escalated: ${item.escalated}
Respond: { "recommended_priority": "critical|high|normal|low", "rationale": "...", "urgency_signals": [...], "escalation_warranted": true|false }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/recommend-assignee', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const [itemRes, loadRes] = await Promise.all([
      pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]),
      pool.query(`SELECT assigned_reviewer, COUNT(*) AS pending FROM ${TABLE} WHERE status = 'pending' AND assigned_reviewer IS NOT NULL GROUP BY assigned_reviewer ORDER BY pending ASC LIMIT 10`),
    ]);
    if (!itemRes.rows[0]) return res.status(404).json({ error: 'Queue item not found' });
    const item = itemRes.rows[0];
    const raw = await callAI('You are a workforce assignment optimizer. Respond with valid JSON only.',
      `Recommend the best assignee for this review item.
Content type: ${item.content_type} | Priority: ${item.queue_priority} | Escalated: ${item.escalated}
Reviewer load: ${JSON.stringify(loadRes.rows)}
Respond: { "recommended_reviewer_id": "...", "load_balancing_rationale": "...", "specialty_required": "...", "backup_reviewer_id": "..." }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/detect-reviewer-fatigue', aiRateLimiter, async (req, res) => {
  try {
    const { reviewer_id } = req.body;
    if (!reviewer_id) return res.status(400).json({ error: 'reviewer_id required' });
    const { rows } = await pool.query(`SELECT id, decision, decision_at, decision_notes, coaching_flag, reviewer_fatigue_score FROM ${TABLE} WHERE assigned_reviewer = $1 ORDER BY decision_at DESC LIMIT 100`, [reviewer_id]);
    const raw = await callAI('You are a reviewer wellbeing and performance analyst. Respond with valid JSON only.',
      `Detect signs of reviewer fatigue from this reviewer's recent decision history.
Records reviewed: ${rows.length} | Recent decisions: ${JSON.stringify(rows.slice(0, 20))}
Respond: { "fatigue_detected": true|false, "fatigue_score": 0-100, "fatigue_indicators": [...], "recommended_action": "...", "break_recommended": true|false }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/score-queue-health', aiRateLimiter, async (req, res) => {
  try {
    const [pending, overSLA, byPriority] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM ${TABLE} WHERE status = 'pending'`),
      pool.query(`SELECT COUNT(*) FROM ${TABLE} WHERE status = 'pending' AND sla_deadline < NOW()`),
      pool.query(`SELECT queue_priority, COUNT(*) FROM ${TABLE} WHERE status = 'pending' GROUP BY queue_priority`),
    ]);
    const raw = await callAI('You are a content moderation operations analyst. Respond with valid JSON only.',
      `Score the health of the review queue.
Pending: ${pending.rows[0].count} | Over SLA: ${overSLA.rows[0].count} | By priority: ${JSON.stringify(byPriority.rows)}
Respond: { "health_score": 0-100, "status": "healthy|stressed|critical", "key_issues": [...], "recommended_actions": [...], "staffing_adequacy": "..." }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/generate-queue-summary', aiRateLimiter, async (req, res) => {
  try {
    const [pending, decisions, escalated] = await Promise.all([
      pool.query(`SELECT queue_priority, COUNT(*) FROM ${TABLE} WHERE status = 'pending' GROUP BY queue_priority`),
      pool.query(`SELECT decision, COUNT(*) FROM ${TABLE} WHERE created_at > NOW() - INTERVAL '24 hours' GROUP BY decision`),
      pool.query(`SELECT COUNT(*) FROM ${TABLE} WHERE escalated = true AND status = 'pending'`),
    ]);
    const raw = await callAI('You are a content moderation operations manager. Respond with valid JSON only.',
      `Generate a queue summary report.
Pending by priority: ${JSON.stringify(pending.rows)} | Decisions last 24h: ${JSON.stringify(decisions.rows)} | Escalated pending: ${escalated.rows[0].count}
Respond: { "summary": "...", "throughput_assessment": "...", "top_priorities": [...], "escalation_alert": "...", "recommended_focus": "..." }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/summarize-reviewer-throughput', aiRateLimiter, async (req, res) => {
  try {
    const { reviewer_id, days = 7 } = req.body;
    const whereClause = reviewer_id ? `WHERE assigned_reviewer = $1 AND decision_at > NOW() - INTERVAL '${parseInt(days)} days'` : `WHERE decision_at > NOW() - INTERVAL '${parseInt(days)} days'`;
    const params = reviewer_id ? [reviewer_id] : [];
    const [throughput, decisions] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM ${TABLE} ${whereClause}`, params),
      pool.query(`SELECT decision, COUNT(*) FROM ${TABLE} ${whereClause} GROUP BY decision`, params),
    ]);
    const raw = await callAI('You are a reviewer throughput analyst. Respond with valid JSON only.',
      `Summarize reviewer throughput for the past ${days} days.
Total decisions: ${throughput.rows[0].count} | By decision type: ${JSON.stringify(decisions.rows)}
Respond: { "total_reviewed": ${throughput.rows[0].count}, "decisions_per_day": "...", "decision_distribution": ${JSON.stringify(decisions.rows)}, "productivity_assessment": "...", "recommendations": [...] }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/validate-sla-adherence', aiRateLimiter, async (req, res) => {
  try {
    const [total, breached, pending] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM ${TABLE} WHERE decision_at IS NOT NULL`),
      pool.query(`SELECT COUNT(*) FROM ${TABLE} WHERE decision_at > sla_deadline AND sla_deadline IS NOT NULL`),
      pool.query(`SELECT COUNT(*) FROM ${TABLE} WHERE status = 'pending' AND sla_deadline < NOW()`),
    ]);
    const raw = await callAI('You are an SLA compliance analyst. Respond with valid JSON only.',
      `Validate SLA adherence for the review queue.
Total decided: ${total.rows[0].count} | SLA breaches: ${breached.rows[0].count} | Currently overdue: ${pending.rows[0].count}
Respond: { "sla_compliance_rate": "...", "breach_severity": "acceptable|warning|critical", "root_cause_hypotheses": [...], "remediation_steps": [...] }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/suggest-batch-grouping', aiRateLimiter, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT id, content_type, queue_priority, batch_group FROM ${TABLE} WHERE status = 'pending' AND batch_group IS NULL LIMIT 100`);
    const raw = await callAI('You are a content moderation workflow optimizer. Respond with valid JSON only.',
      `Suggest batch groupings for efficient review of ${rows.length} pending ungrouped items.
Items: ${JSON.stringify(rows.slice(0, 30))}
Respond: { "suggested_groups": [{ "group_name": "...", "item_ids": [...], "rationale": "...", "review_order": "..." }], "efficiency_benefit": "...", "grouping_rationale": "..." }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/detect-coaching-need', aiRateLimiter, async (req, res) => {
  try {
    const { reviewer_id } = req.body;
    if (!reviewer_id) return res.status(400).json({ error: 'reviewer_id required' });
    const { rows } = await pool.query(`SELECT id, decision, coaching_flag, reviewer_fatigue_score, decision_notes FROM ${TABLE} WHERE assigned_reviewer = $1 ORDER BY decision_at DESC LIMIT 50`, [reviewer_id]);
    const raw = await callAI('You are a reviewer coaching specialist. Respond with valid JSON only.',
      `Assess coaching needs for reviewer ${reviewer_id} based on decision history.
Total reviewed: ${rows.length} | Flagged: ${rows.filter(r => r.coaching_flag).length} | Recent: ${JSON.stringify(rows.slice(0, 10))}
Respond: { "coaching_needed": true|false, "coaching_areas": [...], "performance_strengths": [...], "recommended_training": [...], "urgency": "immediate|scheduled|optional" }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/classify-decision-disagreement', aiRateLimiter, async (req, res) => {
  try {
    const { id1, id2 } = req.body;
    if (!id1 || !id2) return res.status(400).json({ error: 'id1 and id2 required' });
    const [r1, r2] = await Promise.all([pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id1]), pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id2])]);
    if (!r1.rows[0] || !r2.rows[0]) return res.status(404).json({ error: 'One or both items not found' });
    const raw = await callAI('You are a quality assurance analyst for content moderation. Respond with valid JSON only.',
      `Classify the disagreement between these two similar review decisions.
Item 1: content_type=${r1.rows[0].content_type}, decision=${r1.rows[0].decision} | Item 2: content_type=${r2.rows[0].content_type}, decision=${r2.rows[0].decision}
Respond: { "disagreement_type": "none|minor|significant|policy_gap", "root_cause": "...", "resolution_needed": true|false, "policy_clarification_recommended": "..." }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/predict-overflow-risk', aiRateLimiter, async (req, res) => {
  try {
    const [pending, hourly] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM ${TABLE} WHERE status = 'pending'`),
      pool.query(`SELECT DATE_TRUNC('hour', created_at) AS hour, COUNT(*) FROM ${TABLE} WHERE created_at > NOW() - INTERVAL '24 hours' GROUP BY 1 ORDER BY 1`),
    ]);
    const raw = await callAI('You are a capacity planning analyst. Respond with valid JSON only.',
      `Predict queue overflow risk.
Current pending: ${pending.rows[0].count} | Hourly intake trend: ${JSON.stringify(hourly.rows)}
Respond: { "overflow_risk": "low|medium|high|critical", "estimated_overflow_time": "...", "recommended_staffing_increase": "...", "mitigation_options": [...] }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/recommend-staffing-adjust', aiRateLimiter, async (req, res) => {
  try {
    const [pending, reviewers, capacity] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM ${TABLE} WHERE status = 'pending'`),
      pool.query(`SELECT COUNT(DISTINCT assigned_reviewer) FROM ${TABLE} WHERE assigned_reviewer IS NOT NULL`),
      pool.query(`SELECT AVG(EXTRACT(EPOCH FROM (decision_at - created_at))/3600) AS avg_hours FROM ${TABLE} WHERE decision_at IS NOT NULL AND created_at > NOW() - INTERVAL '7 days'`),
    ]);
    const raw = await callAI('You are a workforce planning specialist. Respond with valid JSON only.',
      `Recommend staffing adjustments for the review queue.
Pending items: ${pending.rows[0].count} | Active reviewers: ${reviewers.rows[0].count} | Avg review hours: ${capacity.rows[0].avg_hours || 'unknown'}
Respond: { "current_capacity_assessment": "...", "recommended_adjustment": "...", "additional_reviewers_needed": number, "priority_shifts": [...], "timeline_recommendation": "..." }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/generate-coaching-feedback', aiRateLimiter, async (req, res) => {
  try {
    const { reviewer_id, item_id } = req.body;
    if (!reviewer_id || !item_id) return res.status(400).json({ error: 'reviewer_id and item_id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [item_id]);
    if (!rows[0]) return res.status(404).json({ error: 'Queue item not found' });
    const item = rows[0];
    const raw = await callAI('You are a content moderation coaching expert. Respond with valid JSON only.',
      `Generate constructive coaching feedback for reviewer ${reviewer_id} on this decision.
Content type: ${item.content_type} | Decision: ${item.decision} | Decision notes: ${item.decision_notes || 'none'} | Coaching flag: ${item.coaching_flag}
Respond: { "feedback_summary": "...", "what_went_well": [...], "areas_for_improvement": [...], "specific_guidance": "...", "follow_up_action": "..." }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/score-decision-quality', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Queue item not found' });
    const item = rows[0];
    const raw = await callAI('You are a content moderation quality assessor. Respond with valid JSON only.',
      `Score the quality of this review decision.
Decision: ${item.decision} | Notes: ${item.decision_notes || 'none'} | Time taken: calculated | Escalated: ${item.escalated} | Coaching flag: ${item.coaching_flag}
Respond: { "quality_score": 0-100, "documentation_completeness": "...", "decision_clarity": "...", "policy_alignment": "...", "improvement_areas": [...] }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/summarize-decision-variance', aiRateLimiter, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT assigned_reviewer, decision, COUNT(*) FROM ${TABLE} WHERE decision IS NOT NULL GROUP BY assigned_reviewer, decision ORDER BY assigned_reviewer`);
    const raw = await callAI('You are a content moderation consistency analyst. Respond with valid JSON only.',
      `Summarize decision variance across reviewers.
Decision distribution by reviewer: ${JSON.stringify(rows)}
Respond: { "overall_consistency_score": 0-100, "high_variance_reviewers": [...], "decision_patterns": {...}, "policy_gap_indicators": [...], "recommendations": [...] }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

module.exports = router;
