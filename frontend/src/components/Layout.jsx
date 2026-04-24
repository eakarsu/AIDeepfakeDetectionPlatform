import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FEATURES, api } from '../services/api';

const icons = {
  Camera: '📷', Video: '🎬', Mic: '🎙️', Users: '👥', Cpu: '🤖', FileSearch: '🔍',
  Layers: '📚', Activity: '📡', Shield: '🛡️', Globe: '🌐', Key: '🔑', History: '📋',
  AlertTriangle: '⚠️', UserCog: '👤', ClipboardCheck: '✅'
};

export default function Layout({ children, user, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    api.getUnreadCount().then(data => setUnreadCount(data.count)).catch(() => {});
    const interval = setInterval(() => {
      api.getUnreadCount().then(data => setUnreadCount(data.count)).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const navItem = (path, label, icon, badge) => (
    <button
      onClick={() => navigate(path)}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm mb-0.5 transition-colors ${location.pathname === path ? 'bg-blue-500/20 text-blue-400' : 'text-dark-300 hover:bg-dark-700/50 hover:text-white'}`}
    >
      <span className="text-base">{icon}</span>
      {sidebarOpen && <span className="flex-1 text-left">{label}</span>}
      {sidebarOpen && badge > 0 && (
        <span className="px-1.5 py-0.5 bg-red-500 text-white text-[10px] rounded-full font-bold min-w-[18px] text-center">{badge}</span>
      )}
    </button>
  );

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-dark-900/80 backdrop-blur-xl border-r border-dark-700/50 transition-all duration-300 flex flex-col`}>
        {/* Logo */}
        <div className="p-4 border-b border-dark-700/50 flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center font-bold text-lg cursor-pointer" onClick={() => navigate('/')}>
            DF
          </div>
          {sidebarOpen && (
            <div className="cursor-pointer" onClick={() => navigate('/')}>
              <div className="font-bold text-sm">DeepfakeGuard</div>
              <div className="text-xs text-dark-400">AI Detection Platform</div>
            </div>
          )}
        </div>

        {/* Toggle */}
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 mx-2 mt-2 text-dark-400 hover:text-white hover:bg-dark-700/50 rounded-lg text-xs text-center">
          {sidebarOpen ? '◀ Collapse' : '▶'}
        </button>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2 px-2">
          <div className={`${sidebarOpen ? 'mb-2 px-2 text-xs font-semibold text-dark-500 uppercase tracking-wider' : 'hidden'}`}>
            Dashboard
          </div>
          {navItem('/', 'Overview', '🏠')}
          {navItem('/analytics', 'Analytics', '📊')}
          {navItem('/search', 'Search', '🔍')}

          <div className={`${sidebarOpen ? 'mt-4 mb-2 px-2 text-xs font-semibold text-dark-500 uppercase tracking-wider' : 'mt-2 border-t border-dark-700/30 pt-2'}`}>
            {sidebarOpen ? 'Quick Access' : ''}
          </div>
          {navItem('/notifications', 'Notifications', '🔔', unreadCount)}
          {navItem('/bookmarks', 'Bookmarks', '⭐')}
          {navItem('/activity', 'Activity', '📜')}
          {navItem('/reports', 'Reports', '📑')}

          {['Detection', 'Forensics', 'Operations', 'Security', 'Intelligence', 'Administration', 'Reports'].map(cat => {
            const catFeatures = FEATURES.filter(f => f.category === cat);
            if (catFeatures.length === 0) return null;
            return (
              <div key={cat}>
                <div className={`${sidebarOpen ? 'mt-4 mb-2 px-2 text-xs font-semibold text-dark-500 uppercase tracking-wider' : 'mt-2 border-t border-dark-700/30 pt-2'}`}>
                  {sidebarOpen ? cat : ''}
                </div>
                {catFeatures.map(f => (
                  <button
                    key={f.key}
                    onClick={() => navigate(`/feature/${f.key}`)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm mb-0.5 transition-colors ${location.pathname.includes(f.key) ? 'bg-blue-500/20 text-blue-400' : 'text-dark-300 hover:bg-dark-700/50 hover:text-white'}`}
                  >
                    <span className="text-base">{icons[f.icon]}</span>
                    {sidebarOpen && <span className="truncate">{f.name}</span>}
                  </button>
                ))}
              </div>
            );
          })}
        </nav>

        {/* User section */}
        <div className="p-3 border-t border-dark-700/50">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setShowUserMenu(!showUserMenu)}>
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-xs font-bold">
              {user?.full_name?.charAt(0) || 'U'}
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{user?.full_name}</div>
                <div className="text-xs text-dark-400 truncate">{user?.role}</div>
              </div>
            )}
          </div>
          {sidebarOpen && showUserMenu && (
            <div className="mt-2 space-y-1">
              <button onClick={() => { navigate('/profile'); setShowUserMenu(false); }} className="w-full text-left px-3 py-1.5 text-xs text-dark-300 hover:bg-dark-700/50 hover:text-white rounded-lg transition-colors">
                Profile & Settings
              </button>
              <button onClick={onLogout} className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                Sign Out
              </button>
            </div>
          )}
          {sidebarOpen && !showUserMenu && (
            <button onClick={onLogout} className="mt-2 w-full px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
              Sign Out
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Top bar */}
        <div className="sticky top-0 z-10 bg-dark-900/80 backdrop-blur-xl border-b border-dark-700/50 px-6 py-3 flex items-center justify-between">
          <div className="text-sm text-dark-400">
            {location.pathname === '/' && 'Dashboard'}
            {location.pathname === '/analytics' && 'Analytics'}
            {location.pathname === '/search' && 'Global Search'}
            {location.pathname === '/notifications' && 'Notifications'}
            {location.pathname === '/bookmarks' && 'Bookmarks'}
            {location.pathname === '/activity' && 'Activity Feed'}
            {location.pathname === '/reports' && 'Report Builder'}
            {location.pathname === '/profile' && 'Profile'}
            {location.pathname.startsWith('/feature/') && (FEATURES.find(f => location.pathname.includes(f.key))?.name || 'Feature')}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/search')} className="text-dark-400 hover:text-white p-2 hover:bg-dark-700/50 rounded-lg transition-colors" title="Search">
              🔍
            </button>
            <button onClick={() => navigate('/notifications')} className="relative text-dark-400 hover:text-white p-2 hover:bg-dark-700/50 rounded-lg transition-colors" title="Notifications">
              🔔
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 px-1 py-0.5 bg-red-500 text-white text-[9px] rounded-full font-bold min-w-[14px] text-center leading-none">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            <button onClick={() => navigate('/profile')} className="w-7 h-7 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-[10px] font-bold hover:ring-2 hover:ring-blue-500/50 transition-all" title="Profile">
              {user?.full_name?.charAt(0) || 'U'}
            </button>
          </div>
        </div>
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
