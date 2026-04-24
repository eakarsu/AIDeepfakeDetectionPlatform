import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, FEATURES } from '../services/api';

const BarChart = ({ data, maxValue, colorClass = 'bg-blue-500' }) => (
  <div className="flex items-end gap-1 h-32">
    {data.map((item, i) => (
      <div key={i} className="flex-1 flex flex-col items-center gap-1">
        <div className="text-[10px] text-dark-400">{item.value}</div>
        <div
          className={`w-full ${colorClass} rounded-t-sm min-h-[2px] transition-all`}
          style={{ height: `${maxValue > 0 ? (item.value / maxValue) * 100 : 0}%` }}
        ></div>
        <div className="text-[9px] text-dark-500 truncate w-full text-center" title={item.label}>{item.label}</div>
      </div>
    ))}
  </div>
);

const DonutChart = ({ data, size = 120 }) => {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const colors = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e', unknown: '#6b7280' };
  let cumulative = 0;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
        {total === 0 ? (
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#374151" strokeWidth="3" />
        ) : (
          data.map((item, i) => {
            const pct = (item.value / total) * 100;
            const offset = cumulative;
            cumulative += pct;
            return (
              <circle key={i} cx="18" cy="18" r="15.9" fill="none"
                stroke={colors[item.label] || '#6b7280'} strokeWidth="3"
                strokeDasharray={`${pct} ${100 - pct}`}
                strokeDashoffset={`${-offset}`}
              />
            );
          })
        )}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-bold">{total}</div>
          <div className="text-[10px] text-dark-400">Total</div>
        </div>
      </div>
    </div>
  );
};

