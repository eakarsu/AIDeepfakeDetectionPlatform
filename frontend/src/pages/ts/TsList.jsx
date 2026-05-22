import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { tsApi, TS_FEATURES } from '../../services/tsApi';
import {
  CsamBanner, PageHeader, Card, Btn, SeverityBadge, StatusBadge,
  LoadingSpinner, ErrorBlock, Toast, toast,
} from './TsShared';

export default function TsList() {
  const { featureKey } = useParams();
  const navigate = useNavigate();
  const feature = TS_FEATURES.find(f => f.key === featureKey);

  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [page, setPage] = useState(1);
  const [toastMsg, setToastMsg] = useState('');
  const [stats, setStats] = useState(null);

  const load = useCallback(() => {
    if (!feature) return;
    setLoading(true);
    setError('');
    const params = { page, limit: 20 };
    if (statusFilter) params.status = statusFilter;
    if (severityFilter) params.severity_label = severityFilter;
    const call = search.trim()
      ? tsApi.search(featureKey, search.trim(), { page, limit: 20 })
      : tsApi.list(featureKey, params);
    call
      .then(d => {
        setItems(Array.isArray(d) ? d : (d.data || []));
        if (d.pagination) setPagination(d.pagination);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [featureKey, page, statusFilter, severityFilter, search, feature]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!feature) return;
    tsApi.stats(featureKey).then(setStats).catch(() => {});
  }, [featureKey, feature]);

  const handleDelete = async (id) => {
    if (!window.confirm('Soft-delete this record?')) return;
    try {
      await tsApi.remove(featureKey, id);
      toast('Record deleted', setToastMsg);
      load();
    } catch (e) { toast('Error: ' + e.message, setToastMsg); }
  };

  if (!feature) return <div className="p-6 text-red-400">Unknown feature: {featureKey}</div>;

  const displayKey = (item) =>
    feature.isCsam
      ? (item.hash_value ? item.hash_value.slice(0, 12) + '…' : item.id)
      : (item.title || item.name || item.message_body?.slice(0, 40) || `#${item.id}`);

  return (
    <div>
      {feature.isCsam && <CsamBanner />}

      <PageHeader
        icon={feature.icon}
        title={feature.name}
        subtitle={feature.description}
        actions={
          <Btn variant="primary" onClick={() => navigate(`/ts/${featureKey}/new`)}>
            + New
          </Btn>
        }
      />

      {/* Stats strip */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <Card className="p-4">
            <div className="text-2xl font-bold text-white">{stats.total ?? '—'}</div>
            <div className="text-xs text-dark-400 mt-1">Total Records</div>
          </Card>
          {stats.bySeverity?.slice(0, 3).map(r => (
            <Card key={r.severity_label} className="p-4">
              <div className="text-2xl font-bold text-white">{r.count}</div>
              <div className="text-xs text-dark-400 mt-1 capitalize">{r.severity_label}</div>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <Card className="p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="flex-1 min-w-48 bg-dark-900/60 border border-dark-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-dark-500 focus:outline-none focus:border-blue-500/60"
          />
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="bg-dark-900/60 border border-dark-600/50 rounded-lg px-3 py-2 text-sm text-dark-200 focus:outline-none focus:border-blue-500/60"
          >
            <option value="">All Statuses</option>
            {['active','pending','in_review','draft','published','shared','resolved','escalated','deleted'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {feature.isCsam && (
            <select
              value={severityFilter}
              onChange={e => { setSeverityFilter(e.target.value); setPage(1); }}
              className="bg-dark-900/60 border border-dark-600/50 rounded-lg px-3 py-2 text-sm text-dark-200 focus:outline-none focus:border-blue-500/60"
            >
              <option value="">All Severities</option>
              {['low','medium','high','critical','unknown'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}
          <Btn onClick={load} variant="default" size="sm">Refresh</Btn>
          <Btn onClick={() => navigate(`/ts/${featureKey}/ai-panel`)} variant="ghost" size="sm">
            🤖 AI Panel
          </Btn>
        </div>
      </Card>

      {/* List */}
      {loading && <LoadingSpinner />}
      {error && <ErrorBlock message={error} />}
      {!loading && !error && (
        <>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dark-700/50">
                    <th className="text-left px-4 py-3 text-dark-400 font-medium text-xs uppercase tracking-wide">ID</th>
                    {feature.isCsam ? (
                      <>
                        <th className="text-left px-4 py-3 text-dark-400 font-medium text-xs uppercase tracking-wide">Hash Prefix</th>
                        <th className="text-left px-4 py-3 text-dark-400 font-medium text-xs uppercase tracking-wide">Algorithm</th>
                        <th className="text-left px-4 py-3 text-dark-400 font-medium text-xs uppercase tracking-wide">Source</th>
                        <th className="text-left px-4 py-3 text-dark-400 font-medium text-xs uppercase tracking-wide">Severity</th>
                      </>
                    ) : (
                      <>
                        <th className="text-left px-4 py-3 text-dark-400 font-medium text-xs uppercase tracking-wide">Title</th>
                        <th className="text-left px-4 py-3 text-dark-400 font-medium text-xs uppercase tracking-wide">Status</th>
                      </>
                    )}
                    <th className="text-left px-4 py-3 text-dark-400 font-medium text-xs uppercase tracking-wide">Created</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-dark-500 text-sm">
                        No records found
                      </td>
                    </tr>
                  )}
                  {items.map(item => (
                    <tr
                      key={item.id}
                      className="border-b border-dark-700/30 hover:bg-dark-700/20 cursor-pointer transition-colors"
                      onClick={() => navigate(`/ts/${featureKey}/${item.id}`)}
                    >
                      <td className="px-4 py-3 text-dark-400 text-xs font-mono">{item.id}</td>
                      {feature.isCsam ? (
                        <>
                          <td className="px-4 py-3 font-mono text-xs text-white">
                            {item.hash_value ? item.hash_value.slice(0, 16) + '…' : '—'}
                          </td>
                          <td className="px-4 py-3 text-dark-300 text-xs">{item.hash_algorithm || '—'}</td>
                          <td className="px-4 py-3 text-dark-300 text-xs">{item.match_source || '—'}</td>
                          <td className="px-4 py-3"><SeverityBadge label={item.severity_label} /></td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 text-white font-medium max-w-xs truncate">
                            {displayKey(item)}
                          </td>
                          <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                        </>
                      )}
                      <td className="px-4 py-3 text-dark-500 text-xs whitespace-nowrap">
                        {item.created_at ? new Date(item.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <Btn size="sm" onClick={() => navigate(`/ts/${featureKey}/${item.id}`)}>View</Btn>
                          <Btn size="sm" onClick={() => navigate(`/ts/${featureKey}/${item.id}/edit`)}>Edit</Btn>
                          <Btn size="sm" variant="danger" onClick={() => handleDelete(item.id)}>Del</Btn>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-dark-400">
              <span>{pagination.total} total records</span>
              <div className="flex gap-2">
                <Btn size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</Btn>
                <span className="px-3 py-1.5 text-white">Page {page} / {pagination.totalPages}</span>
                <Btn size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>Next →</Btn>
              </div>
            </div>
          )}
        </>
      )}

      <Toast message={toastMsg} />
    </div>
  );
}
