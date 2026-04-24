import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, FEATURES } from '../services/api';

const riskBadge = (level) => {
  const colors = {
    low: 'bg-green-500/15 text-green-400 border-green-500/30',
    medium: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    high: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    critical: 'bg-red-500/15 text-red-400 border-red-500/30',
    unknown: 'bg-dark-600/50 text-dark-400 border-dark-600/30',
  };
  return colors[level] || colors.unknown;
};

const statusBadge = (status) => {
  const colors = {
    pending: 'bg-dark-600/50 text-dark-300',
    analyzing: 'bg-blue-500/15 text-blue-400',
    analyzed: 'bg-green-500/15 text-green-400',
    completed: 'bg-green-500/15 text-green-400',
    active: 'bg-emerald-500/15 text-emerald-400',
    alert: 'bg-red-500/15 text-red-400',
    paused: 'bg-yellow-500/15 text-yellow-400',
    flagged: 'bg-orange-500/15 text-orange-400',
    logged: 'bg-dark-600/50 text-dark-300',
    inactive: 'bg-dark-600/50 text-dark-400',
    suspended: 'bg-red-500/15 text-red-400',
    rate_limited: 'bg-orange-500/15 text-orange-400',
  };
  return colors[status] || colors.pending;
};

const ITEMS_PER_PAGE = 20;

