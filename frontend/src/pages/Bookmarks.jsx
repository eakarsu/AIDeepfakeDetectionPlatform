import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, FEATURES } from '../services/api';

export default function Bookmarks() {
  const navigate = useNavigate();
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getBookmarks().then(setBookmarks).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleRemove = async (id) => {
    await api.deleteBookmark(id);
    setBookmarks(bookmarks.filter(b => b.id !== id));
  };

  const getFeatureName = (key) => FEATURES.find(f => f.key === key)?.name || key;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <button onClick={() => navigate('/')} className="text-dark-400 hover:text-white text-sm mb-2 flex items-center gap-1">\u2190 Back to Dashboard</button>
        <h1 className="text-2xl font-bold text-white">Bookmarks</h1>
        <p className="text-dark-400 text-sm mt-1">{bookmarks.length} saved items</p>
      </div>

      {loading ? (
        <div className="text-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500 mx-auto"></div></div>
      ) : bookmarks.length === 0 ? (
        <div className="text-center py-12 bg-dark-800/50 rounded-xl border border-dark-700/30">
          <div className="text-dark-500 text-lg mb-1">No bookmarks yet</div>
          <div className="text-dark-500 text-sm">Bookmark items from any feature to access them quickly</div>
        </div>
      ) : (
        <div className="space-y-2">
          {bookmarks.map(b => (
            <div key={b.id} className="bg-dark-800/80 rounded-xl border border-dark-700/50 p-4 flex items-center justify-between hover:border-dark-600/80 transition-colors">
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/feature/${b.feature_key}/${b.item_id}`)}>
                <div className="font-medium text-sm text-white">{b.item_title || `Item #${b.item_id}`}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-blue-400">{getFeatureName(b.feature_key)}</span>
                  <span className="text-xs text-dark-500">#{b.item_id}</span>
                  <span className="text-xs text-dark-500">{new Date(b.created_at).toLocaleDateString()}</span>
                </div>
                {b.note && <div className="text-xs text-dark-400 mt-1">{b.note}</div>}
              </div>
              <button onClick={() => handleRemove(b.id)} className="text-dark-500 hover:text-red-400 text-xs ml-3">Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
