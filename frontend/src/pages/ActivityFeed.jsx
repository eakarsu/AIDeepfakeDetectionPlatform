import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

const actionColors = {
  create: 'bg-green-500', update: 'bg-blue-500', delete: 'bg-red-500',
  bulk_delete: 'bg-red-500', bulk_update: 'bg-blue-500', export: 'bg-purple-500',
  upload: 'bg-cyan-500', comment: 'bg-yellow-500', bookmark: 'bg-pink-500',
  login: 'bg-emerald-500', analyze: 'bg-indigo-500',
};

export default function ActivityFeed() {
  const navigate = useNavigate();
  const [activities, setActivities] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const limit = 30;

  useEffect(() => {
    loadActivities();
  }, [page]);

  const loadActivities = async () => {
    setLoading(true);
    try {
      const data = await api.getActivity(limit, page * limit);
      setActivities(data.items);
      setTotal(data.total);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <button onClick={() => navigate('/')} className="text-dark-400 hover:text-white text-sm mb-2 flex items-center gap-1">\u2190 Back to Dashboard</button>
        <h1 className="text-2xl font-bold text-white">Activity Feed</h1>
        <p className="text-dark-400 text-sm mt-1">{total} total activities</p>
      </div>

      {loading ? (
        <div className="text-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500 mx-auto"></div></div>
      ) : activities.length === 0 ? (
        <div className="text-center py-12 bg-dark-800/50 rounded-xl border border-dark-700/30">
          <div className="text-dark-500">No activity yet</div>
        </div>
      ) : (
        <>
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-dark-700/50"></div>
            <div className="space-y-4">
              {activities.map(a => (
                <div key={a.id} className="relative pl-10">
                  <div className={`absolute left-[11px] w-2.5 h-2.5 rounded-full ${actionColors[a.action] || 'bg-dark-500'} ring-4 ring-dark-900`}></div>
                  <div className="bg-dark-800/80 rounded-xl border border-dark-700/50 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-sm font-medium text-white">{a.user_name || 'System'}</span>
                        <span className="text-sm text-dark-400"> {a.action.replace(/_/g, ' ')} </span>
                        {a.entity_title && <span className="text-sm text-blue-400">{a.entity_title}</span>}
                      </div>
                      <span className="text-[10px] text-dark-500 whitespace-nowrap">{new Date(a.created_at).toLocaleString()}</span>
                    </div>
                    {a.entity_type && (
                      <div className="mt-1 text-xs text-dark-500">{a.entity_type}{a.entity_id ? ` #${a.entity_id}` : ''}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
                className="px-3 py-1.5 bg-dark-700/80 rounded-lg text-xs disabled:opacity-30">Previous</button>
              <span className="text-xs text-dark-400">Page {page + 1} of {totalPages}</span>
              <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
                className="px-3 py-1.5 bg-dark-700/80 rounded-lg text-xs disabled:opacity-30">Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
