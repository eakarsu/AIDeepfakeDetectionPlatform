import React from 'react';

/**
 * FaceHeatmap
 * --------------------------------------------------------------
 * Renders an SVG of a generic, stylised human face. Each facial
 * region (eyes, nose, mouth, jawline, ears, forehead) is colored
 * by the manipulation score returned from
 *   GET /api/custom-views/face-heatmap
 *
 * Props:
 *   data: {
 *     regions: [{ id, name, manipulation_score, risk_level, description }],
 *     summary: { ... }
 *   }
 */

function scoreToColor(score) {
  // 0 (green / authentic) -> 100 (red / manipulated)
  const s = Math.max(0, Math.min(100, Number(score) || 0));
  if (s < 30) return '#10b981';
  if (s < 55) return '#facc15';
  if (s < 75) return '#f97316';
  return '#ef4444';
}

function regionFill(regions, id) {
  const r = regions?.find(x => x.id === id);
  return r ? scoreToColor(r.manipulation_score) : '#1f2937';
}

function regionOpacity(regions, id) {
  const r = regions?.find(x => x.id === id);
  if (!r) return 0.25;
  return 0.35 + (Math.min(100, r.manipulation_score) / 100) * 0.55;
}

export default function FaceHeatmap({ data }) {
  const regions = data?.regions || [];
  const summary = data?.summary || {};

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* SVG face */}
        <div style={{
          flex: '0 0 360px',
          background: 'linear-gradient(180deg, #0b1220 0%, #111827 100%)',
          border: '1px solid rgba(148,163,184,0.2)',
          borderRadius: 16,
          padding: 16,
        }}>
          <svg viewBox="0 0 320 380" width="100%" height="auto" role="img" aria-label="Face region heatmap">
            {/* Forehead */}
            <path
              d="M70,110 Q160,40 250,110 Q250,150 160,160 Q70,150 70,110 Z"
              fill={regionFill(regions, 'forehead')}
              fillOpacity={regionOpacity(regions, 'forehead')}
              stroke="#94a3b8"
              strokeOpacity="0.4"
              strokeWidth="1"
            />
            {/* Face outline / jawline */}
            <path
              d="M60,160 Q60,300 160,355 Q260,300 260,160 Q260,140 240,135 Q160,330 80,135 Q60,140 60,160 Z"
              fill={regionFill(regions, 'jawline')}
              fillOpacity={regionOpacity(regions, 'jawline')}
              stroke="#94a3b8"
              strokeOpacity="0.5"
              strokeWidth="1.5"
            />
            {/* Inner face neutral fill */}
            <ellipse cx="160" cy="200" rx="90" ry="120" fill="#0f172a" fillOpacity="0.55" />

            {/* Left ear */}
            <ellipse
              cx="55" cy="200" rx="18" ry="32"
              fill={regionFill(regions, 'left_ear')}
              fillOpacity={regionOpacity(regions, 'left_ear')}
              stroke="#94a3b8" strokeOpacity="0.5"
            />
            {/* Right ear */}
            <ellipse
              cx="265" cy="200" rx="18" ry="32"
              fill={regionFill(regions, 'right_ear')}
              fillOpacity={regionOpacity(regions, 'right_ear')}
              stroke="#94a3b8" strokeOpacity="0.5"
            />

            {/* Left eye */}
            <ellipse
              cx="120" cy="190" rx="22" ry="12"
              fill={regionFill(regions, 'left_eye')}
              fillOpacity={regionOpacity(regions, 'left_eye')}
              stroke="#e2e8f0" strokeOpacity="0.7"
            />
            <circle cx="120" cy="190" r="4" fill="#0f172a" />

            {/* Right eye */}
            <ellipse
              cx="200" cy="190" rx="22" ry="12"
              fill={regionFill(regions, 'right_eye')}
              fillOpacity={regionOpacity(regions, 'right_eye')}
              stroke="#e2e8f0" strokeOpacity="0.7"
            />
            <circle cx="200" cy="190" r="4" fill="#0f172a" />

            {/* Nose */}
            <path
              d="M160,210 Q150,245 158,265 Q170,270 170,255 Q170,230 160,210 Z"
              fill={regionFill(regions, 'nose')}
              fillOpacity={regionOpacity(regions, 'nose')}
              stroke="#94a3b8" strokeOpacity="0.5"
            />

            {/* Mouth */}
            <path
              d="M125,295 Q160,315 195,295 Q160,305 125,295 Z"
              fill={regionFill(regions, 'mouth')}
              fillOpacity={regionOpacity(regions, 'mouth')}
              stroke="#e2e8f0" strokeOpacity="0.7"
              strokeWidth="1.2"
            />
          </svg>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#cbd5e1', marginTop: 8, flexWrap: 'wrap' }}>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#10b981', borderRadius: 2, marginRight: 4 }} />Low</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#facc15', borderRadius: 2, marginRight: 4 }} />Medium</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#f97316', borderRadius: 2, marginRight: 4 }} />High</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#ef4444', borderRadius: 2, marginRight: 4 }} />Critical</span>
          </div>
        </div>

        {/* Region list */}
        <div style={{ flex: '1 1 320px', minWidth: 280 }}>
          <div style={{
            background: 'rgba(15,23,42,0.6)',
            border: '1px solid rgba(148,163,184,0.2)',
            borderRadius: 12,
            padding: 12,
            marginBottom: 12,
          }}>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Average manipulation score</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#f1f5f9' }}>
              {summary.average_manipulation_score ?? '—'}%
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>
              {summary.regions_flagged ?? 0} regions flagged · highest: <strong style={{ color: '#fca5a5' }}>{summary.highest_risk_region || '—'}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {regions.map(r => (
              <div key={r.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '6px 10px',
                background: 'rgba(15,23,42,0.5)',
                border: '1px solid rgba(148,163,184,0.15)',
                borderRadius: 8,
              }}>
                <span style={{
                  display: 'inline-block',
                  width: 14, height: 14, borderRadius: 4,
                  background: scoreToColor(r.manipulation_score),
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.description}
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: scoreToColor(r.manipulation_score), minWidth: 40, textAlign: 'right' }}>
                  {r.manipulation_score}%
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