export default function Analytics() {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAnalytics().then(setAnalytics).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500 mx-auto mb-3"></div>
        <div className="text-dark-400">Loading analytics...</div>
      </div>
    );
  }

  if (!analytics) return <div className="text-dark-400 text-center py-12">Failed to load analytics</div>;

  // Aggregate risk across all features
  const totalRisk = { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 };
  const featureData = [];
  FEATURES.filter(f => f.key !== 'users').forEach(f => {
    const d = analytics[f.key];
    if (!d) return;
    featureData.push({ label: f.name.substring(0, 8), value: d.total, key: f.key });
    Object.entries(d.risk_breakdown || {}).forEach(([k, v]) => {
      if (totalRisk[k] !== undefined) totalRisk[k] += v;
    });
  });

  const maxFeatureValue = Math.max(...featureData.map(f => f.value), 1);

  const riskChartData = Object.entries(totalRisk).filter(([, v]) => v > 0).map(([label, value]) => ({ label, value }));

  // Timeline chart
  const timelineData = (analytics.timeline || []).slice(-14).map(t => ({
    label: new Date(t.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
    value: t.count
  }));
  const maxTimeline = Math.max(...timelineData.map(t => t.value), 1);

  return (
    <div>
      <div className="mb-6">
        <button onClick={() => navigate('/')} className="text-dark-400 hover:text-white text-sm mb-2 flex items-center gap-1">← Back to Dashboard</button>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Analytics</h1>
        <p className="text-dark-400 text-sm mt-1">Platform-wide statistics and trends</p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-dark-800/80 rounded-xl border border-dark-700/50 p-5">
          <div className="text-dark-400 text-sm">Total Records</div>
          <div className="text-3xl font-bold mt-1">{featureData.reduce((s, f) => s + f.value, 0)}</div>
        </div>
        <div className="bg-dark-800/80 rounded-xl border border-red-500/20 p-5">
          <div className="text-dark-400 text-sm">Critical + High</div>
          <div className="text-3xl font-bold mt-1 text-red-400">{totalRisk.critical + totalRisk.high}</div>
        </div>
        <div className="bg-dark-800/80 rounded-xl border border-blue-500/20 p-5">
          <div className="text-dark-400 text-sm">Total Users</div>
          <div className="text-3xl font-bold mt-1 text-blue-400">{analytics.users?.total || 0}</div>
        </div>
        <div className="bg-dark-800/80 rounded-xl border border-green-500/20 p-5">
          <div className="text-dark-400 text-sm">Active Users (7d)</div>
          <div className="text-3xl font-bold mt-1 text-green-400">{analytics.users?.active_7d || 0}</div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Risk Distribution Donut */}
        <div className="bg-dark-800/80 rounded-xl border border-dark-700/50 p-5">
          <h3 className="text-sm font-semibold text-dark-200 mb-4">Risk Distribution</h3>
          <div className="flex items-center justify-center mb-4">
            <DonutChart data={riskChartData} />
          </div>
          <div className="flex flex-wrap gap-3 justify-center">
            {Object.entries(totalRisk).filter(([, v]) => v > 0).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1.5 text-xs">
                <span className={`w-2 h-2 rounded-full ${k === 'critical' ? 'bg-red-500' : k === 'high' ? 'bg-orange-500' : k === 'medium' ? 'bg-yellow-500' : k === 'low' ? 'bg-green-500' : 'bg-gray-500'}`}></span>
                <span className="text-dark-400 capitalize">{k}: {v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Records by Feature */}
        <div className="bg-dark-800/80 rounded-xl border border-dark-700/50 p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-dark-200 mb-4">Records by Feature</h3>
          <BarChart data={featureData} maxValue={maxFeatureValue} colorClass="bg-blue-500" />
        </div>
      </div>

      {/* Timeline */}
      {timelineData.length > 0 && (
        <div className="bg-dark-800/80 rounded-xl border border-dark-700/50 p-5 mb-8">
          <h3 className="text-sm font-semibold text-dark-200 mb-4">Records Created (Last 14 Days)</h3>
          <BarChart data={timelineData} maxValue={maxTimeline} colorClass="bg-purple-500" />
        </div>
      )}

      {/* Feature Breakdown Table */}
      <div className="bg-dark-800/80 rounded-xl border border-dark-700/50 overflow-hidden">
        <div className="p-5 border-b border-dark-700/50">
          <h3 className="text-sm font-semibold text-dark-200">Feature Breakdown</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-dark-700/50">
              <th className="text-left py-3 px-4 text-xs font-semibold text-dark-400 uppercase">Feature</th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-dark-400 uppercase">Total</th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-dark-400 uppercase hidden sm:table-cell">Recent 7d</th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-dark-400 uppercase hidden md:table-cell">Critical</th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-dark-400 uppercase hidden md:table-cell">High</th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-dark-400 uppercase hidden lg:table-cell">Medium</th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-dark-400 uppercase hidden lg:table-cell">Low</th>
            </tr>
          </thead>
          <tbody>
            {FEATURES.filter(f => f.key !== 'users').map(f => {
              const d = analytics[f.key] || { total: 0, recent_7d: 0, risk_breakdown: {} };
              return (
                <tr key={f.key} className="border-b border-dark-700/30 hover:bg-dark-700/30 cursor-pointer" onClick={() => navigate(`/feature/${f.key}`)}>
                  <td className="py-3 px-4 text-sm text-white">{f.name}</td>
                  <td className="py-3 px-4 text-sm text-right font-mono">{d.total}</td>
                  <td className="py-3 px-4 text-sm text-right font-mono text-blue-400 hidden sm:table-cell">{d.recent_7d}</td>
                  <td className="py-3 px-4 text-sm text-right font-mono text-red-400 hidden md:table-cell">{d.risk_breakdown?.critical || 0}</td>
                  <td className="py-3 px-4 text-sm text-right font-mono text-orange-400 hidden md:table-cell">{d.risk_breakdown?.high || 0}</td>
                  <td className="py-3 px-4 text-sm text-right font-mono text-yellow-400 hidden lg:table-cell">{d.risk_breakdown?.medium || 0}</td>
                  <td className="py-3 px-4 text-sm text-right font-mono text-green-400 hidden lg:table-cell">{d.risk_breakdown?.low || 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
