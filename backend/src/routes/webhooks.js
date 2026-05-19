const express = require('express');
const fetch = require('node-fetch');
const { pool } = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Ensure webhooks table exists
const ensureWebhooksTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS webhooks (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      events TEXT[] NOT NULL DEFAULT '{critical_detection,high_risk}',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      secret VARCHAR(255),
      description TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_webhooks_user_id ON webhooks(user_id);
  `);
};
ensureWebhooksTable().catch(console.error);

// POST /api/webhooks/configure - store webhook URL + events per user
router.post('/configure', authMiddleware, async (req, res) => {
  try {
    const { url, events, secret, description } = req.body;
    if (!url) return res.status(400).json({ error: 'url is required' });
    if (!url.startsWith('http')) return res.status(400).json({ error: 'url must be a valid HTTP/HTTPS URL' });

    const validEvents = ['critical_detection', 'high_risk'];
    const eventList = Array.isArray(events) && events.length > 0
      ? events.filter(e => validEvents.includes(e))
      : validEvents;

    const result = await pool.query(
      `INSERT INTO webhooks (user_id, url, events, secret, description)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, url, eventList, secret || null, description || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/webhooks - list user webhooks
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, url, events, is_active, description, created_at, updated_at FROM webhooks WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/webhooks/:id - delete webhook
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM webhooks WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Webhook not found' });
    res.json({ message: 'Webhook deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper: fire webhook for a given user and event
const fireWebhook = async (user_id, event_type, payload) => {
  try {
    const result = await pool.query(
      `SELECT * FROM webhooks WHERE user_id = $1 AND is_active = TRUE AND $2 = ANY(events)`,
      [user_id, event_type]
    );
    for (const webhook of result.rows) {
      try {
        await fetch(webhook.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Event-Type': event_type },
          body: JSON.stringify({ event: event_type, payload, fired_at: new Date().toISOString() }),
          timeout: 5000,
        });
      } catch (fetchErr) {
        console.error(`Webhook delivery failed for ${webhook.url}:`, fetchErr.message);
      }
    }
  } catch (err) {
    console.error('fireWebhook error:', err.message);
  }
};

module.exports = router;
module.exports.fireWebhook = fireWebhook;
