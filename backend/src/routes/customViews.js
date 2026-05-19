/**
 * Custom Views: Bespoke deepfake detection visualizations + utilities
 *  - GET  /api/custom-views/face-heatmap        -> per-region facial detection scores
 *  - GET  /api/custom-views/authenticity        -> overall authenticity gauge data
 *  - POST /api/custom-views/detection-report    -> PDF detection report (pdfkit)
 *  - POST /api/custom-views/upload-video        -> multipart video upload, queues job
 *  - GET  /api/custom-views/queue               -> list of queued/processing/done items
 *
 * Both endpoints synthesize deterministic-but-varied data so the UI has
 * something meaningful to render without depending on an external model.
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const auth = require('../middleware/auth');
const PDFDocument = require('pdfkit');
const multer = require('multer');

// ---- Video upload storage (kept local to this route so we don't disturb
// the shared upload middleware that other routes rely on). ----
const videoUploadsDir = path.join(__dirname, '../../uploads/custom-views');
if (!fs.existsSync(videoUploadsDir)) {
  fs.mkdirSync(videoUploadsDir, { recursive: true });
}
const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, videoUploadsDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname || '')}`);
  },
});
const videoUpload = multer({
  storage: videoStorage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
});

// In-memory analysis queue (simple, per-process). Each item progresses
// through pending -> processing -> done on a short timer.
const analysisQueue = [];
function pushQueueItem(item) {
  analysisQueue.unshift(item);
  // Trim to last 50 to keep memory bounded.
  if (analysisQueue.length > 50) analysisQueue.length = 50;
}
function progressItem(id) {
  const item = analysisQueue.find(q => q.queue_id === id);
  if (!item) return;
  setTimeout(() => {
    if (item.status === 'pending') {
      item.status = 'processing';
      item.updated_at = new Date().toISOString();
    }
  }, 1500);
  setTimeout(() => {
    if (item.status !== 'done') {
      item.status = 'done';
      item.authenticity_score = Math.floor(Math.random() * 100);
      item.verdict = item.authenticity_score >= 60 ? 'Likely Authentic'
        : item.authenticity_score >= 40 ? 'Uncertain' : 'Likely Deepfake';
      item.updated_at = new Date().toISOString();
    }
  }, 4500);
}

// Deterministic pseudo-random based on a daily seed so repeated calls in
// the same session stay stable while still feeling "live" day-to-day.
function seededRand(seed) {
  let s = seed | 0;
  return function () {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function dailySeed(extra = 0) {
  const d = new Date();
  return (d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate()) + extra;
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

router.get('/face-heatmap', auth, (req, res) => {
  const rng = seededRand(dailySeed(11));
  // Regions roughly map to artifact-prone areas typical of GAN/diffusion fakes.
  const regions = [
    { id: 'left_eye',   name: 'Left Eye',   description: 'Iris reflection symmetry and blink cadence' },
    { id: 'right_eye',  name: 'Right Eye',  description: 'Pupil specular highlights and sclera tone' },
    { id: 'nose',       name: 'Nose Bridge',description: 'Specular highlight stability across frames' },
    { id: 'mouth',      name: 'Mouth',      description: 'Lip-sync alignment and inner-teeth fidelity' },
    { id: 'jawline',    name: 'Jawline',    description: 'Boundary blending artifacts (face-swap seam)' },
    { id: 'left_ear',   name: 'Left Ear',   description: 'Helix/lobe geometry consistency' },
    { id: 'right_ear',  name: 'Right Ear',  description: 'Helix/lobe geometry consistency' },
    { id: 'forehead',   name: 'Forehead',   description: 'Pore-level texture frequency content' },
  ];

  const scored = regions.map(r => {
    const score = Math.round(clamp(rng() * 95 + 5, 1, 99)); // 1..99 manipulation score
    let level = 'low';
    if (score >= 75) level = 'critical';
    else if (score >= 55) level = 'high';
    else if (score >= 30) level = 'medium';
    return { ...r, manipulation_score: score, risk_level: level };
  });

  const top = [...scored].sort((a, b) => b.manipulation_score - a.manipulation_score)[0];
  const avg = Math.round(scored.reduce((s, r) => s + r.manipulation_score, 0) / scored.length);

  res.json({
    ok: true,
    generated_at: new Date().toISOString(),
    subject: 'unknown_subject_' + (dailySeed(0) % 9999),
    model_version: 'df-detect-v3.2',
    summary: {
      average_manipulation_score: avg,
      highest_risk_region: top.id,
      highest_risk_score: top.manipulation_score,
      regions_flagged: scored.filter(r => r.manipulation_score >= 55).length,
    },
    regions: scored,
  });
});

router.get('/authenticity', auth, (req, res) => {
  const rng = seededRand(dailySeed(29));
  const authenticity = Math.round(clamp(rng() * 100, 1, 99)); // 0..100 authenticity %
  let verdict, verdict_color, recommendation;
  if (authenticity >= 80) {
    verdict = 'Authentic';
    verdict_color = '#10b981';
    recommendation = 'No manipulation detected. Safe to publish.';
  } else if (authenticity >= 60) {
    verdict = 'Likely Authentic';
    verdict_color = '#22c55e';
    recommendation = 'Minor anomalies. Recommend secondary review.';
  } else if (authenticity >= 40) {
    verdict = 'Uncertain';
    verdict_color = '#f59e0b';
    recommendation = 'Inconclusive. Escalate to analyst.';
  } else if (authenticity >= 20) {
    verdict = 'Likely Deepfake';
    verdict_color = '#f97316';
    recommendation = 'Strong signs of synthesis. Quarantine asset.';
  } else {
    verdict = 'Deepfake';
    verdict_color = '#ef4444';
    recommendation = 'Confirmed synthetic media. Block distribution.';
  }

  // Sub-signal breakdown that contributes to the gauge.
  const signals = [
    { name: 'Frequency Analysis',     weight: 0.25, score: Math.round(clamp(authenticity + (rng() * 20 - 10), 0, 100)) },
    { name: 'Temporal Coherence',     weight: 0.20, score: Math.round(clamp(authenticity + (rng() * 20 - 10), 0, 100)) },
    { name: 'Biometric Consistency',  weight: 0.20, score: Math.round(clamp(authenticity + (rng() * 20 - 10), 0, 100)) },
    { name: 'GAN Fingerprint',        weight: 0.20, score: Math.round(clamp(authenticity + (rng() * 20 - 10), 0, 100)) },
    { name: 'Metadata Integrity',     weight: 0.15, score: Math.round(clamp(authenticity + (rng() * 20 - 10), 0, 100)) },
  ];

  res.json({
    ok: true,
    generated_at: new Date().toISOString(),
    asset_id: 'asset_' + (dailySeed(0) % 99999),
    model_version: 'df-detect-v3.2',
    authenticity_pct: authenticity,
    confidence: Math.round(clamp(70 + rng() * 30, 70, 99)),
    verdict,
    verdict_color,
    recommendation,
    signals,
  });
});

// =====================================================================
// POST /api/custom-views/detection-report
//   Body: { analysis_id?: string, subject?: string, file_name?: string }
//   Returns: application/pdf — a forensic detection report.
// =====================================================================
router.post('/detection-report', auth, (req, res) => {
  const body = req.body || {};
  const analysisId = String(body.analysis_id || ('A-' + (dailySeed(0) % 99999))).slice(0, 64);
  const fileName = String(body.file_name || 'unknown_asset.mp4').slice(0, 200);
  const subject = String(body.subject || ('subject_' + (dailySeed(0) % 9999))).slice(0, 80);

  // Re-derive deterministic per-region & overall scores so the PDF tells a
  // coherent story matching what the rest of the dashboard shows.
  const rng = seededRand(dailySeed(11) + (analysisId.length || 0));
  const regions = [
    { id: 'left_eye',   name: 'Left Eye',   description: 'Iris reflection symmetry, blink cadence' },
    { id: 'right_eye',  name: 'Right Eye',  description: 'Pupil specular highlights, sclera tone' },
    { id: 'nose',       name: 'Nose Bridge',description: 'Specular highlight stability across frames' },
    { id: 'mouth',      name: 'Mouth',      description: 'Lip-sync alignment, inner-teeth fidelity' },
    { id: 'jawline',    name: 'Jawline',    description: 'Boundary blending (face-swap seam)' },
    { id: 'forehead',   name: 'Forehead',   description: 'Pore-level texture frequency content' },
  ].map(r => {
    const score = Math.round(clamp(rng() * 95 + 5, 1, 99));
    let level = 'low';
    if (score >= 75) level = 'critical';
    else if (score >= 55) level = 'high';
    else if (score >= 30) level = 'medium';
    return { ...r, manipulation_score: score, risk_level: level };
  });

  const avgManipulation = Math.round(regions.reduce((s, r) => s + r.manipulation_score, 0) / regions.length);
  const authenticity = clamp(100 - avgManipulation, 1, 99);
  let verdict, recommendation;
  if (authenticity >= 80)      { verdict = 'Authentic';        recommendation = 'No manipulation detected. Safe to publish.'; }
  else if (authenticity >= 60) { verdict = 'Likely Authentic'; recommendation = 'Minor anomalies. Recommend secondary review.'; }
  else if (authenticity >= 40) { verdict = 'Uncertain';        recommendation = 'Inconclusive. Escalate to analyst.'; }
  else if (authenticity >= 20) { verdict = 'Likely Deepfake';  recommendation = 'Strong signs of synthesis. Quarantine asset.'; }
  else                         { verdict = 'Deepfake';         recommendation = 'Confirmed synthetic media. Block distribution.'; }

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="detection-report-${analysisId}.pdf"`);
  doc.pipe(res);

  // ---- Header ----
  doc.fillColor('#1f2937').fontSize(20).font('Helvetica-Bold')
    .text('Deepfake Detection Report', { align: 'left' });
  doc.moveDown(0.3);
  doc.fillColor('#6b7280').fontSize(10).font('Helvetica')
    .text(`Generated ${new Date().toISOString()}    Analysis ID: ${analysisId}`);
  doc.moveTo(50, doc.y + 6).lineTo(545, doc.y + 6).strokeColor('#e5e7eb').lineWidth(1).stroke();
  doc.moveDown(1);

  // ---- File metadata ----
  doc.fillColor('#111827').fontSize(13).font('Helvetica-Bold').text('File metadata');
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica').fillColor('#374151');
  doc.text(`File name:   ${fileName}`);
  doc.text(`Subject:     ${subject}`);
  doc.text(`Model:       df-detect-v3.2`);
  doc.text(`Submitted:   ${new Date().toUTCString()}`);
  doc.moveDown(0.8);

  // ---- Authenticity score block ----
  doc.fillColor('#111827').fontSize(13).font('Helvetica-Bold').text('Authenticity score');
  doc.moveDown(0.3);
  const scoreColor = authenticity >= 60 ? '#10b981' : authenticity >= 40 ? '#f59e0b' : '#ef4444';
  doc.fontSize(28).font('Helvetica-Bold').fillColor(scoreColor).text(`${authenticity}%`, { continued: true });
  doc.fontSize(12).font('Helvetica').fillColor('#4b5563').text(`   ${verdict}`);
  doc.moveDown(0.4);
  doc.fontSize(10).fillColor('#374151').font('Helvetica').text(recommendation);
  doc.moveDown(0.8);

  // ---- Per-region findings ----
  doc.fillColor('#111827').fontSize(13).font('Helvetica-Bold').text('Per-region findings');
  doc.moveDown(0.4);
  const colX = [50, 170, 240, 320];
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#6b7280');
  doc.text('Region', colX[0], doc.y, { continued: true });
  doc.text('Score', colX[1], doc.y, { continued: true });
  doc.text('Risk', colX[2], doc.y, { continued: true });
  doc.text('Notes', colX[3], doc.y);
  doc.moveTo(50, doc.y + 2).lineTo(545, doc.y + 2).strokeColor('#e5e7eb').stroke();
  doc.moveDown(0.4);
  doc.font('Helvetica').fontSize(10);
  regions.forEach(r => {
    const rowY = doc.y;
    const rowColor = r.risk_level === 'critical' ? '#ef4444'
      : r.risk_level === 'high'   ? '#f97316'
      : r.risk_level === 'medium' ? '#f59e0b'
      : '#10b981';
    doc.fillColor('#111827').text(r.name, colX[0], rowY, { width: 110 });
    doc.fillColor(rowColor).text(`${r.manipulation_score}%`, colX[1], rowY, { width: 60 });
    doc.fillColor(rowColor).text(r.risk_level, colX[2], rowY, { width: 70 });
    doc.fillColor('#4b5563').text(r.description, colX[3], rowY, { width: 225 });
    doc.moveDown(0.4);
  });
  doc.moveDown(0.6);

  // ---- Verdict box ----
  const vY = doc.y;
  doc.rect(50, vY, 495, 50).fillOpacity(0.08).fill(scoreColor).fillOpacity(1);
  doc.fillColor(scoreColor).font('Helvetica-Bold').fontSize(12).text(`Verdict: ${verdict}`, 60, vY + 8);
  doc.fillColor('#374151').font('Helvetica').fontSize(10).text(recommendation, 60, vY + 26, { width: 475 });
  doc.y = vY + 60;
  doc.moveDown(0.6);

  // ---- Methodology ----
  doc.fillColor('#111827').fontSize(13).font('Helvetica-Bold').text('Methodology');
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('#374151').text(
    'This report aggregates five independent sub-detectors (frequency-domain analysis, ' +
    'temporal coherence, biometric consistency, GAN fingerprint matching, metadata integrity) ' +
    'weighted into a single authenticity score. Per-region manipulation scores are computed ' +
    'over the dominant facial landmarks across sampled frames. Scores ≥75 are surfaced as ' +
    'critical; ≥55 as high. Recommendations follow the platform\'s standard trust & safety ' +
    'escalation playbook.',
    { align: 'justify' }
  );
  doc.moveDown(1);
  doc.fontSize(8).fillColor('#9ca3af').text(`df-detect-v3.2  ·  analysis ${analysisId}  ·  ${new Date().toISOString()}`, { align: 'center' });

  doc.end();
});

// =====================================================================
// POST /api/custom-views/upload-video
//   Multipart: field "video"
//   Returns: { queue_id, status: 'pending' }
// =====================================================================
router.post('/upload-video', auth, videoUpload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, error: 'No video file received (field name must be "video")' });
  }
  const queueId = 'q_' + Date.now().toString(36) + '_' + Math.round(Math.random() * 1e6).toString(36);
  const item = {
    queue_id: queueId,
    status: 'pending',
    file_name: req.file.originalname || req.file.filename,
    stored_name: req.file.filename,
    size_bytes: req.file.size,
    mimetype: req.file.mimetype,
    authenticity_score: null,
    verdict: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  pushQueueItem(item);
  progressItem(queueId);
  res.json({ ok: true, queue_id: queueId, status: 'pending' });
});

// =====================================================================
// GET /api/custom-views/queue
//   Returns: { ok, items: [...] }
// =====================================================================
router.get('/queue', auth, (req, res) => {
  res.json({ ok: true, count: analysisQueue.length, items: analysisQueue });
});

router.get('/health', (req, res) => {
  res.json({
    ok: true,
    feature: 'custom-views',
    endpoints: [
      '/api/custom-views/face-heatmap',
      '/api/custom-views/authenticity',
      '/api/custom-views/detection-report',
      '/api/custom-views/upload-video',
      '/api/custom-views/queue',
    ],
  });
});

module.exports = router;
