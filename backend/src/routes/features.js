const express = require('express');
const { pool } = require('../db');
const { analyzeWithAI } = require('../services/openrouter');
const authMiddleware = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/rateLimiter');
const { upload } = require('../middleware/upload');
const { fireWebhook } = require('./webhooks');

const router = express.Router();

// Feature configurations
const FEATURES = {
  'image-scans': { table: 'image_scans', name: 'Image Scans' },
  'video-scans': { table: 'video_scans', name: 'Video Scans' },
  'audio-scans': { table: 'audio_scans', name: 'Audio Scans' },
  'face-swap-detections': { table: 'face_swap_detections', name: 'Face Swap Detections' },
  'gan-detections': { table: 'gan_detections', name: 'GAN Detections' },
  'metadata-analyses': { table: 'metadata_analyses', name: 'Metadata Analyses' },
  'batch-scans': { table: 'batch_scans', name: 'Batch Scans' },
  'realtime-monitors': { table: 'realtime_monitors', name: 'Realtime Monitors' },
  'election-verifications': { table: 'election_verifications', name: 'Election Verifications' },
  'social-media-scans': { table: 'social_media_scans', name: 'Social Media Scans' },
  'api-keys': { table: 'api_keys', name: 'API Keys' },
  'scan-history': { table: 'scan_history', name: 'Scan History' },
  'threat-intelligence': { table: 'threat_intelligence', name: 'Threat Intelligence' },
  'audit-logs': { table: 'audit_logs', name: 'Audit Logs' },
};

