import React, { useMemo, useState } from 'react';

/**
 * DetectionReportPDF
 * --------------------------------------------------------------
 * Lets the analyst pick an analysis ID and download a forensic
 * PDF report generated server-side by:
 *   POST /api/custom-views/detection-report
 *
 * The picker offers a handful of mock analysis IDs (deterministic
 * names) and a free-text override so any ID can be exercised.
 */

const MOCK_ANALYSES = [
  { id: 'A-10248', file_name: 'press_conference_clip.mp4',     subject: 'subject_2031' },
  { id: 'A-10491', file_name: 'interview_segment_03.mov',      subject: 'subject_7714' },
  { id: 'A-10733', file_name: 'satellite_briefing_raw.mp4',    subject: 'subject_1822' },
  { id: 'A-10897', file_name: 'social_repost_lowres.mp4',      subject: 'subject_5503' },
  { id: 'A-11015', file_name: 'leaked_executive_call.webm',    subject: 'subject_9128' },
  { id: 'A-11203', file_name: 'campaign_ad_master_v4.mp4',     subject: 'subject_4476' },
];

export default function DetectionReportPDF() {
  const [selectedId, setSelectedId] = useState(MOCK_ANALYSES[0].id);
  const [customId, setCustomId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [lastDownload, setLastDownload] = useState(null);

  const effective = useMemo(() => {
    const custom = customId.trim();
    if (custom) {
      return { id: custom, file_name: 'custom_asset.mp4', subject: 'custom_subject' };
    }
    return MOCK_ANALYSES.find(a => a.id === selectedId) || MOCK_ANALYSES[0];
  }, [selectedId, customId]);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/custom-views/detection-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          analysis_id: effective.id,
          file_name: effective.file_name,
          subject: effective.subject,
        }),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try { const j = await res.json(); if (j?.error) msg = j.error; } catch (_) {}
        throw new Error(msg);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `detection-report-${effective.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setLastDownload({ id: effective.id, at: new Date().toISOString(), size: blob.size });
    } catch (e) {
      setError(e.message || 'Failed to generate report');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="detection-report-pdf" style={{ width: '100%' }}>
      <div style={{
        background: 'rgba(15,23,42,0.6)',
        border: '1px solid rgba(148,163,184,0.2)',
        borderRadius: 12,
        padding: 16,
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 240px', minWidth: 220 }}>
            <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
              Analysis ID
            </label>
            <select
              data-testid="report-analysis-select"
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
              disabled={!!customId.trim() || busy}
              style={{
                width: '100%',
                padding: '8px 10px',
                background: '#0f172a',
                color: '#e2e8f0',
                border: '1px solid rgba(148,163,184,0.3)',
                borderRadius: 8,
                fontSize: 13,
              }}
            >
              {MOCK_ANALYSES.map(a => (
                <option key={a.id} value={a.id}>
                  {a.id} — {a.file_name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ flex: '1 1 200px', minWidth: 180 }}>
            <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
              Or custom ID
            </label>
            <input
              data-testid="report-custom-id"
              type="text"
              value={customId}
              onChange={e => setCustomId(e.target.value)}
              placeholder="e.g. A-99001"
              disabled={busy}
              style={{
                width: '100%',
                padding: '8px 10px',
                background: '#0f172a',
                color: '#e2e8f0',
                border: '1px solid rgba(148,163,184,0.3)',
                borderRadius: 8,
                fontSize: 13,
              }}
            />
          </div>

          <button
            data-testid="generate-report-btn"
            onClick={generate}
            disabled={busy}
            style={{
              padding: '10px 18px',
              background: 'linear-gradient(90deg,#10b981,#06b6d4)',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 13,
              cursor: busy ? 'wait' : 'pointer',
              opacity: busy ? 0.7 : 1,
              minWidth: 170,
            }}
          >
            {busy ? 'Generating…' : 'Generate Report'}
          </button>
        </div>

        <div style={{ marginTop: 12, fontSize: 12, color: '#94a3b8' }}>
          Selected: <strong style={{ color: '#cbd5e1' }}>{effective.id}</strong>
          {' · '}file <strong style={{ color: '#cbd5e1' }}>{effective.file_name}</strong>
          {' · '}subject <strong style={{ color: '#cbd5e1' }}>{effective.subject}</strong>
        </div>

        {error && (
          <div style={{
            marginTop: 12,
            padding: 10,
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.4)',
            borderRadius: 8,
            color: '#fecaca',
            fontSize: 12,
          }}>
            {error}
          </div>
        )}

        {lastDownload && (
          <div data-testid="report-last-download" style={{
            marginTop: 12,
            padding: 10,
            background: 'rgba(16,185,129,0.08)',
            border: '1px solid rgba(16,185,129,0.35)',
            borderRadius: 8,
            color: '#a7f3d0',
            fontSize: 12,
          }}>
            Downloaded report for <strong>{lastDownload.id}</strong> ({Math.round(lastDownload.size / 1024)} KB) at {new Date(lastDownload.at).toLocaleTimeString()}.
          </div>
        )}

        <div style={{ marginTop: 14, fontSize: 11, color: '#64748b' }}>
          Report includes: file metadata · authenticity score · per-region findings · verdict · methodology.
        </div>
      </div>
    </div>
  );
}
