const express = require('express');
const { pool } = require('../db');
const authMiddleware = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// File upload setup
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB limit

// Helper: log activity
const logActivity = async (userId, userName, action, entityType, entityId, entityTitle, details) => {
  try {
    await pool.query(
      'INSERT INTO activity_log (user_id, user_name, action, entity_type, entity_id, entity_title, details) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [userId, userName, action, entityType, entityId, entityTitle, details ? JSON.stringify(details) : null]
    );
  } catch (err) {
    console.error('Activity log error:', err.message);
  }
};

// ==================== PROFILE ====================

// Get profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, full_name, role, organization, is_active, last_login, created_at, updated_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { full_name, organization } = req.body;
    const result = await pool.query(
      'UPDATE users SET full_name = COALESCE($1, full_name), organization = COALESCE($2, organization), updated_at = NOW() WHERE id = $3 RETURNING id, email, full_name, role, organization',
      [full_name, organization, req.user.id]
    );
    await logActivity(req.user.id, req.user.full_name, 'update', 'profile', req.user.id, 'Profile updated', null);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Change password
router.put('/profile/password', authMiddleware, async (req, res) => {
  try {
    const bcrypt = require('bcryptjs');
    const { current_password, new_password } = req.body;

    const userResult = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const valid = await bcrypt.compare(current_password, userResult.rows[0].password_hash);
    if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });

    const newHash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newHash, req.user.id]);

    await logActivity(req.user.id, req.user.full_name, 'update', 'password', req.user.id, 'Password changed', null);
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== NOTIFICATIONS ====================

