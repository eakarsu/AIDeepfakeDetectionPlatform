const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { pool } = require('./db');
const authMiddleware = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const featureRoutes = require('./routes/features');
const extraRoutes = require('./routes/extra');
const webhookRoutes = require('./routes/webhooks');
const aiNewRoutes = require('./routes/aiNew');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be configured with at least 32 characters');
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');

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
app.use('/api/governed-workflows', require('./routes/governedWorkflow'));





app.use('/api/ai', require('./routes/explainDetection'));
app.use('/api/ai', require('./routes/provenanceTrack'));
app.use('/api/ai', require('./routes/socialMonitor'));
app.use('/api/ai', require('./routes/mediaAuth'));

// ── Trust & Safety / Content Moderation Platform ─────────────────────────────
app.use('/api/ts/csam-hash-match',       require('./routes/tsFeat_csamHashMatch'));
app.use('/api/ts/policy-engine',         require('./routes/tsFeat_policyEngine'));
app.use('/api/ts/human-review-queue',    require('./routes/tsFeat_humanReviewQueue'));
app.use('/api/ts/appeals-console',       require('./routes/tsFeat_appealsConsole'));
app.use('/api/ts/region-rules',          require('./routes/tsFeat_regionRules'));
app.use('/api/ts/transparency-reports',  require('./routes/tsFeat_transparencyReports'));
app.use('/api/ts/creator-comms',         require('./routes/tsFeat_creatorComms'));
app.use('/api/ts/signal-sharing-gifct',  require('./routes/tsFeat_signalSharingGifct'));

// Bespoke custom views (face heatmap + authenticity gauge)
app.use('/api/custom-views', require('./routes/customViews'));
// Static file serving for uploads
app.use('/uploads', authMiddleware, express.static(path.join(__dirname, '../uploads'), {
  dotfiles: 'deny',
  fallthrough: false,
  immutable: false,
}));

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
    // Migrations are explicit; startup verifies connectivity only.
    await pool.query('SELECT 1');

    app.listen(PORT, () => {
      console.log(`Backend server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

startServer();
