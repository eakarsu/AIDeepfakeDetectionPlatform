import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

const typeColors = {
  info: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  success: 'bg-green-500/15 text-green-400 border-green-500/30',
  warning: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  error: 'bg-red-500/15 text-red-400 border-red-500/30',
  alert: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
};

const typeIcons = { info: 'i', success: '\u2713', warning: '!', error: '\u2715', alert: '\u26A1' };

export default function Notifications() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const data = await api.getNotifications();
      setNotifications(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleMarkRead = async (id) => {
    await api.markNotificationRead(id);
    setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const handleMarkAllRead = async () => {
    await api.markAllNotificationsRead();
    setNotifications(notifications.map(n => ({ ...n, is_read: true })));
  };

  const handleDelete = async (id) => {
    await api.deleteNotification(id);
    setNotifications(notifications.filter(n => n.id !== id));
  };

  const filtered = filter === 'unread' ? notifications.filter(n => !n.is_read) : notifications;
  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <button onClick={() => navigate('/')} className="text-dark-400 hover:text-white text-sm mb-2 flex items-center gap-1">\u2190 Back to Dashboard</button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Notifications</h1>
            <p className="text-dark-400 text-sm mt-1">{unreadCount} unread</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleMarkAllRead} className="px-4 py-2 bg-dark-700/80 border border-dark-600/50 rounded-xl text-xs hover:bg-dark-600/80">
              Mark all read
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {['all', 'unread'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f ? 'bg-blue-500/20 text-blue-400' : 'text-dark-400 hover:bg-dark-700/50'}`}>
            {f === 'all' ? 'All' : 'Unread'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500 mx-auto"></div></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-dark-800/50 rounded-xl border border-dark-700/30">
          <div className="text-dark-500 text-lg mb-1">No notifications</div>
          <div className="text-dark-500 text-sm">You're all caught up!</div>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(n => (
            <div key={n.id}
              className={`bg-dark-800/80 rounded-xl border p-4 flex items-start gap-3 transition-colors ${n.is_read ? 'border-dark-700/30' : 'border-blue-500/30 bg-blue-500/5'}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border flex-shrink-0 ${typeColors[n.type] || typeColors.info}`}>
                {typeIcons[n.type] || 'i'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium text-sm text-white">{n.title}</div>
                  <div className="text-[10px] text-dark-500 whitespace-nowrap">{new Date(n.created_at).toLocaleString()}</div>
                </div>
                {n.message && <div className="text-xs text-dark-400 mt-1">{n.message}</div>}
                <div className="flex items-center gap-2 mt-2">
                  {n.link && (
                    <button onClick={() => navigate(n.link)} className="text-xs text-blue-400 hover:text-blue-300">View \u2192</button>
                  )}
                  {!n.is_read && (
                    <button onClick={() => handleMarkRead(n.id)} className="text-xs text-dark-500 hover:text-dark-300">Mark read</button>
                  )}
                  <button onClick={() => handleDelete(n.id)} className="text-xs text-dark-500 hover:text-red-400">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
