const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { initDB } = require('./db');
const authRoutes = require('./routes/auth');
const featureRoutes = require('./routes/features');
const extraRoutes = require('./routes/extra');
const webhookRoutes = require('./routes/webhooks');
const aiNewRoutes = require('./routes/aiNew');

const app = express();
const PORT = process.env.BACKEND_PORT || 4000;

// Security headers
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

// CORS from env (comma-separated origins) - falls back to localhost dev
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5173')
  .split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: function (origin, cb) {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS: ' + origin));
  },
  credentials: true,
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path.startsWith('/api')) {
      console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    }
  });
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', featureRoutes);
app.use('/api', extraRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/ai', aiNewRoutes);





app.use('/api/ai', require('./routes/explainDetection'));
app.use('/api/ai', require('./routes/provenanceTrack'));
app.use('/api/ai', require('./routes/socialMonitor'));
app.use('/api/ai', require('./routes/mediaAuth'));

// Bespoke custom views (face heatmap + authenticity gauge)
app.use('/api/custom-views', require('./routes/customViews'));
// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const startServer = async () => {
  try {
    await initDB();
    console.log('Database initialized');

// // === Batch 02 Gaps & Frontend Mounts ===
app.use('/api/gap-missing-detect-deepfake-analyze-media-detect-face-swapping-d', require('./routes/gap_missing_detect_deepfake_analyze_media_detect_face_swapping_d'));

// // === Batch 02 Gaps & Frontend Mounts ===
app.use('/api/gap-no-media-processing-pipeline-wired-upload-stubs-only', require('./routes/gap_no_media_processing_pipeline_wired_upload_stubs_only'));

// // === Batch 02 Gaps & Frontend Mounts ===
app.use('/api/gap-no-detection-results-database-schema', require('./routes/gap_no_detection_results_database_schema'));

// // === Batch 02 Gaps & Frontend Mounts ===
app.use('/api/gap-limited-analytics-endpoint-coverage-beyond-plumbing', require('./routes/gap_limited_analytics_endpoint_coverage_beyond_plumbing'));

// // === Batch 02 Gaps & Frontend Mounts ===
app.use('/api/gap-limited-social-platform-integration-for-automated-detection', require('./routes/gap_limited_social_platform_integration_for_automated_detection'));

// // === Batch 02 Gaps & Frontend Mounts ===
app.use('/api/gap-no-calendar-integration', require('./routes/gap_no_calendar_integration'));

    app.listen(PORT, () => {
      console.log(`Backend server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

startServer();
