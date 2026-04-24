import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import FeatureList from './pages/FeatureList';
import FeatureDetail from './pages/FeatureDetail';
import FeatureForm from './pages/FeatureForm';
import Layout from './components/Layout';
import Profile from './pages/Profile';
import Analytics from './pages/Analytics';
import Notifications from './pages/Notifications';
import Bookmarks from './pages/Bookmarks';
import ActivityFeed from './pages/ActivityFeed';
import ReportBuilder from './pages/ReportBuilder';
import GlobalSearch from './pages/GlobalSearch';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login onLogin={handleLogin} />} />
        <Route path="/" element={user ? <Layout user={user} onLogout={handleLogout}><Dashboard /></Layout> : <Navigate to="/login" />} />
        <Route path="/feature/:featureKey" element={user ? <Layout user={user} onLogout={handleLogout}><FeatureList /></Layout> : <Navigate to="/login" />} />
        <Route path="/feature/:featureKey/new" element={user ? <Layout user={user} onLogout={handleLogout}><FeatureForm /></Layout> : <Navigate to="/login" />} />
        <Route path="/feature/:featureKey/:id" element={user ? <Layout user={user} onLogout={handleLogout}><FeatureDetail /></Layout> : <Navigate to="/login" />} />
        <Route path="/feature/:featureKey/:id/edit" element={user ? <Layout user={user} onLogout={handleLogout}><FeatureForm /></Layout> : <Navigate to="/login" />} />
        <Route path="/profile" element={user ? <Layout user={user} onLogout={handleLogout}><Profile /></Layout> : <Navigate to="/login" />} />
        <Route path="/analytics" element={user ? <Layout user={user} onLogout={handleLogout}><Analytics /></Layout> : <Navigate to="/login" />} />
        <Route path="/notifications" element={user ? <Layout user={user} onLogout={handleLogout}><Notifications /></Layout> : <Navigate to="/login" />} />
        <Route path="/bookmarks" element={user ? <Layout user={user} onLogout={handleLogout}><Bookmarks /></Layout> : <Navigate to="/login" />} />
        <Route path="/activity" element={user ? <Layout user={user} onLogout={handleLogout}><ActivityFeed /></Layout> : <Navigate to="/login" />} />
        <Route path="/reports" element={user ? <Layout user={user} onLogout={handleLogout}><ReportBuilder /></Layout> : <Navigate to="/login" />} />
        <Route path="/search" element={user ? <Layout user={user} onLogout={handleLogout}><GlobalSearch /></Layout> : <Navigate to="/login" />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
