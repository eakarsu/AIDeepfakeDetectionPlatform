const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

const initDB = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'analyst',
        organization VARCHAR(255),
        is_active BOOLEAN DEFAULT true,
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Image Scans
      CREATE TABLE IF NOT EXISTS image_scans (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        file_name VARCHAR(255),
        file_size VARCHAR(50),
        format VARCHAR(50),
        resolution VARCHAR(50),
        source_url TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        risk_level VARCHAR(50) DEFAULT 'unknown',
        confidence_score DECIMAL(5,2),
        ai_result JSONB,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Video Scans
      CREATE TABLE IF NOT EXISTS video_scans (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        file_name VARCHAR(255),
        file_size VARCHAR(50),
        format VARCHAR(50),
        duration VARCHAR(50),
        resolution VARCHAR(50),
        frame_count INTEGER,
        source_url TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        risk_level VARCHAR(50) DEFAULT 'unknown',
        confidence_score DECIMAL(5,2),
        ai_result JSONB,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Audio Scans
      CREATE TABLE IF NOT EXISTS audio_scans (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        file_name VARCHAR(255),
        file_size VARCHAR(50),
        format VARCHAR(50),
        duration VARCHAR(50),
        sample_rate VARCHAR(50),
        source_url TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        risk_level VARCHAR(50) DEFAULT 'unknown',
        confidence_score DECIMAL(5,2),
        ai_result JSONB,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Face Swap Detections
      CREATE TABLE IF NOT EXISTS face_swap_detections (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        source_image VARCHAR(255),
        target_image VARCHAR(255),
        swap_type VARCHAR(100),
        faces_detected INTEGER,
        source_url TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        risk_level VARCHAR(50) DEFAULT 'unknown',
        confidence_score DECIMAL(5,2),
        ai_result JSONB,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- GAN Detections
      CREATE TABLE IF NOT EXISTS gan_detections (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        file_name VARCHAR(255),
        gan_type VARCHAR(100),
        artifacts_found TEXT,
        source_url TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        risk_level VARCHAR(50) DEFAULT 'unknown',
        confidence_score DECIMAL(5,2),
        ai_result JSONB,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Metadata Analyses
      CREATE TABLE IF NOT EXISTS metadata_analyses (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        file_name VARCHAR(255),
        file_type VARCHAR(50),
        original_metadata JSONB,
        tampering_indicators TEXT,
        source_url TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        risk_level VARCHAR(50) DEFAULT 'unknown',
        confidence_score DECIMAL(5,2),
        ai_result JSONB,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Batch Scans
      CREATE TABLE IF NOT EXISTS batch_scans (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        batch_name VARCHAR(255),
        total_files INTEGER DEFAULT 0,
        completed_files INTEGER DEFAULT 0,
        flagged_files INTEGER DEFAULT 0,
        scan_type VARCHAR(100),
        source_url TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        risk_level VARCHAR(50) DEFAULT 'unknown',
        confidence_score DECIMAL(5,2),
        ai_result JSONB,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Realtime Monitors
      CREATE TABLE IF NOT EXISTS realtime_monitors (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        monitor_name VARCHAR(255),
        source_url TEXT,
        monitor_type VARCHAR(100),
        alert_threshold DECIMAL(5,2),
        is_active BOOLEAN DEFAULT true,
        last_alert TIMESTAMP,
        alerts_count INTEGER DEFAULT 0,
        status VARCHAR(50) DEFAULT 'active',
        risk_level VARCHAR(50) DEFAULT 'unknown',
        confidence_score DECIMAL(5,2),
        ai_result JSONB,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Election Verifications
      CREATE TABLE IF NOT EXISTS election_verifications (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        content_type VARCHAR(100),
        politician_name VARCHAR(255),
        party VARCHAR(100),
        content_url TEXT,
        source_url TEXT,
        verification_status VARCHAR(50) DEFAULT 'unverified',
        status VARCHAR(50) DEFAULT 'pending',
        risk_level VARCHAR(50) DEFAULT 'unknown',
        confidence_score DECIMAL(5,2),
        ai_result JSONB,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Social Media Scans
      CREATE TABLE IF NOT EXISTS social_media_scans (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        platform VARCHAR(100),
        account_name VARCHAR(255),
        post_url TEXT,
        content_type VARCHAR(100),
        followers_count INTEGER,
        engagement_rate DECIMAL(5,2),
        source_url TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        risk_level VARCHAR(50) DEFAULT 'unknown',
        confidence_score DECIMAL(5,2),
        ai_result JSONB,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- API Keys
      CREATE TABLE IF NOT EXISTS api_keys (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        key_name VARCHAR(255),
        api_key VARCHAR(255),
        permissions TEXT,
        rate_limit INTEGER DEFAULT 1000,
        requests_today INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        last_used TIMESTAMP,
        status VARCHAR(50) DEFAULT 'active',
        risk_level VARCHAR(50) DEFAULT 'low',
        confidence_score DECIMAL(5,2),
        ai_result JSONB,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Scan History
      CREATE TABLE IF NOT EXISTS scan_history (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        scan_type VARCHAR(100),
        file_name VARCHAR(255),
        result_summary TEXT,
        scan_duration VARCHAR(50),
        source_url TEXT,
        status VARCHAR(50) DEFAULT 'completed',
        risk_level VARCHAR(50) DEFAULT 'unknown',
        confidence_score DECIMAL(5,2),
        ai_result JSONB,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Threat Intelligence
      CREATE TABLE IF NOT EXISTS threat_intelligence (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        threat_type VARCHAR(100),
        severity VARCHAR(50),
        source VARCHAR(255),
        indicators TEXT,
        mitigation TEXT,
        affected_regions TEXT,
        source_url TEXT,
        status VARCHAR(50) DEFAULT 'active',
        risk_level VARCHAR(50) DEFAULT 'unknown',
        confidence_score DECIMAL(5,2),
        ai_result JSONB,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Audit Logs
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        action VARCHAR(100),
        entity_type VARCHAR(100),
        entity_id INTEGER,
        user_email VARCHAR(255),
        ip_address VARCHAR(50),
        details JSONB,
        source_url TEXT,
        status VARCHAR(50) DEFAULT 'logged',
        risk_level VARCHAR(50) DEFAULT 'low',
        confidence_score DECIMAL(5,2),
        ai_result JSONB,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Notifications
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL DEFAULT 'info',
        title VARCHAR(255) NOT NULL,
        message TEXT,
        link VARCHAR(500),
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- Bookmarks
      CREATE TABLE IF NOT EXISTS bookmarks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        feature_key VARCHAR(100) NOT NULL,
        item_id INTEGER NOT NULL,
        item_title VARCHAR(255),
        note TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, feature_key, item_id)
      );

      -- Comments
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        feature_key VARCHAR(100) NOT NULL,
        item_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Tags
      CREATE TABLE IF NOT EXISTS tags (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        color VARCHAR(7) DEFAULT '#3b82f6',
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- Item Tags (junction table)
      CREATE TABLE IF NOT EXISTS item_tags (
        id SERIAL PRIMARY KEY,
        tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
        feature_key VARCHAR(100) NOT NULL,
        item_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(tag_id, feature_key, item_id)
      );

      -- Reports
      CREATE TABLE IF NOT EXISTS reports (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        report_type VARCHAR(50) NOT NULL,
        feature_keys TEXT,
        filters JSONB,
        data JSONB,
        format VARCHAR(20) DEFAULT 'json',
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- File Uploads
      CREATE TABLE IF NOT EXISTS file_uploads (
        id SERIAL PRIMARY KEY,
        original_name VARCHAR(255) NOT NULL,
        stored_name VARCHAR(255) NOT NULL,
        mime_type VARCHAR(100),
        file_size INTEGER,
        feature_key VARCHAR(100),
        item_id INTEGER,
        uploaded_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- Activity Log
      CREATE TABLE IF NOT EXISTS activity_log (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        user_name VARCHAR(255),
        action VARCHAR(50) NOT NULL,
        entity_type VARCHAR(100),
        entity_id INTEGER,
        entity_title VARCHAR(255),
        details JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Database tables created successfully');
  } catch (err) {
    console.error('Error creating tables:', err.message);
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { pool, initDB };