export default function FeatureList() {
  const { featureKey } = useParams();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [showBulkMenu, setShowBulkMenu] = useState(false);
  const [filters, setFilters] = useState({ status: '', risk_level: '', date_from: '', date_to: '' });
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [toast, setToast] = useState('');

  const feature = FEATURES.find(f => f.key === featureKey);

  useEffect(() => {
    setLoading(true);
    setSelectedIds(new Set());
    setCurrentPage(1);
    api.getAll(featureKey)
      .then(setItems)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [featureKey]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  // Filter and search
  const filtered = items.filter(item => {
    const searchStr = search.toLowerCase();
    const matchesSearch = !search ||
      (item.title || item.full_name || '').toLowerCase().includes(searchStr) ||
      (item.description || item.email || '').toLowerCase().includes(searchStr) ||
      (item.status || '').toLowerCase().includes(searchStr);
    const matchesStatus = !filters.status || item.status === filters.status;
    const matchesRisk = !filters.risk_level || item.risk_level === filters.risk_level;
    const matchesDateFrom = !filters.date_from || new Date(item.created_at) >= new Date(filters.date_from);
    const matchesDateTo = !filters.date_to || new Date(item.created_at) <= new Date(filters.date_to + 'T23:59:59');
    return matchesSearch && matchesStatus && matchesRisk && matchesDateFrom && matchesDateTo;
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    let aVal = a[sortBy];
    let bVal = b[sortBy];
    if (sortBy === 'created_at' || sortBy === 'updated_at') {
      aVal = new Date(aVal || 0).getTime();
      bVal = new Date(bVal || 0).getTime();
    } else if (sortBy === 'confidence_score') {
      aVal = Number(aVal) || 0;
      bVal = Number(bVal) || 0;
    } else {
      aVal = String(aVal || '').toLowerCase();
      bVal = String(bVal || '').toLowerCase();
    }
    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  // Pagination
  const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE);
  const paginated = sorted.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const toggleSort = (field) => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir('desc'); }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginated.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(paginated.map(i => i.id)));
  };

  // Bulk actions
  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} items?`)) return;
    try {
      await api.bulkDelete(featureKey, [...selectedIds]);
      setItems(items.filter(i => !selectedIds.has(i.id)));
      showToast(`Deleted ${selectedIds.size} items`);
      setSelectedIds(new Set());
    } catch (err) { alert(err.message); }
    setShowBulkMenu(false);
  };

  const handleBulkStatus = async (status) => {
    try {
      await api.bulkUpdateStatus(featureKey, [...selectedIds], status);
      setItems(items.map(i => selectedIds.has(i.id) ? { ...i, status } : i));
      showToast(`Updated ${selectedIds.size} items to ${status}`);
      setSelectedIds(new Set());
    } catch (err) { alert(err.message); }
    setShowBulkMenu(false);
  };

  const handleBulkRisk = async (risk) => {
    try {
      await api.bulkUpdateRisk(featureKey, [...selectedIds], risk);
      setItems(items.map(i => selectedIds.has(i.id) ? { ...i, risk_level: risk } : i));
      showToast(`Updated ${selectedIds.size} items risk to ${risk}`);
      setSelectedIds(new Set());
    } catch (err) { alert(err.message); }
    setShowBulkMenu(false);
  };

  // Export
  const handleExport = async (format) => {
    try {
      const blob = format === 'csv' ? await api.exportCSV(featureKey) : await api.exportJSON(featureKey);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${featureKey}-export.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Exported as ${format.toUpperCase()}`);
    } catch (err) { alert('Export failed: ' + err.message); }
  };

  const getDisplayName = (item) => item.title || item.full_name || item.key_name || `Item #${item.id}`;
  const getSubtext = (item) => item.description || item.email || item.file_name || '';

  const sortIcon = (field) => sortBy === field ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  const activeFilterCount = Object.values(filters).filter(v => v).length;

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2.5 bg-green-500/20 border border-green-500/30 rounded-xl text-green-400 text-sm animate-fade-in">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <button onClick={() => navigate('/')} className="text-dark-400 hover:text-white text-sm mb-2 flex items-center gap-1">
            ← Back to Dashboard
          </button>
          <h1 className="text-2xl font-bold text-white">{feature?.name || featureKey}</h1>
          <p className="text-dark-400 text-sm mt-1">{feature?.description}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => handleExport('csv')} className="px-3 py-2 bg-dark-700/80 border border-dark-600/50 rounded-xl text-xs hover:bg-dark-600/80" title="Export CSV">
            CSV ↓
          </button>
          <button onClick={() => handleExport('json')} className="px-3 py-2 bg-dark-700/80 border border-dark-600/50 rounded-xl text-xs hover:bg-dark-600/80" title="Export JSON">
            JSON ↓
          </button>
          <button
            onClick={() => navigate(`/feature/${featureKey}/new`)}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl font-medium text-sm hover:from-blue-600 hover:to-purple-700 transition-all shadow-lg shadow-blue-500/25 whitespace-nowrap"
          >
            + New Item
          </button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="mb-4 space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
            placeholder="Search items..."
            className="flex-1 md:max-w-sm px-4 py-2.5 bg-dark-800/80 border border-dark-700/50 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:border-blue-500/50 text-sm"
          />
          <button onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2.5 rounded-xl text-sm border transition-colors ${showFilters || activeFilterCount > 0 ? 'bg-blue-500/20 border-blue-500/30 text-blue-400' : 'bg-dark-800/80 border-dark-700/50 text-dark-400 hover:text-white'}`}>
            Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-2 p-3 bg-dark-800/50 rounded-xl border border-dark-700/30">
            <select value={filters.status} onChange={e => { setFilters({ ...filters, status: e.target.value }); setCurrentPage(1); }}
              className="px-3 py-1.5 bg-dark-700/50 border border-dark-600/50 rounded-lg text-xs text-white focus:outline-none">
              <option value="">All Status</option>
              {['pending', 'analyzing', 'analyzed', 'completed', 'active', 'paused', 'alert', 'flagged', 'logged', 'inactive'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select value={filters.risk_level} onChange={e => { setFilters({ ...filters, risk_level: e.target.value }); setCurrentPage(1); }}
              className="px-3 py-1.5 bg-dark-700/50 border border-dark-600/50 rounded-lg text-xs text-white focus:outline-none">
              <option value="">All Risk</option>
              {['critical', 'high', 'medium', 'low', 'unknown'].map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <input type="date" value={filters.date_from} onChange={e => { setFilters({ ...filters, date_from: e.target.value }); setCurrentPage(1); }}
              className="px-3 py-1.5 bg-dark-700/50 border border-dark-600/50 rounded-lg text-xs text-white focus:outline-none" placeholder="From" />
            <input type="date" value={filters.date_to} onChange={e => { setFilters({ ...filters, date_to: e.target.value }); setCurrentPage(1); }}
              className="px-3 py-1.5 bg-dark-700/50 border border-dark-600/50 rounded-lg text-xs text-white focus:outline-none" placeholder="To" />
            {activeFilterCount > 0 && (
              <button onClick={() => { setFilters({ status: '', risk_level: '', date_from: '', date_to: '' }); setCurrentPage(1); }}
                className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300">Clear Filters</button>
            )}
          </div>
        )}
      </div>

      {/* Stats bar + bulk actions */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-4 text-sm">
          <span className="text-dark-400">{filtered.length} items</span>
          <span className="text-red-400/60">{filtered.filter(i => ['high', 'critical'].includes(i.risk_level)).length} high risk</span>
          <span className="text-green-400/60">{filtered.filter(i => ['analyzed', 'completed', 'active'].includes(i.status)).length} completed</span>
        </div>
        {selectedIds.size > 0 && (
          <div className="relative">
            <button onClick={() => setShowBulkMenu(!showBulkMenu)}
              className="px-4 py-1.5 bg-blue-500/20 border border-blue-500/30 rounded-lg text-xs text-blue-400">
              {selectedIds.size} selected ▾
            </button>
            {showBulkMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-dark-800 border border-dark-700/50 rounded-xl shadow-xl z-20 py-1">
                <div className="px-3 py-1.5 text-[10px] text-dark-500 uppercase font-semibold">Status</div>
                {['pending', 'analyzed', 'completed'].map(s => (
                  <button key={s} onClick={() => handleBulkStatus(s)}
                    className="w-full text-left px-3 py-1.5 text-xs text-dark-300 hover:bg-dark-700/50 hover:text-white">{s}</button>
                ))}
                <div className="border-t border-dark-700/30 my-1"></div>
                <div className="px-3 py-1.5 text-[10px] text-dark-500 uppercase font-semibold">Risk Level</div>
                {['low', 'medium', 'high', 'critical'].map(r => (
                  <button key={r} onClick={() => handleBulkRisk(r)}
                    className="w-full text-left px-3 py-1.5 text-xs text-dark-300 hover:bg-dark-700/50 hover:text-white">{r}</button>
                ))}
                <div className="border-t border-dark-700/30 my-1"></div>
                <button onClick={handleBulkDelete}
                  className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10">Delete Selected</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Loading */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500 mx-auto mb-3"></div>
          <div className="text-dark-400 text-sm">Loading...</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-dark-800/50 rounded-xl border border-dark-700/30">
          <div className="text-dark-500 text-lg mb-2">No items found</div>
          <button
            onClick={() => navigate(`/feature/${featureKey}/new`)}
            className="text-blue-400 hover:text-blue-300 text-sm"
          >
            Create your first item →
          </button>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="bg-dark-800/80 backdrop-blur rounded-xl border border-dark-700/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-dark-700/50">
                    <th className="py-3 px-3 w-8">
                      <input type="checkbox" checked={selectedIds.size === paginated.length && paginated.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-dark-600 bg-dark-700 text-blue-500 focus:ring-blue-500/25" />
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-dark-400 uppercase tracking-wider cursor-pointer hover:text-white" onClick={() => toggleSort('id')}>
                      ID{sortIcon('id')}
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-dark-400 uppercase tracking-wider cursor-pointer hover:text-white" onClick={() => toggleSort('title')}>
                      Name{sortIcon('title')}
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-dark-400 uppercase tracking-wider hidden md:table-cell cursor-pointer hover:text-white" onClick={() => toggleSort('status')}>
                      Status{sortIcon('status')}
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-dark-400 uppercase tracking-wider hidden md:table-cell cursor-pointer hover:text-white" onClick={() => toggleSort('risk_level')}>
                      Risk{sortIcon('risk_level')}
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-dark-400 uppercase tracking-wider hidden lg:table-cell cursor-pointer hover:text-white" onClick={() => toggleSort('confidence_score')}>
                      Confidence{sortIcon('confidence_score')}
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-dark-400 uppercase tracking-wider hidden lg:table-cell cursor-pointer hover:text-white" onClick={() => toggleSort('created_at')}>
                      Date{sortIcon('created_at')}
                    </th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-dark-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(item => (
                    <tr
                      key={item.id}
                      className={`border-b border-dark-700/30 hover:bg-dark-700/30 cursor-pointer transition-colors ${selectedIds.has(item.id) ? 'bg-blue-500/5' : ''}`}
                    >
                      <td className="py-3 px-3" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedIds.has(item.id)}
                          onChange={() => toggleSelect(item.id)}
                          className="rounded border-dark-600 bg-dark-700 text-blue-500 focus:ring-blue-500/25" />
                      </td>
                      <td className="py-3 px-4 text-sm text-dark-400 font-mono" onClick={() => navigate(`/feature/${featureKey}/${item.id}`)}>#{item.id}</td>
                      <td className="py-3 px-4" onClick={() => navigate(`/feature/${featureKey}/${item.id}`)}>
                        <div className="text-sm font-medium text-white">{getDisplayName(item)}</div>
                        <div className="text-xs text-dark-400 truncate max-w-xs">{getSubtext(item)}</div>
                      </td>
                      <td className="py-3 px-4 hidden md:table-cell" onClick={() => navigate(`/feature/${featureKey}/${item.id}`)}>
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${statusBadge(item.status)}`}>
                          {item.status || 'pending'}
                        </span>
                      </td>
                      <td className="py-3 px-4 hidden md:table-cell" onClick={() => navigate(`/feature/${featureKey}/${item.id}`)}>
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium border ${riskBadge(item.risk_level)}`}>
                          {item.risk_level || 'unknown'}
                        </span>
                      </td>
                      <td className="py-3 px-4 hidden lg:table-cell" onClick={() => navigate(`/feature/${featureKey}/${item.id}`)}>
                        {item.confidence_score != null ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-dark-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  item.confidence_score >= 80 ? 'bg-red-500' : item.confidence_score >= 50 ? 'bg-yellow-500' : 'bg-green-500'
                                }`}
                                style={{ width: `${item.confidence_score}%` }}
                              ></div>
                            </div>
                            <span className="text-xs text-dark-300">{Number(item.confidence_score).toFixed(1)}%</span>
                          </div>
                        ) : (
                          <span className="text-xs text-dark-500">N/A</span>
                        )}
                      </td>
                      <td className="py-3 px-4 hidden lg:table-cell text-xs text-dark-400" onClick={() => navigate(`/feature/${featureKey}/${item.id}`)}>
                        {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/feature/${featureKey}/${item.id}`); }}
                          className="text-blue-400 hover:text-blue-300 text-xs mr-2"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-xs text-dark-500">
                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, sorted.length)} of {sorted.length}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1}
                  className="px-2 py-1 bg-dark-700/80 rounded text-xs disabled:opacity-30">«</button>
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                  className="px-2 py-1 bg-dark-700/80 rounded text-xs disabled:opacity-30">‹</button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let page;
                  if (totalPages <= 5) page = i + 1;
                  else if (currentPage <= 3) page = i + 1;
                  else if (currentPage >= totalPages - 2) page = totalPages - 4 + i;
                  else page = currentPage - 2 + i;
                  return (
                    <button key={page} onClick={() => setCurrentPage(page)}
                      className={`px-2.5 py-1 rounded text-xs ${currentPage === page ? 'bg-blue-500/20 text-blue-400' : 'bg-dark-700/80 text-dark-300 hover:text-white'}`}>
                      {page}
                    </button>
                  );
                })}
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                  className="px-2 py-1 bg-dark-700/80 rounded text-xs disabled:opacity-30">›</button>
                <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}
                  className="px-2 py-1 bg-dark-700/80 rounded text-xs disabled:opacity-30">»</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