// User management routes
router.get('/users', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, full_name, role, organization, is_active, last_login, created_at, updated_at FROM users ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/users/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, full_name, role, organization, is_active, last_login, created_at, updated_at FROM users WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/users/:id', authMiddleware, async (req, res) => {
  try {
    const { full_name, role, organization, is_active } = req.body;
    const result = await pool.query(
      'UPDATE users SET full_name = COALESCE($1, full_name), role = COALESCE($2, role), organization = COALESCE($3, organization), is_active = COALESCE($4, is_active), updated_at = NOW() WHERE id = $5 RETURNING id, email, full_name, role, organization, is_active',
      [full_name, role, organization, is_active, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/users/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/users', authMiddleware, async (req, res) => {
  try {
    const bcrypt = require('bcryptjs');
    const { email, password, full_name, role, organization } = req.body;
    const password_hash = await bcrypt.hash(password || 'password123', 10);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, full_name, role, organization) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, full_name, role, organization, is_active, created_at',
      [email, password_hash, full_name, role || 'analyst', organization || 'Default Org']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI analysis for users
router.post('/users/:id/analyze', authMiddleware, aiRateLimiter, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const item = result.rows[0];
    const aiResult = await analyzeWithAI('audit_logs', { ...item, title: item.full_name, description: `User account analysis for ${item.full_name} (${item.email}), role: ${item.role}, org: ${item.organization}` });
    res.json(aiResult);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Paginated list routes for scan-history, audit-logs, and threat-intelligence
const PAGINATED_ROUTES = ['scan-history', 'audit-logs', 'threat-intelligence'];
PAGINATED_ROUTES.forEach((route) => {
  const config = FEATURES[route];
  const { table } = config;
  router.get(`/${route}`, authMiddleware, async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
      const offset = (page - 1) * limit;
      const [dataResult, countResult] = await Promise.all([
        pool.query(`SELECT * FROM ${table} ORDER BY created_at DESC LIMIT $1 OFFSET $2`, [limit, offset]),
        pool.query(`SELECT COUNT(*) as total FROM ${table}`)
      ]);
      const total = parseInt(countResult.rows[0].total);
      res.json({
        data: dataResult.rows,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
});

// File upload routes for image/video/audio scans
const UPLOAD_ROUTES = {
  'image-scans': { table: 'image_scans', field: 'single' },
  'video-scans': { table: 'video_scans', field: 'single' },
  'audio-scans': { table: 'audio_scans', field: 'single' },
};

Object.entries(UPLOAD_ROUTES).forEach(([route, config]) => {
  const { table } = config;
  router.post(`/${route}/upload`, authMiddleware, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
      const { originalname, size, mimetype, filename, path: filePath } = req.file;
      const bodyFields = req.body || {};
      const title = bodyFields.title || originalname;
      const description = bodyFields.description || `Uploaded file: ${originalname}`;
      const result = await pool.query(
        `INSERT INTO ${table} (title, description, file_name, status)
         VALUES ($1, $2, $3, 'pending') RETURNING *`,
        [title, description, originalname]
      );
      const item = result.rows[0];
      // Merge file metadata for AI analysis
      const itemWithMeta = {
        ...item,
        file_name: originalname,
        file_size: size,
        mimetype,
        stored_filename: filename,
      };
      res.status(201).json({
        item: itemWithMeta,
        file_metadata: { originalname, size, mimetype, stored: filename }
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
});

// Generic CRUD + AI for all features
Object.entries(FEATURES).forEach(([route, config]) => {
  const { table } = config;

  // List all items
  router.get(`/${route}`, authMiddleware, async (req, res) => {
    try {
      const result = await pool.query(`SELECT * FROM ${table} ORDER BY created_at DESC`);
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get single item
  router.get(`/${route}/:id`, authMiddleware, async (req, res) => {
    try {
      const result = await pool.query(`SELECT * FROM ${table} WHERE id = $1`, [req.params.id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Item not found' });
      }
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Create item
  router.post(`/${route}`, authMiddleware, async (req, res) => {
    try {
      const fields = Object.keys(req.body).filter(k => k !== 'id' && k !== 'created_at' && k !== 'updated_at');
      const values = fields.map(f => req.body[f]);
      const placeholders = fields.map((_, i) => `$${i + 1}`);

      const result = await pool.query(
        `INSERT INTO ${table} (${fields.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
        values
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update item
  router.put(`/${route}/:id`, authMiddleware, async (req, res) => {
    try {
      const fields = Object.keys(req.body).filter(k => k !== 'id' && k !== 'created_at');
      const sets = fields.map((f, i) => `${f} = $${i + 1}`);
      const values = [...fields.map(f => req.body[f]), req.params.id];

      const result = await pool.query(
        `UPDATE ${table} SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`,
        values
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Item not found' });
      }
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete item
  router.delete(`/${route}/:id`, authMiddleware, async (req, res) => {
    try {
      const result = await pool.query(`DELETE FROM ${table} WHERE id = $1 RETURNING id`, [req.params.id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Item not found' });
      }
      res.json({ message: 'Item deleted successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // AI Analysis
  router.post(`/${route}/:id/analyze`, authMiddleware, aiRateLimiter, async (req, res) => {
    try {
      const result = await pool.query(`SELECT * FROM ${table} WHERE id = $1`, [req.params.id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Item not found' });
      }

      const item = result.rows[0];
      const aiResult = await analyzeWithAI(table, item);

      // Save AI result to the item
      if (aiResult.success) {
        const confidence = aiResult.analysis?.confidence_percentage || null;
        const riskLevel = aiResult.analysis?.risk_level || null;
        await pool.query(
          `UPDATE ${table} SET ai_result = $1, confidence_score = $2, risk_level = COALESCE($3, risk_level), status = 'analyzed', updated_at = NOW() WHERE id = $4`,
          [JSON.stringify(aiResult), confidence, riskLevel, req.params.id]
        );
        // Fire webhooks for high or critical risk detections
        if (riskLevel === 'critical' || riskLevel === 'high') {
          const eventType = riskLevel === 'critical' ? 'critical_detection' : 'high_risk';
          fireWebhook(req.user.id, eventType, {
            table,
            item_id: req.params.id,
            risk_level: riskLevel,
            confidence,
            verdict: aiResult.analysis?.verdict,
            summary: aiResult.analysis?.summary,
          }).catch(console.error);
        }
      }

      res.json(aiResult);
    } catch (err) {
      console.error('Analysis error:', err);
      res.status(500).json({ error: err.message });
    }
  });
});

// Dashboard stats
router.get('/dashboard/stats', authMiddleware, async (req, res) => {
  try {
    const stats = {};
    for (const [route, config] of Object.entries(FEATURES)) {
      const countResult = await pool.query(`SELECT COUNT(*) as total FROM ${config.table}`);
      const flaggedResult = await pool.query(`SELECT COUNT(*) as flagged FROM ${config.table} WHERE risk_level IN ('high', 'critical')`);
      stats[route] = {
        name: config.name,
        total: parseInt(countResult.rows[0].total),
        flagged: parseInt(flaggedResult.rows[0].flagged),
      };
    }
    // Add users count
    const userCount = await pool.query('SELECT COUNT(*) as total FROM users');
    stats['users'] = { name: 'User Management', total: parseInt(userCount.rows[0].total), flagged: 0 };

    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