// Get notifications
router.get('/notifications', authMiddleware, async (req, res) => {
  try {
    const { limit = 50, unread_only } = req.query;
    let query = 'SELECT * FROM notifications WHERE user_id = $1';
    const params = [req.user.id];
    if (unread_only === 'true') {
      query += ' AND is_read = false';
    }
    query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1);
    params.push(parseInt(limit));
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get unread count
router.get('/notifications/unread-count', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false', [req.user.id]);
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark as read
router.put('/notifications/:id/read', authMiddleware, async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ message: 'Marked as read' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark all as read
router.put('/notifications/read-all', authMiddleware, async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET is_read = true WHERE user_id = $1', [req.user.id]);
    res.json({ message: 'All marked as read' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete notification
router.delete('/notifications/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM notifications WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ message: 'Notification deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create notification (internal/admin use)
router.post('/notifications', authMiddleware, async (req, res) => {
  try {
    const { user_id, type, title, message, link } = req.body;
    const targetUserId = user_id || req.user.id;
    const result = await pool.query(
      'INSERT INTO notifications (user_id, type, title, message, link) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [targetUserId, type || 'info', title, message, link]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== BOOKMARKS ====================

// Get user bookmarks
router.get('/bookmarks', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM bookmarks WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check if bookmarked
router.get('/bookmarks/check/:featureKey/:itemId', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id FROM bookmarks WHERE user_id = $1 AND feature_key = $2 AND item_id = $3',
      [req.user.id, req.params.featureKey, req.params.itemId]
    );
    res.json({ bookmarked: result.rows.length > 0, id: result.rows[0]?.id || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle bookmark
router.post('/bookmarks/toggle', authMiddleware, async (req, res) => {
  try {
    const { feature_key, item_id, item_title, note } = req.body;
    const existing = await pool.query(
      'SELECT id FROM bookmarks WHERE user_id = $1 AND feature_key = $2 AND item_id = $3',
      [req.user.id, feature_key, item_id]
    );
    if (existing.rows.length > 0) {
      await pool.query('DELETE FROM bookmarks WHERE id = $1', [existing.rows[0].id]);
      res.json({ bookmarked: false });
    } else {
      const result = await pool.query(
        'INSERT INTO bookmarks (user_id, feature_key, item_id, item_title, note) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [req.user.id, feature_key, item_id, item_title, note]
      );
      await logActivity(req.user.id, req.user.full_name, 'bookmark', feature_key, item_id, item_title, null);
      res.json({ bookmarked: true, bookmark: result.rows[0] });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete bookmark
router.delete('/bookmarks/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM bookmarks WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ message: 'Bookmark removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== COMMENTS ====================

// Get comments for an item
router.get('/comments/:featureKey/:itemId', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, u.full_name as user_name, u.role as user_role
       FROM comments c LEFT JOIN users u ON c.user_id = u.id
       WHERE c.feature_key = $1 AND c.item_id = $2
       ORDER BY c.created_at ASC`,
      [req.params.featureKey, req.params.itemId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add comment
router.post('/comments', authMiddleware, async (req, res) => {
  try {
    const { feature_key, item_id, content } = req.body;
    const result = await pool.query(
      'INSERT INTO comments (user_id, feature_key, item_id, content) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.user.id, feature_key, item_id, content]
    );
    const comment = result.rows[0];
    comment.user_name = req.user.full_name;
    comment.user_role = req.user.role;
    await logActivity(req.user.id, req.user.full_name, 'comment', feature_key, item_id, `Comment on item #${item_id}`, { content: content.substring(0, 100) });
    res.status(201).json(comment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update comment
router.put('/comments/:id', authMiddleware, async (req, res) => {
  try {
    const { content } = req.body;
    const result = await pool.query(
      'UPDATE comments SET content = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 RETURNING *',
      [content, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Comment not found or not yours' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete comment
router.delete('/comments/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM comments WHERE id = $1 AND user_id = $2 RETURNING id', [req.params.id, req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Comment not found or not yours' });
    res.json({ message: 'Comment deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get comment count for an item
router.get('/comments/count/:featureKey/:itemId', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM comments WHERE feature_key = $1 AND item_id = $2',
      [req.params.featureKey, req.params.itemId]
    );
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== TAGS ====================

// Get all tags
router.get('/tags', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tags ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create tag
router.post('/tags', authMiddleware, async (req, res) => {
  try {
    const { name, color } = req.body;
    const result = await pool.query(
      'INSERT INTO tags (name, color, created_by) VALUES ($1, $2, $3) RETURNING *',
      [name.toLowerCase().trim(), color || '#3b82f6', req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Tag already exists' });
    res.status(500).json({ error: err.message });
  }
});

// Delete tag
router.delete('/tags/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM tags WHERE id = $1', [req.params.id]);
    res.json({ message: 'Tag deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get tags for an item
router.get('/tags/:featureKey/:itemId', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.* FROM tags t
       INNER JOIN item_tags it ON t.id = it.tag_id
       WHERE it.feature_key = $1 AND it.item_id = $2
       ORDER BY t.name`,
      [req.params.featureKey, req.params.itemId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add tag to item
router.post('/tags/assign', authMiddleware, async (req, res) => {
  try {
    const { tag_id, feature_key, item_id } = req.body;
    await pool.query(
      'INSERT INTO item_tags (tag_id, feature_key, item_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [tag_id, feature_key, item_id]
    );
    res.json({ message: 'Tag assigned' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove tag from item
router.delete('/tags/assign/:featureKey/:itemId/:tagId', authMiddleware, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM item_tags WHERE tag_id = $1 AND feature_key = $2 AND item_id = $3',
      [req.params.tagId, req.params.featureKey, req.params.itemId]
    );
    res.json({ message: 'Tag removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== EXPORT ====================

// Feature table mapping
const FEATURE_TABLES = {
  'image-scans': 'image_scans',
  'video-scans': 'video_scans',
  'audio-scans': 'audio_scans',
  'face-swap-detections': 'face_swap_detections',
  'gan-detections': 'gan_detections',
  'metadata-analyses': 'metadata_analyses',
  'batch-scans': 'batch_scans',
  'realtime-monitors': 'realtime_monitors',
  'election-verifications': 'election_verifications',
  'social-media-scans': 'social_media_scans',
  'api-keys': 'api_keys',
  'scan-history': 'scan_history',
  'threat-intelligence': 'threat_intelligence',
  'audit-logs': 'audit_logs',
};

// Export to CSV
router.get('/export/:featureKey/csv', authMiddleware, async (req, res) => {
  try {
    const table = FEATURE_TABLES[req.params.featureKey];
    if (!table) return res.status(404).json({ error: 'Feature not found' });

    const result = await pool.query(`SELECT * FROM ${table} ORDER BY created_at DESC`);
    if (result.rows.length === 0) return res.status(404).json({ error: 'No data to export' });

    const columns = Object.keys(result.rows[0]).filter(k => k !== 'ai_result');
    const csvHeader = columns.join(',');
    const csvRows = result.rows.map(row =>
      columns.map(col => {
        let val = row[col];
        if (val === null || val === undefined) return '';
        val = String(val);
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          return '"' + val.replace(/"/g, '""') + '"';
        }
        return val;
      }).join(',')
    );

    const csv = csvHeader + '\n' + csvRows.join('\n');

    await logActivity(req.user.id, req.user.full_name, 'export', req.params.featureKey, null, `Exported ${req.params.featureKey} to CSV`, { rows: result.rows.length });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.featureKey}-export-${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export to JSON
router.get('/export/:featureKey/json', authMiddleware, async (req, res) => {
  try {
    const table = FEATURE_TABLES[req.params.featureKey];
    if (!table) return res.status(404).json({ error: 'Feature not found' });

    const result = await pool.query(`SELECT * FROM ${table} ORDER BY created_at DESC`);

    await logActivity(req.user.id, req.user.full_name, 'export', req.params.featureKey, null, `Exported ${req.params.featureKey} to JSON`, { rows: result.rows.length });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.featureKey}-export-${Date.now()}.json"`);
    res.json({ feature: req.params.featureKey, exported_at: new Date().toISOString(), count: result.rows.length, data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== ACTIVITY FEED ====================

router.get('/activity', authMiddleware, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const result = await pool.query(
      'SELECT * FROM activity_log ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [parseInt(limit), parseInt(offset)]
    );
    const countResult = await pool.query('SELECT COUNT(*) as total FROM activity_log');
    res.json({ items: result.rows, total: parseInt(countResult.rows[0].total) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== FILE UPLOADS ====================

router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { feature_key, item_id } = req.body;
    const result = await pool.query(
      'INSERT INTO file_uploads (original_name, stored_name, mime_type, file_size, feature_key, item_id, uploaded_by) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [req.file.originalname, req.file.filename, req.file.mimetype, req.file.size, feature_key, item_id, req.user.id]
    );

    await logActivity(req.user.id, req.user.full_name, 'upload', feature_key || 'file', null, req.file.originalname, { size: req.file.size, type: req.file.mimetype });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get uploads for an item
router.get('/uploads/:featureKey/:itemId', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM file_uploads WHERE feature_key = $1 AND item_id = $2 ORDER BY created_at DESC',
      [req.params.featureKey, req.params.itemId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all uploads for current user
router.get('/uploads', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM file_uploads WHERE uploaded_by = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete upload
router.delete('/uploads/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM file_uploads WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'File not found' });

    const filePath = path.join(uploadDir, result.rows[0].stored_name);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await pool.query('DELETE FROM file_uploads WHERE id = $1', [req.params.id]);
    res.json({ message: 'File deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== REPORTS ====================

router.get('/reports', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, title, description, report_type, feature_keys, format, created_by, created_at FROM reports ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/reports/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM reports WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Report not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/reports', authMiddleware, async (req, res) => {
  try {
    const { title, description, report_type, feature_keys, filters } = req.body;

    // Build report data based on type
    const reportData = {};
    const featureList = feature_keys ? feature_keys.split(',') : Object.keys(FEATURE_TABLES);

    for (const featureKey of featureList) {
      const table = FEATURE_TABLES[featureKey.trim()];
      if (!table) continue;

      let query = `SELECT * FROM ${table}`;
      const conditions = [];
      const params = [];

      if (filters?.status) {
        params.push(filters.status);
        conditions.push(`status = $${params.length}`);
      }
      if (filters?.risk_level) {
        params.push(filters.risk_level);
        conditions.push(`risk_level = $${params.length}`);
      }
      if (filters?.date_from) {
        params.push(filters.date_from);
        conditions.push(`created_at >= $${params.length}`);
      }
      if (filters?.date_to) {
        params.push(filters.date_to);
        conditions.push(`created_at <= $${params.length}`);
      }

      if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
      query += ' ORDER BY created_at DESC';

      const result = await pool.query(query, params);
      reportData[featureKey.trim()] = {
        total: result.rows.length,
        items: result.rows,
        risk_breakdown: {
          critical: result.rows.filter(r => r.risk_level === 'critical').length,
          high: result.rows.filter(r => r.risk_level === 'high').length,
          medium: result.rows.filter(r => r.risk_level === 'medium').length,
          low: result.rows.filter(r => r.risk_level === 'low').length,
        },
        status_breakdown: result.rows.reduce((acc, r) => {
          acc[r.status || 'unknown'] = (acc[r.status || 'unknown'] || 0) + 1;
          return acc;
        }, {}),
      };
    }

    const result = await pool.query(
      'INSERT INTO reports (title, description, report_type, feature_keys, filters, data, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [title, description, report_type, feature_keys || Object.keys(FEATURE_TABLES).join(','), filters ? JSON.stringify(filters) : null, JSON.stringify(reportData), req.user.id]
    );

    await logActivity(req.user.id, req.user.full_name, 'create', 'report', result.rows[0].id, title, null);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/reports/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM reports WHERE id = $1', [req.params.id]);
    res.json({ message: 'Report deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== BULK OPERATIONS ====================

router.post('/bulk/:featureKey/delete', authMiddleware, async (req, res) => {
  try {
    const table = FEATURE_TABLES[req.params.featureKey];
    if (!table) return res.status(404).json({ error: 'Feature not found' });

    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No IDs provided' });
    }

    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const result = await pool.query(`DELETE FROM ${table} WHERE id IN (${placeholders}) RETURNING id`, ids);

    await logActivity(req.user.id, req.user.full_name, 'bulk_delete', req.params.featureKey, null, `Bulk deleted ${result.rows.length} items`, { ids });
    res.json({ deleted: result.rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/bulk/:featureKey/status', authMiddleware, async (req, res) => {
  try {
    const table = FEATURE_TABLES[req.params.featureKey];
    if (!table) return res.status(404).json({ error: 'Feature not found' });

    const { ids, status } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No IDs provided' });
    }

    const placeholders = ids.map((_, i) => `$${i + 2}`).join(',');
    const result = await pool.query(
      `UPDATE ${table} SET status = $1, updated_at = NOW() WHERE id IN (${placeholders}) RETURNING id`,
      [status, ...ids]
    );

    await logActivity(req.user.id, req.user.full_name, 'bulk_update', req.params.featureKey, null, `Bulk status update to ${status}`, { ids, status });
    res.json({ updated: result.rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/bulk/:featureKey/risk', authMiddleware, async (req, res) => {
  try {
    const table = FEATURE_TABLES[req.params.featureKey];
    if (!table) return res.status(404).json({ error: 'Feature not found' });

    const { ids, risk_level } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No IDs provided' });
    }

    const placeholders = ids.map((_, i) => `$${i + 2}`).join(',');
    const result = await pool.query(
      `UPDATE ${table} SET risk_level = $1, updated_at = NOW() WHERE id IN (${placeholders}) RETURNING id`,
      [risk_level, ...ids]
    );

    await logActivity(req.user.id, req.user.full_name, 'bulk_update', req.params.featureKey, null, `Bulk risk update to ${risk_level}`, { ids, risk_level });
    res.json({ updated: result.rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== ANALYTICS ====================

router.get('/analytics/overview', authMiddleware, async (req, res) => {
  try {
    const analytics = {};

    // Overall stats per feature
    for (const [featureKey, table] of Object.entries(FEATURE_TABLES)) {
      const totalResult = await pool.query(`SELECT COUNT(*) as total FROM ${table}`);
      const riskResult = await pool.query(
        `SELECT risk_level, COUNT(*) as count FROM ${table} GROUP BY risk_level`
      );
      const statusResult = await pool.query(
        `SELECT status, COUNT(*) as count FROM ${table} GROUP BY status`
      );
      const recentResult = await pool.query(
        `SELECT COUNT(*) as count FROM ${table} WHERE created_at >= NOW() - INTERVAL '7 days'`
      );

      analytics[featureKey] = {
        total: parseInt(totalResult.rows[0].total),
        recent_7d: parseInt(recentResult.rows[0].count),
        risk_breakdown: riskResult.rows.reduce((acc, r) => { acc[r.risk_level || 'unknown'] = parseInt(r.count); return acc; }, {}),
        status_breakdown: statusResult.rows.reduce((acc, r) => { acc[r.status || 'unknown'] = parseInt(r.count); return acc; }, {}),
      };
    }

    // User stats
    const userCount = await pool.query('SELECT COUNT(*) as total FROM users');
    const activeUsers = await pool.query("SELECT COUNT(*) as total FROM users WHERE last_login >= NOW() - INTERVAL '7 days'");
    analytics.users = {
      total: parseInt(userCount.rows[0].total),
      active_7d: parseInt(activeUsers.rows[0].total),
    };

    // Activity stats
    const activityCount = await pool.query('SELECT COUNT(*) as total FROM activity_log');
    const recentActivity = await pool.query(
      "SELECT action, COUNT(*) as count FROM activity_log WHERE created_at >= NOW() - INTERVAL '7 days' GROUP BY action"
    );
    analytics.activity = {
      total: parseInt(activityCount.rows[0].total),
      recent_actions: recentActivity.rows.reduce((acc, r) => { acc[r.action] = parseInt(r.count); return acc; }, {}),
    };

    // Timeline data (last 30 days)
    const timelineResult = await pool.query(`
      SELECT date_trunc('day', created_at) as day, COUNT(*) as count
      FROM (
        ${Object.values(FEATURE_TABLES).map(t => `SELECT created_at FROM ${t}`).join(' UNION ALL ')}
      ) combined
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY day ORDER BY day
    `);
    analytics.timeline = timelineResult.rows.map(r => ({
      date: r.day,
      count: parseInt(r.count)
    }));

    res.json(analytics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== ADVANCED SEARCH ====================

router.get('/search', authMiddleware, async (req, res) => {
  try {
    const { q, feature_key, status, risk_level, date_from, date_to, limit = 50 } = req.query;

    if (!q && !feature_key) {
      return res.status(400).json({ error: 'Search query or feature_key required' });
    }

    const results = [];
    const featuresToSearch = feature_key ? { [feature_key]: FEATURE_TABLES[feature_key] } : FEATURE_TABLES;

    for (const [fKey, table] of Object.entries(featuresToSearch)) {
      if (!table) continue;

      const conditions = [];
      const params = [];

      if (q) {
        params.push(`%${q}%`);
        conditions.push(`(title ILIKE $${params.length} OR COALESCE(description, '') ILIKE $${params.length})`);
      }
      if (status) {
        params.push(status);
        conditions.push(`status = $${params.length}`);
      }
      if (risk_level) {
        params.push(risk_level);
        conditions.push(`risk_level = $${params.length}`);
      }
      if (date_from) {
        params.push(date_from);
        conditions.push(`created_at >= $${params.length}`);
      }
      if (date_to) {
        params.push(date_to);
        conditions.push(`created_at <= $${params.length}`);
      }

      let query = `SELECT id, title, description, status, risk_level, confidence_score, created_at FROM ${table}`;
      if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
      query += ` ORDER BY created_at DESC LIMIT ${parseInt(limit)}`;

      try {
        const result = await pool.query(query, params);
        result.rows.forEach(row => {
          results.push({ ...row, feature_key: fKey });
        });
      } catch (e) {
        // Skip tables that might have different schemas
      }
    }

    results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(results.slice(0, parseInt(limit)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== COMPARISON ====================

router.post('/compare', authMiddleware, async (req, res) => {
  try {
    const { items } = req.body; // Array of { feature_key, item_id }
    if (!items || items.length < 2) {
      return res.status(400).json({ error: 'Need at least 2 items to compare' });
    }

    const results = [];
    for (const item of items) {
      const table = FEATURE_TABLES[item.feature_key];
      if (!table) continue;
      const result = await pool.query(`SELECT * FROM ${table} WHERE id = $1`, [item.item_id]);
      if (result.rows.length > 0) {
        results.push({ feature_key: item.feature_key, ...result.rows[0] });
      }
    }

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
