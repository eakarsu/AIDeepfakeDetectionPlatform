const express = require('express');
const PDFDocument = require('pdfkit');
const fetch = require('node-fetch');
const { pool } = require('../db');
const authMiddleware = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/rateLimiter');
const { analyzeWithAI } = require('../services/openrouter');
const { parseAIJson } = require('../utils/parseAIJson');

const router = express.Router();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022';

const callAI = async (systemPrompt, userPrompt) => {
  if (!OPENROUTER_API_KEY) {
    const err = new Error('AI service unavailable: OPENROUTER_API_KEY is not configured');
    err.status = 503;
    throw err;
  }
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'AI Deepfake Detection Platform',
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });
  if (!response.ok) throw new Error(`OpenRouter error: ${response.status}`);
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices[0].message.content;
};

// POST /api/ai/batch-analyze
// Accepts { batch_scan_id }, fetches all items in the batch, runs AI on each, returns aggregate threat summary
router.post('/batch-analyze', authMiddleware, aiRateLimiter, async (req, res) => {
  try {
    const { batch_scan_id } = req.body;
    if (!batch_scan_id) return res.status(400).json({ error: 'batch_scan_id is required' });

    const batchResult = await pool.query('SELECT * FROM batch_scans WHERE id = $1', [batch_scan_id]);
    if (batchResult.rows.length === 0) return res.status(404).json({ error: 'Batch scan not found' });
    const batch = batchResult.rows[0];

    // Analyze the batch record itself using the existing AI service
    const batchAnalysis = await analyzeWithAI('batch_scans', batch);

    // Fetch related scan history items for this batch
    const historyResult = await pool.query(
      "SELECT * FROM scan_history WHERE description ILIKE $1 ORDER BY created_at DESC LIMIT 50",
      [`%${batch.batch_name || batch.title}%`]
    );
    const scanItems = historyResult.rows;

    // Build confidence distribution from any ai_result fields
    const confidenceDistribution = { low: 0, medium: 0, high: 0, critical: 0 };
    let analyzed = 0;
    for (const item of scanItems) {
      if (item.ai_result) {
        try {
          const parsed = typeof item.ai_result === 'string' ? JSON.parse(item.ai_result) : item.ai_result;
          const level = parsed?.analysis?.risk_level || 'low';
          if (confidenceDistribution[level] !== undefined) confidenceDistribution[level]++;
          analyzed++;
        } catch (_) {}
      }
    }

    const aggregatePrompt = `You are a deepfake threat analyst. Given this batch analysis and ${scanItems.length} associated scans (${analyzed} with AI results), provide a concise aggregate threat summary as JSON:
{
  "overall_threat_level": "low|medium|high|critical",
  "key_findings": ["finding1", "finding2"],
  "recommended_actions": ["action1", "action2"],
  "summary": "2-3 sentence executive summary"
}

Batch info: ${JSON.stringify(batch)}
Confidence distribution across scans: ${JSON.stringify(confidenceDistribution)}`;

    const aggregateRaw = await callAI(
      'You are an expert deepfake detection analyst. Respond with valid JSON only.',
      aggregatePrompt
    );

    const aggParse = parseAIJson(aggregateRaw);
    const aggregate = aggParse.success ? aggParse.data : { raw: aggregateRaw };

    res.json({
      batch_id: batch_scan_id,
      batch: batch,
      batch_analysis: batchAnalysis,
      scan_count: scanItems.length,
      confidence_distribution: confidenceDistribution,
      aggregate_threat_summary: aggregate,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/export-report
// Accepts { scan_id, scan_type }, generates PDF report with scan details, AI findings, confidence score, audit trail
router.post('/export-report', authMiddleware, aiRateLimiter, async (req, res) => {
  try {
    const { scan_id, scan_type } = req.body;
    if (!scan_id || !scan_type) return res.status(400).json({ error: 'scan_id and scan_type are required' });

    const tableMap = {
      image: 'image_scans',
      video: 'video_scans',
      audio: 'audio_scans',
      face_swap: 'face_swap_detections',
      gan: 'gan_detections',
      metadata: 'metadata_analyses',
      social_media: 'social_media_scans',
      election: 'election_verifications',
      threat: 'threat_intelligence',
    };

    const table = tableMap[scan_type];
    if (!table) return res.status(400).json({ error: `Unknown scan_type. Valid types: ${Object.keys(tableMap).join(', ')}` });

    const scanResult = await pool.query(`SELECT * FROM ${table} WHERE id = $1`, [scan_id]);
    if (scanResult.rows.length === 0) return res.status(404).json({ error: 'Scan not found' });
    const scan = scanResult.rows[0];

    // Fetch related audit log entries
    const auditResult = await pool.query(
      "SELECT * FROM audit_logs WHERE entity_id = $1 AND entity_type = $2 ORDER BY created_at DESC LIMIT 10",
      [scan_id, scan_type]
    );
    const auditEntries = auditResult.rows;

    let aiFindings = null;
    if (scan.ai_result) {
      try {
        aiFindings = typeof scan.ai_result === 'string' ? JSON.parse(scan.ai_result) : scan.ai_result;
      } catch (_) {}
    }

    // Generate PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="scan-report-${scan_id}.pdf"`);

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    // Title
    doc.fontSize(22).font('Helvetica-Bold').text('Deepfake Detection Report', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica').text(`Generated: ${new Date().toISOString()}`, { align: 'center' });
    doc.moveDown(1);

    // Scan Details
    doc.fontSize(16).font('Helvetica-Bold').text('Scan Details');
    doc.moveTo(50, doc.y).lineTo(560, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica');
    doc.text(`Scan ID: ${scan.id}`);
    doc.text(`Title: ${scan.title || 'N/A'}`);
    doc.text(`Status: ${scan.status || 'N/A'}`);
    doc.text(`Risk Level: ${scan.risk_level || 'N/A'}`);
    doc.text(`Confidence Score: ${scan.confidence_score != null ? scan.confidence_score + '%' : 'N/A'}`);
    doc.text(`Created: ${scan.created_at || 'N/A'}`);
    if (scan.file_name) doc.text(`File: ${scan.file_name}`);
    if (scan.description) doc.text(`Description: ${scan.description}`);
    doc.moveDown(1);

    // AI Findings
    doc.fontSize(16).font('Helvetica-Bold').text('AI Analysis Findings');
    doc.moveTo(50, doc.y).lineTo(560, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica');
    if (aiFindings && aiFindings.analysis) {
      const analysis = aiFindings.analysis;
      if (analysis.verdict) doc.text(`Verdict: ${analysis.verdict}`);
      if (analysis.summary) doc.text(`Summary: ${analysis.summary}`);
      if (Array.isArray(analysis.recommendations)) {
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold').text('Recommendations:');
        doc.font('Helvetica');
        analysis.recommendations.forEach(r => doc.text(`  • ${r}`));
      }
    } else {
      doc.text('No AI analysis available for this scan.');
    }
    doc.moveDown(1);

    // Audit Trail
    doc.fontSize(16).font('Helvetica-Bold').text('Audit Trail');
    doc.moveTo(50, doc.y).lineTo(560, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica');
    if (auditEntries.length > 0) {
      auditEntries.forEach(entry => {
        doc.text(`[${entry.created_at}] ${entry.action || ''} by ${entry.user_email || 'system'}`);
      });
    } else {
      doc.text('No audit trail entries found.');
    }

    doc.moveDown(1);
    doc.fontSize(9).fillColor('gray').text('Confidential - AI Deepfake Detection Platform', { align: 'center' });

    doc.end();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/watchlist-check
// Accepts { url or account_handle }, performs AI-driven authenticity assessment for social monitoring
router.post('/watchlist-check', authMiddleware, aiRateLimiter, async (req, res) => {
  try {
    const { url, account_handle } = req.body;
    if (!url && !account_handle) return res.status(400).json({ error: 'url or account_handle is required' });

    const target = url || account_handle;
    const targetType = url ? 'URL' : 'account handle';

    // Check if this target is already in social_media_scans
    const existingResult = await pool.query(
      "SELECT * FROM social_media_scans WHERE account_name ILIKE $1 OR description ILIKE $2 ORDER BY created_at DESC LIMIT 5",
      [target, `%${target}%`]
    );
    const existingScans = existingResult.rows;

    // Fetch threat intelligence matches
    const threatResult = await pool.query(
      "SELECT * FROM threat_intelligence WHERE indicators ILIKE $1 OR description ILIKE $2 ORDER BY severity DESC LIMIT 5",
      [`%${target}%`, `%${target}%`]
    );
    const threats = threatResult.rows;

    const prompt = `You are a deepfake and social media authenticity analyst. Assess the authenticity of the following ${targetType}: "${target}".

Existing scan records for this target: ${JSON.stringify(existingScans)}
Threat intelligence matches: ${JSON.stringify(threats)}

Provide your assessment as JSON:
{
  "target": "${target}",
  "target_type": "${targetType}",
  "authenticity_score": number 0-100,
  "risk_level": "low|medium|high|critical",
  "verdict": "AUTHENTIC|SUSPICIOUS|LIKELY_FAKE|CONFIRMED_MALICIOUS",
  "indicators": [{"type": "indicator type", "detail": "description", "severity": "low|medium|high"}],
  "historical_flags": number,
  "threat_matches": number,
  "recommendations": ["action1", "action2"],
  "summary": "2-3 sentence assessment"
}`;

    const rawResponse = await callAI(
      'You are an expert social media and deepfake detection analyst. Respond with valid JSON only.',
      prompt
    );

    const assessParse = parseAIJson(rawResponse);
    const assessment = assessParse.success ? assessParse.data : { raw: rawResponse, target, target_type: targetType };

    res.json({
      assessment,
      historical_scans: existingScans.length,
      threat_intel_matches: threats.length,
      checked_at: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/explain-detection
// Accepts a detection result payload and produces a human-readable narrative
// explanation of the verdict, indicators, and recommended next steps.
router.post('/explain-detection', authMiddleware, aiRateLimiter, async (req, res) => {
  try {
    const { detection, scan_id, scan_type, audience } = req.body || {};
    if (!detection && !scan_id) {
      return res.status(400).json({ error: 'detection payload or scan_id is required' });
    }

    let payload = detection;
    let scanRow = null;
    if (!payload && scan_id && scan_type) {
      const tableMap = {
        image: 'image_scans', video: 'video_scans', audio: 'audio_scans',
        face_swap: 'face_swap_detections', gan: 'gan_detections',
        metadata: 'metadata_analyses', social_media: 'social_media_scans',
        election: 'election_verifications', threat: 'threat_intelligence',
      };
      const table = tableMap[scan_type];
      if (!table) return res.status(400).json({ error: `Unknown scan_type. Valid: ${Object.keys(tableMap).join(', ')}` });
      const row = await pool.query(`SELECT * FROM ${table} WHERE id = $1`, [scan_id]);
      if (row.rows.length === 0) return res.status(404).json({ error: 'Scan not found' });
      scanRow = row.rows[0];
      try {
        payload = scanRow.ai_result
          ? (typeof scanRow.ai_result === 'string' ? JSON.parse(scanRow.ai_result) : scanRow.ai_result)
          : { title: scanRow.title, status: scanRow.status, risk_level: scanRow.risk_level };
      } catch (_) {
        payload = { raw: scanRow.ai_result };
      }
    }

    const aud = (audience || 'analyst').toString().toLowerCase();
    const systemPrompt = 'You are an expert deepfake detection analyst. Produce a clear, factual explanation of a detection result. Respond with valid JSON only — no markdown.';
    const userPrompt = `Explain this deepfake detection result for a ${aud} audience.

Detection payload:
${JSON.stringify(payload).slice(0, 8000)}

Return JSON:
{
  "headline": "1-sentence verdict",
  "plain_english_summary": "2-4 sentence narrative anyone can read",
  "key_signals": [{"signal": "...", "why_it_matters": "...", "weight": "low|medium|high"}],
  "limitations_and_caveats": ["..."],
  "next_steps": ["..."],
  "confidence_explanation": "explain how the confidence score was reached"
}`;

    const raw = await callAI(systemPrompt, userPrompt);
    const parsed = parseAIJson(raw);
    res.json({
      explanation: parsed.success ? parsed.data : { raw },
      audience: aud,
      scan_id: scan_id || null,
      scan_type: scan_type || null,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    if (err.status === 503) return res.status(503).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/generate-authenticity-score-narrative
// Turns metadata + score into a structured narrative card.
router.post('/generate-authenticity-score-narrative', authMiddleware, aiRateLimiter, async (req, res) => {
  try {
    const { authenticity_score, metadata, file_name, source, target } = req.body || {};
    if (authenticity_score == null && !metadata) {
      return res.status(400).json({ error: 'authenticity_score or metadata is required' });
    }

    const score = Number(authenticity_score);
    const scoreBand = isNaN(score) ? 'unknown' :
      score >= 80 ? 'high' : score >= 50 ? 'medium' : score >= 20 ? 'low' : 'critical';

    const systemPrompt = 'You are a deepfake authenticity scoring narrator. Translate raw scores and metadata into clear narratives. Respond with valid JSON only.';
    const userPrompt = `Generate an authenticity score narrative.

Authenticity score: ${isNaN(score) ? 'N/A' : score} / 100  (band: ${scoreBand})
File: ${file_name || 'N/A'}
Source: ${source || 'N/A'}
Target: ${target || 'N/A'}
Metadata: ${JSON.stringify(metadata || {}).slice(0, 6000)}

Return JSON:
{
  "score": ${isNaN(score) ? 'null' : score},
  "score_band": "high|medium|low|critical|unknown",
  "headline": "1-sentence summary",
  "narrative": "3-5 sentence written narrative explaining what the score means in this context",
  "supporting_factors": [{"factor": "...", "direction": "supports_authenticity|raises_doubt", "detail": "..."}],
  "watch_outs": ["..."],
  "recommended_audience_messaging": "how to communicate this to a non-technical reader"
}`;

    const raw = await callAI(systemPrompt, userPrompt);
    const parsed = parseAIJson(raw);
    res.json({
      narrative: parsed.success ? parsed.data : { raw, score, score_band: scoreBand },
      score,
      score_band: scoreBand,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    if (err.status === 503) return res.status(503).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
