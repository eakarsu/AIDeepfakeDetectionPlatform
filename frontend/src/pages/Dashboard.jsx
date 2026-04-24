import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, FEATURES } from '../services/api';

const icons = {
  Camera: '📷', Video: '🎬', Mic: '🎙️', Users: '👥', Cpu: '🤖', FileSearch: '🔍',
  Layers: '📚', Activity: '📡', Shield: '🛡️', Globe: '🌐', Key: '🔑', History: '📋',
  AlertTriangle: '⚠️', UserCog: '👤', ClipboardCheck: '✅'
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getStats().then(setStats).catch(console.error).finally(() => setLoading(false));
  }, []);

  const totalScans = Object.values(stats).reduce((sum, s) => sum + (s?.total || 0), 0);
  const totalFlagged = Object.values(stats).reduce((sum, s) => sum + (s?.flagged || 0), 0);
  const categories = [...new Set(FEATURES.map(f => f.category))];

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          Detection Dashboard
        </h1>
        <p className="text-dark-400 mt-1">AI-Powered Deepfake Detection & Trust Safety Platform</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-dark-800/80 backdrop-blur rounded-xl border border-dark-700/50 p-5">
          <div className="text-dark-400 text-sm">Total Records</div>
          <div className="text-3xl font-bold mt-1">{loading ? '...' : totalScans.toLocaleString()}</div>
          <div className="text-xs text-dark-500 mt-1">Across all features</div>
        </div>
        <div className="bg-dark-800/80 backdrop-blur rounded-xl border border-red-500/20 p-5 cursor-pointer hover:border-red-500/40 transition-colors" onClick={() => navigate('/search?risk_level=critical')}>
          <div className="text-dark-400 text-sm">High Risk Items</div>
          <div className="text-3xl font-bold mt-1 text-red-400">{loading ? '...' : totalFlagged.toLocaleString()}</div>
          <div className="text-xs text-red-400/60 mt-1">Click to review →</div>
        </div>
        <div className="bg-dark-800/80 backdrop-blur rounded-xl border border-green-500/20 p-5">
          <div className="text-dark-400 text-sm">Active Features</div>
          <div className="text-3xl font-bold mt-1 text-green-400">{FEATURES.length}</div>
          <div className="text-xs text-green-400/60 mt-1">Detection modules</div>
        </div>
        <div className="bg-dark-800/80 backdrop-blur rounded-xl border border-blue-500/20 p-5">
          <div className="text-dark-400 text-sm">AI Engine</div>
          <div className="text-lg font-bold mt-1 text-blue-400">Claude Haiku 4.5</div>
          <div className="text-xs text-blue-400/60 mt-1">via OpenRouter</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-dark-200 mb-4 flex items-center gap-2">
          <div className="w-1 h-5 bg-purple-500 rounded-full"></div>
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Analytics', path: '/analytics', icon: '📊', color: 'from-blue-500/20 to-blue-600/20 border-blue-500/30 hover:border-blue-500/50' },
            { label: 'Search', path: '/search', icon: '🔍', color: 'from-purple-500/20 to-purple-600/20 border-purple-500/30 hover:border-purple-500/50' },
            { label: 'Bookmarks', path: '/bookmarks', icon: '⭐', color: 'from-yellow-500/20 to-yellow-600/20 border-yellow-500/30 hover:border-yellow-500/50' },
            { label: 'Activity', path: '/activity', icon: '📜', color: 'from-green-500/20 to-green-600/20 border-green-500/30 hover:border-green-500/50' },
            { label: 'Reports', path: '/reports', icon: '📑', color: 'from-cyan-500/20 to-cyan-600/20 border-cyan-500/30 hover:border-cyan-500/50' },
            { label: 'Profile', path: '/profile', icon: '👤', color: 'from-pink-500/20 to-pink-600/20 border-pink-500/30 hover:border-pink-500/50' },
          ].map(action => (
            <button key={action.path} onClick={() => navigate(action.path)}
              className={`p-4 bg-gradient-to-br ${action.color} rounded-xl border text-center transition-all hover:scale-[1.02]`}>
              <div className="text-xl mb-1">{action.icon}</div>
              <div className="text-xs font-medium text-dark-200">{action.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Feature Cards by Category */}
      {categories.map(category => (
        <div key={category} className="mb-8">
          <h2 className="text-lg font-semibold text-dark-200 mb-4 flex items-center gap-2">
            <div className="w-1 h-5 bg-blue-500 rounded-full"></div>
            {category}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.filter(f => f.category === category).map(feature => {
              const stat = stats[feature.key] || { total: 0, flagged: 0 };
              return (
                <div
                  key={feature.key}
                  onClick={() => navigate(`/feature/${feature.key}`)}
                  className="card-hover cursor-pointer bg-dark-800/80 backdrop-blur rounded-xl border border-dark-700/50 overflow-hidden group hover:border-dark-600/80"
                >
                  {/* Gradient bar */}
                  <div className={`h-1 bg-gradient-to-r ${feature.color}`}></div>

                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center text-lg shadow-lg`}>
                          {icons[feature.icon]}
                        </div>
                        <div>
                          <h3 className="font-semibold text-white group-hover:text-blue-400 transition-colors">{feature.name}</h3>
                          <p className="text-xs text-dark-400 mt-0.5">{feature.description}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-dark-700/30">
                      <div className="flex items-center gap-4">
                        <div>
                          <div className="text-lg font-bold">{loading ? '...' : stat.total}</div>
                          <div className="text-xs text-dark-500">Total</div>
                        </div>
                        {stat.flagged > 0 && (
                          <div>
                            <div className="text-lg font-bold text-red-400">{stat.flagged}</div>
                            <div className="text-xs text-red-400/60">Flagged</div>
                          </div>
                        )}
                      </div>
                      <div className="text-dark-500 group-hover:text-blue-400 transition-colors text-sm">
                        View →
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
