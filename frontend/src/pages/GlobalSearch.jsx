import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, FEATURES } from '../services/api';

const riskColors = {
  low: 'text-green-400', medium: 'text-yellow-400', high: 'text-orange-400', critical: 'text-red-400',
};

export default function GlobalSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [filters, setFilters] = useState({ feature_key: '', status: '', risk_level: '', date_from: '', date_to: '' });

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!query.trim() && !filters.feature_key) return;
    setLoading(true);
    setSearched(true);
    try {
      const params = { q: query.trim(), limit: 100, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) };
      const data = await api.globalSearch(params);
      setResults(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const getFeatureName = (key) => FEATURES.find(f => f.key === key)?.name || key;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <button onClick={() => navigate('/')} className="text-dark-400 hover:text-white text-sm mb-2 flex items-center gap-1">{'\u2190'} Back to Dashboard</button>
        <h1 className="text-2xl font-bold text-white">Global Search</h1>
        <p className="text-dark-400 text-sm mt-1">Search across all features</p>
      </div>

      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-2 mb-3">
          <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search titles, descriptions..."
            className="flex-1 px-4 py-3 bg-dark-800/80 border border-dark-700/50 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:border-blue-500/50 text-sm" />
          <button type="submit" className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl text-sm font-medium">
            Search
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <select value={filters.feature_key} onChange={e => setFilters({ ...filters, feature_key: e.target.value })}
            className="px-3 py-1.5 bg-dark-800/80 border border-dark-700/50 rounded-lg text-xs text-white focus:outline-none">
            <option value="">All Features</option>
            {FEATURES.filter(f => f.key !== 'users').map(f => <option key={f.key} value={f.key}>{f.name}</option>)}
          </select>
          <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}
            className="px-3 py-1.5 bg-dark-800/80 border border-dark-700/50 rounded-lg text-xs text-white focus:outline-none">
            <option value="">All Status</option>
            {['pending', 'analyzing', 'analyzed', 'completed', 'active'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filters.risk_level} onChange={e => setFilters({ ...filters, risk_level: e.target.value })}
            className="px-3 py-1.5 bg-dark-800/80 border border-dark-700/50 rounded-lg text-xs text-white focus:outline-none">
            <option value="">All Risk</option>
            {['critical', 'high', 'medium', 'low'].map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <input type="date" value={filters.date_from} onChange={e => setFilters({ ...filters, date_from: e.target.value })}
            className="px-3 py-1.5 bg-dark-800/80 border border-dark-700/50 rounded-lg text-xs text-white focus:outline-none" />
          <input type="date" value={filters.date_to} onChange={e => setFilters({ ...filters, date_to: e.target.value })}
            className="px-3 py-1.5 bg-dark-800/80 border border-dark-700/50 rounded-lg text-xs text-white focus:outline-none" />
        </div>
      </form>

      {loading ? (
        <div className="text-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500 mx-auto"></div></div>
      ) : searched && results.length === 0 ? (
        <div className="text-center py-12 bg-dark-800/50 rounded-xl border border-dark-700/30">
          <div className="text-dark-500">No results found</div>
        </div>
      ) : results.length > 0 ? (
        <>
          <div className="text-sm text-dark-400 mb-3">{results.length} results found</div>
          <div className="bg-dark-800/80 rounded-xl border border-dark-700/50 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-700/50">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-dark-400 uppercase">Title</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-dark-400 uppercase hidden sm:table-cell">Feature</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-dark-400 uppercase hidden md:table-cell">Status</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-dark-400 uppercase hidden md:table-cell">Risk</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-dark-400 uppercase hidden lg:table-cell">Date</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={`${r.feature_key}-${r.id}-${i}`} onClick={() => navigate(`/feature/${r.feature_key}/${r.id}`)}
                    className="border-b border-dark-700/30 hover:bg-dark-700/30 cursor-pointer">
                    <td className="py-3 px-4">
                      <div className="text-sm text-white">{r.title}</div>
                      <div className="text-xs text-dark-500 truncate max-w-xs">{r.description}</div>
                    </td>
                    <td className="py-3 px-4 hidden sm:table-cell text-xs text-blue-400">{getFeatureName(r.feature_key)}</td>
                    <td className="py-3 px-4 hidden md:table-cell text-xs text-dark-300">{r.status}</td>
                    <td className={`py-3 px-4 hidden md:table-cell text-xs ${riskColors[r.risk_level] || 'text-dark-400'}`}>{r.risk_level}</td>
                    <td className="py-3 px-4 hidden lg:table-cell text-xs text-dark-400">{r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
