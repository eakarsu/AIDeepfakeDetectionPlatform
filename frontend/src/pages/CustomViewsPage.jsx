import React, { useEffect, useState, useCallback } from 'react';
import FaceHeatmap from '../components/FaceHeatmap.js';
import AuthenticityGauge from '../components/AuthenticityGauge.js';
import DetectionReportPDF from '../components/DetectionReportPDF.js';
import VideoUploadQueue from '../components/VideoUploadQueue.js';

/**
 * CustomViewsPage
 * --------------------------------------------------------------
 * Bespoke "Detection Analytics" view that fuses:
 *   1. Face region heatmap (SVG, per-region manipulation scores)
 *   2. Authenticity gauge   (radial 0..100% + verdict)
 *
 * Backed by:
 *   GET /api/custom-views/face-heatmap
 *   GET /api/custom-views/authenticity
 */
export default function CustomViewsPage() {
  const [heatmap, setHeatmap] = useState(null);
  const [authenticity, setAuthenticity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
      const [h, a] = await Promise.all([
        fetch('/api/custom-views/face-heatmap', { headers }).then(r => r.json()),
        fetch('/api/custom-views/authenticity',  { headers }).then(r => r.json()),
      ]);
      if (h?.error) throw new Error(h.error);
      if (a?.error) throw new Error(a.error);
      setHeatmap(h);
      setAuthenticity(a);
    } catch (e) {
      setError(e.message || 'Failed to load detection analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div data-testid="custom-views-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{
            fontSize: 28,
            fontWeight: 800,
            background: 'linear-gradient(90deg,#60a5fa,#a78bfa)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            margin: 0,
          }}>
            Detection Analytics
          </h1>
          <div style={{ color: '#94a3b8', marginTop: 4, fontSize: 13 }}>
            Bespoke deepfake forensics dashboard — facial region heatmap and overall authenticity gauge.
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          style={{
            padding: '8px 14px',
            background: 'linear-gradient(90deg,#3b82f6,#8b5cf6)',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 13,
            cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div style={{
          padding: 12,
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.4)',
          borderRadius: 8,
          color: '#fecaca',
          marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      {/* Authenticity Gauge */}
      <section
        data-testid="authenticity-gauge-section"
        style={{
          marginBottom: 28,
          padding: 16,
          background: 'rgba(17,24,39,0.6)',
          border: '1px solid rgba(148,163,184,0.2)',
          borderRadius: 16,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
            Authenticity Gauge
          </h2>
          {authenticity?.asset_id && (
            <div style={{ fontSize: 11, color: '#64748b' }}>
              asset {authenticity.asset_id} · model {authenticity.model_version}
            </div>
          )}
        </div>
        {loading && !authenticity ? (
          <div style={{ color: '#94a3b8', fontSize: 13 }}>Loading gauge…</div>
        ) : (
          <AuthenticityGauge data={authenticity} />
        )}
      </section>

      {/* Face Region Heatmap */}
      <section
        data-testid="face-heatmap-section"
        style={{
          padding: 16,
          background: 'rgba(17,24,39,0.6)',
          border: '1px solid rgba(148,163,184,0.2)',
          borderRadius: 16,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
            Face Region Heatmap
          </h2>
          {heatmap?.subject && (
            <div style={{ fontSize: 11, color: '#64748b' }}>
              subject {heatmap.subject} · model {heatmap.model_version}
            </div>
          )}
        </div>
        {loading && !heatmap ? (
          <div style={{ color: '#94a3b8', fontSize: 13 }}>Loading heatmap…</div>
        ) : (
          <FaceHeatmap data={heatmap} />
        )}
      </section>

      {/* Detection Report PDF */}
      <section
        data-testid="detection-report-section"
        style={{
          marginTop: 28,
          padding: 16,
          background: 'rgba(17,24,39,0.6)',
          border: '1px solid rgba(148,163,184,0.2)',
          borderRadius: 16,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
            Detection Report (PDF)
          </h2>
          <div style={{ fontSize: 11, color: '#64748b' }}>
            POST /api/custom-views/detection-report
          </div>
        </div>
        <DetectionReportPDF />
      </section>

      {/* Video Upload + Analysis Queue */}
      <section
        data-testid="video-upload-queue-section"
        style={{
          marginTop: 28,
          padding: 16,
          background: 'rgba(17,24,39,0.6)',
          border: '1px solid rgba(148,163,184,0.2)',
          borderRadius: 16,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
            Video Upload &amp; Analysis Queue
          </h2>
          <div style={{ fontSize: 11, color: '#64748b' }}>
            POST /api/custom-views/upload-video · GET /api/custom-views/queue
          </div>
        </div>
        <VideoUploadQueue />
      </section>
    </div>
  );
}
