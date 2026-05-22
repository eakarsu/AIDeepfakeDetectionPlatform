import React from 'react';
import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  ResponsiveContainer,
} from 'recharts';

/**
 * AuthenticityGauge
 * --------------------------------------------------------------
 * Large radial gauge (0-100% authenticity) with verdict label,
 * driven by the response from:
 *   GET /api/custom-views/authenticity
 *
 * Props:
 *   data: {
 *     authenticity_pct, confidence, verdict, verdict_color,
 *     recommendation, signals: [{ name, weight, score }]
 *   }
 */
export default function AuthenticityGauge({ data }) {
  const pct = Number(data?.authenticity_pct ?? 0);
  const verdict = data?.verdict || 'Unknown';
  const color = data?.verdict_color || '#3b82f6';
  const confidence = data?.confidence ?? null;
  const recommendation = data?.recommendation || '';
  const signals = Array.isArray(data?.signals) ? data.signals : [];

  const chartData = [{ name: 'authenticity', value: pct, fill: color }];

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'stretch' }}>
        {/* Gauge */}
        <div style={{
          flex: '0 0 360px',
          background: 'linear-gradient(180deg, #0b1220 0%, #111827 100%)',
          border: '1px solid rgba(148,163,184,0.2)',
          borderRadius: 16,
          padding: 16,
          position: 'relative',
          minHeight: 320,
        }}>
          <div style={{ width: '100%', height: 280, position: 'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                cx="50%"
                cy="55%"
                innerRadius="70%"
                outerRadius="100%"
                barSize={26}
                data={chartData}
                startAngle={210}
                endAngle={-30}
              >
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar
                  background={{ fill: 'rgba(148,163,184,0.15)' }}
                  dataKey="value"
                  cornerRadius={12}
                  fill={color}
                />
              </RadialBarChart>
            </ResponsiveContainer>
            <div style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
            }}>
              <div style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>Authenticity</div>
              <div style={{ fontSize: 56, fontWeight: 800, color: color, lineHeight: 1 }}>{pct}%</div>
              <div style={{
                marginTop: 8,
                padding: '4px 12px',
                borderRadius: 999,
                background: color + '22',
                color: color,
                fontWeight: 700,
                fontSize: 13,
                border: `1px solid ${color}55`,
              }}>{verdict}</div>
              {confidence != null && (
                <div style={{ marginTop: 6, fontSize: 11, color: '#94a3b8' }}>Confidence {confidence}%</div>
              )}
            </div>
          </div>
          {recommendation && (
            <div style={{
              marginTop: 8,
              padding: '8px 12px',
              background: 'rgba(15,23,42,0.6)',
              border: '1px solid rgba(148,163,184,0.2)',
              borderRadius: 8,
              fontSize: 12,
              color: '#cbd5e1',
              textAlign: 'center',
            }}>
              {recommendation}
            </div>
          )}
        </div>

        {/* Signal breakdown */}
        <div style={{ flex: '1 1 320px', minWidth: 280 }}>
          <div style={{
            background: 'rgba(15,23,42,0.6)',
            border: '1px solid rgba(148,163,184,0.2)',
            borderRadius: 12,
            padding: 14,
            marginBottom: 12,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>
              Detection signal breakdown
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              Weighted contributions of the model's sub-detectors to the overall authenticity score.
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {signals.map((s, i) => (
              <div key={i} style={{
                background: 'rgba(15,23,42,0.5)',
                border: '1px solid rgba(148,163,184,0.15)',
                borderRadius: 8,
                padding: '8px 12px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>
                    weight {(s.weight * 100).toFixed(0)}% · score <strong style={{ color: '#f1f5f9' }}>{s.score}</strong>
                  </div>
                </div>
                <div style={{ position: 'relative', height: 6, background: 'rgba(148,163,184,0.15)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    position: 'absolute',
                    top: 0, left: 0, bottom: 0,
                    width: `${Math.max(0, Math.min(100, s.score))}%`,
                    background: color,
                    transition: 'width 400ms ease',
                  }} />
                </div>
              </div>
            ))}
            {signals.length === 0 && (
              <div style={{ fontSize: 12, color: '#94a3b8' }}>No signal data available.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
