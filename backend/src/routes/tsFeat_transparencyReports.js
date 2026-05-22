/**
 * Trust & Safety — Transparency Reports
 * Table: ts_transparency_reports
 * Mount: /api/ts/transparency-reports
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

const TABLE = 'ts_transparency_reports';
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
    if (req.query.report_type) { params.push(req.query.report_type); where.push(`report_type = $${params.length}`); }
    const wc = where.length ? `WHERE ${where.join(' AND ')}` : '';
    params.push(limit); params.push(offset);
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} ${wc} ORDER BY period_end DESC NULLS LAST LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
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
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE report_title ILIKE $1 OR report_type ILIKE $1 OR section_key ILIKE $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, [`%${q}%`, limit, offset]);
    const cr = await pool.query(`SELECT COUNT(*) FROM ${TABLE} WHERE report_title ILIKE $1 OR report_type ILIKE $1 OR section_key ILIKE $1`, [`%${q}%`]);
    res.json({ data: rows, pagination: { page, limit, total: parseInt(cr.rows[0].count) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/by-type/:type', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE report_type = $1 ORDER BY period_end DESC`, [req.params.type]);
    res.json({ data: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/by-period', async (req, res) => {
  try {
    const { start, end } = req.query;
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE period_start >= $1 AND period_end <= $2 ORDER BY period_end DESC`, [start || '2000-01-01', end || '2099-12-31']);
    res.json({ data: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/export/csv', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} ORDER BY period_end DESC`);
    const fields = ['id', 'report_title', 'period_start', 'period_end', 'report_type', 'section_key', 'disclosure_sensitivity', 'completeness_score', 'comparability_score', 'published_at', 'status', 'created_at'];
    const header = fields.join(',');
    const csvRows = rows.map(r => fields.map(f => `"${String(r[f] ?? '').replace(/"/g, '""')}"`).join(','));
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="transparency_reports.csv"');
    res.send([header, ...csvRows].join('\n'));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/stats/summary', async (req, res) => {
  try {
    const [byType, byStatus, published, total] = await Promise.all([
      pool.query(`SELECT report_type, COUNT(*) FROM ${TABLE} GROUP BY report_type`),
      pool.query(`SELECT status, COUNT(*) FROM ${TABLE} GROUP BY status`),
      pool.query(`SELECT COUNT(*) FROM ${TABLE} WHERE published_at IS NOT NULL`),
      pool.query(`SELECT COUNT(*) FROM ${TABLE}`),
    ]);
    res.json({ byType: byType.rows, byStatus: byStatus.rows, publishedCount: parseInt(published.rows[0].count), total: parseInt(total.rows[0].count) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/batch', async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'items array required' });
    const created = [];
    for (const item of items) {
      if (!item.report_title) continue;
      const { rows } = await pool.query(`INSERT INTO ${TABLE} (report_title, period_start, period_end, report_type, section_key, metrics, narrative, disclosure_sensitivity, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [item.report_title, item.period_start, item.period_end, item.report_type, item.section_key, item.metrics ? JSON.stringify(item.metrics) : null, item.narrative, item.disclosure_sensitivity || 'public', req.user?.id || null]);
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
      if (!obj.report_title) continue;
      const { rows } = await pool.query(`INSERT INTO ${TABLE} (report_title, report_type, period_start, period_end, created_by) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING *`,
        [obj.report_title, obj.report_type, obj.period_start, obj.period_end, req.user?.id || null]);
      if (rows[0]) created.push(rows[0]);
    }
    res.status(201).json({ data: created, count: created.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Report not found' });
    res.json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { report_title, period_start, period_end, report_type, section_key, metrics, narrative, disclosure_sensitivity } = req.body;
    if (!report_title) return res.status(400).json({ error: 'report_title required' });
    const { rows } = await pool.query(`INSERT INTO ${TABLE} (report_title, period_start, period_end, report_type, section_key, metrics, narrative, disclosure_sensitivity, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [report_title, period_start, period_end, report_type, section_key, metrics ? JSON.stringify(metrics) : null, narrative, disclosure_sensitivity || 'public', req.user?.id || null]);
    res.status(201).json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const allowed = ['report_title', 'period_start', 'period_end', 'report_type', 'section_key', 'metrics', 'narrative', 'disclosure_sensitivity', 'completeness_score', 'comparability_score', 'press_summary', 'published_at', 'status'];
    const fields = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    if (!Object.keys(fields).length) return res.status(400).json({ error: 'No updatable fields' });
    const sets = Object.keys(fields).map((k, i) => `${k} = $${i + 2}`).join(', ');
    const { rows } = await pool.query(`UPDATE ${TABLE} SET ${sets}, updated_at = NOW() WHERE id = $1 RETURNING *`, [req.params.id, ...Object.values(fields)]);
    if (!rows[0]) return res.status(404).json({ error: 'Report not found' });
    res.json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`UPDATE ${TABLE} SET status = 'deleted', updated_at = NOW() WHERE id = $1 RETURNING *`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Report not found' });
    res.json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/archive', async (req, res) => {
  try {
    const { rows } = await pool.query(`UPDATE ${TABLE} SET is_archived = true, updated_at = NOW() WHERE id = $1 RETURNING *`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Report not found' });
    res.json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/restore', async (req, res) => {
  try {
    const { rows } = await pool.query(`UPDATE ${TABLE} SET is_archived = false, status = 'draft', updated_at = NOW() WHERE id = $1 RETURNING *`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Report not found' });
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

router.post('/ai/classify-report-section', aiRateLimiter, async (req, res) => {
  try {
    const { section_content, report_type } = req.body;
    const raw = await callAI('You are a transparency report section classifier. Respond with valid JSON only.',
      `Classify this report section content.
Report type: ${report_type || 'general'} | Section content: ${section_content || 'not provided'}
Respond: { "section_category": "...", "disclosure_level": "public|restricted|confidential", "required_disclosures_covered": [...], "missing_disclosures": [...] }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/suggest-metric-definition', aiRateLimiter, async (req, res) => {
  try {
    const { metric_name, report_type } = req.body;
    const raw = await callAI('You are a trust & safety metrics specialist. Respond with valid JSON only.',
      `Suggest a clear definition for this metric in a transparency report.
Metric: ${metric_name || 'unknown'} | Report type: ${report_type || 'general'}
Respond: { "metric_name": "...", "definition": "...", "calculation_method": "...", "data_sources": [...], "industry_standard_alignment": "...", "disclosure_recommendation": "..." }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/detect-metric-anomaly', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Report not found' });
    const report = rows[0];
    const raw = await callAI('You are a metrics anomaly detector. Respond with valid JSON only.',
      `Detect anomalies in this report's metrics.
Report: ${report.report_title} | Period: ${report.period_start} to ${report.period_end} | Metrics: ${JSON.stringify(report.metrics)}
Respond: { "anomalies_detected": true|false, "anomalous_metrics": [...], "anomaly_types": [...], "investigation_recommended": true|false, "likely_explanations": [...] }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/predict-stakeholder-question', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Report not found' });
    const report = rows[0];
    const raw = await callAI('You are a stakeholder communications advisor. Respond with valid JSON only.',
      `Predict likely stakeholder questions about this transparency report.
Title: ${report.report_title} | Type: ${report.report_type} | Period: ${report.period_start} to ${report.period_end}
Respond: { "predicted_questions": [...], "high_sensitivity_areas": [...], "proactive_disclosures_recommended": [...], "media_likely_focus": [...] }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/recommend-narrative-framing', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Report not found' });
    const report = rows[0];
    const raw = await callAI('You are a transparency communications strategist. Respond with valid JSON only.',
      `Recommend narrative framing for this transparency report.
Title: ${report.report_title} | Type: ${report.report_type} | Narrative: ${report.narrative || 'not yet written'}
Respond: { "recommended_tone": "...", "key_messages": [...], "framing_approach": "...", "risks_to_avoid": [...], "strengths_to_highlight": [...] }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/generate-report-section', aiRateLimiter, async (req, res) => {
  try {
    const { id, section_key } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Report not found' });
    const report = rows[0];
    const raw = await callAI('You are a transparency report writer. Respond with valid JSON only.',
      `Generate the ${section_key || 'executive summary'} section for this transparency report.
Report: ${report.report_title} | Type: ${report.report_type} | Period: ${report.period_start} to ${report.period_end}
Respond: { "section_title": "...", "section_content": "...", "key_findings": [...], "data_citations": [...], "word_count": number }`);
    const result = parseAI(raw);
    await pool.query(`UPDATE ${TABLE} SET ai_result = $1, updated_at = NOW() WHERE id = $2`, [JSON.stringify(result), id]);
    res.json({ success: true, result, model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/summarize-period-trends', aiRateLimiter, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT id, report_title, period_start, period_end, metrics, completeness_score FROM ${TABLE} WHERE published_at IS NOT NULL ORDER BY period_end DESC LIMIT 8`);
    const raw = await callAI('You are a transparency trends analyst. Respond with valid JSON only.',
      `Summarize trends across the most recent transparency report periods.
Reports: ${JSON.stringify(rows)}
Respond: { "trend_summary": "...", "metric_improvements": [...], "metric_declines": [...], "notable_events": [...], "forecast": "..." }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/score-report-completeness', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Report not found' });
    const report = rows[0];
    const raw = await callAI('You are a transparency report completeness evaluator. Respond with valid JSON only.',
      `Score the completeness of this transparency report.
Title: ${report.report_title} | Narrative: ${report.narrative ? 'present' : 'missing'} | Metrics: ${report.metrics ? 'present' : 'missing'} | Press summary: ${report.press_summary ? 'present' : 'missing'} | Published: ${report.published_at ? 'yes' : 'no'}
Respond: { "completeness_score": 0-100, "present_elements": [...], "missing_elements": [...], "improvement_actions": [...], "publication_ready": true|false }`);
    const result = parseAI(raw);
    await pool.query(`UPDATE ${TABLE} SET completeness_score = $1, ai_result = $2, updated_at = NOW() WHERE id = $3`, [result.completeness_score || null, JSON.stringify(result), id]);
    res.json({ success: true, result, model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/validate-metric-reproducibility', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Report not found' });
    const report = rows[0];
    const raw = await callAI('You are a metrics reproducibility auditor. Respond with valid JSON only.',
      `Validate whether the metrics in this report are reproducible and well-defined.
Metrics: ${JSON.stringify(report.metrics)} | Report type: ${report.report_type}
Respond: { "reproducibility_score": 0-100, "well_defined_metrics": [...], "ambiguous_metrics": [...], "data_source_gaps": [...], "methodology_improvements": [...] }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/suggest-additional-disclosure', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Report not found' });
    const report = rows[0];
    const raw = await callAI('You are a transparency disclosure advisor. Respond with valid JSON only.',
      `Suggest additional disclosures for this report.
Type: ${report.report_type} | Current sensitivity: ${report.disclosure_sensitivity} | Metrics present: ${report.metrics ? 'yes' : 'no'}
Respond: { "suggested_disclosures": [...], "industry_standard_additions": [...], "regulatory_requirement_additions": [...], "voluntary_additions": [...] }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/classify-disclosure-sensitivity', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Report not found' });
    const report = rows[0];
    const raw = await callAI('You are a disclosure sensitivity classifier. Respond with valid JSON only.',
      `Classify the disclosure sensitivity of this report's content.
Report type: ${report.report_type} | Section: ${report.section_key} | Current classification: ${report.disclosure_sensitivity}
Respond: { "recommended_sensitivity": "public|restricted|confidential", "sensitive_elements": [...], "redaction_recommendations": [...], "rationale": "..." }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/predict-media-pickup', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Report not found' });
    const report = rows[0];
    const raw = await callAI('You are a media relations strategist. Respond with valid JSON only.',
      `Predict media pickup likelihood and focus areas for this transparency report.
Title: ${report.report_title} | Type: ${report.report_type} | Sensitivity: ${report.disclosure_sensitivity}
Respond: { "pickup_likelihood": "low|medium|high|very_high", "likely_focus_areas": [...], "potential_headlines": [...], "recommended_proactive_actions": [...] }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/recommend-comparative-baseline', aiRateLimiter, async (req, res) => {
  try {
    const { report_type } = req.body;
    const raw = await callAI('You are a transparency benchmarking advisor. Respond with valid JSON only.',
      `Recommend comparative baselines for a ${report_type || 'general'} transparency report.
Respond: { "peer_companies": [...], "industry_benchmarks": [...], "regulatory_baselines": [...], "comparison_methodology": "...", "recommended_metrics": [...] }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/generate-press-summary', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Report not found' });
    const report = rows[0];
    const raw = await callAI('You are a press communications writer. Respond with valid JSON only.',
      `Generate a press summary for this transparency report.
Title: ${report.report_title} | Type: ${report.report_type} | Period: ${report.period_start} to ${report.period_end}
Respond: { "headline": "...", "summary_paragraphs": [...], "key_statistics": [...], "quote_suggestion": "...", "embargo_recommendation": "..." }`);
    const result = parseAI(raw);
    await pool.query(`UPDATE ${TABLE} SET press_summary = $1, updated_at = NOW() WHERE id = $2`, [result.headline ? JSON.stringify(result) : result.raw_response, id]);
    res.json({ success: true, result, model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/score-comparability-vs-peers', aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Report not found' });
    const report = rows[0];
    const raw = await callAI('You are a peer comparison analyst for transparency reports. Respond with valid JSON only.',
      `Score how comparable this report is versus industry peers.
Report type: ${report.report_type} | Metrics present: ${report.metrics ? 'yes' : 'no'} | Completeness: ${report.completeness_score}
Respond: { "comparability_score": 0-100, "strengths_vs_peers": [...], "gaps_vs_peers": [...], "best_practice_elements_missing": [...] }`);
    const result = parseAI(raw);
    await pool.query(`UPDATE ${TABLE} SET comparability_score = $1, updated_at = NOW() WHERE id = $2`, [result.comparability_score || null, id]);
    res.json({ success: true, result, model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/ai/summarize-yoy-changes', aiRateLimiter, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT id, report_title, period_start, period_end, metrics FROM ${TABLE} WHERE published_at IS NOT NULL ORDER BY period_end DESC LIMIT 4`);
    const raw = await callAI('You are a year-over-year change analyst. Respond with valid JSON only.',
      `Summarize year-over-year changes across transparency reports.
Reports (most recent first): ${JSON.stringify(rows)}
Respond: { "yoy_changes": {...}, "improving_metrics": [...], "declining_metrics": [...], "stable_metrics": [...], "summary": "..." }`);
    res.json({ success: true, result: parseAI(raw), model: OPENROUTER_MODEL });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

module.exports = router;
