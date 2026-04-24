import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export default function Profile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.getProfile().then(data => {
      setProfile(data);
      setFormData({ full_name: data.full_name, organization: data.organization || '' });
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setError(''); setMessage('');
    try {
      const updated = await api.updateProfile(formData);
      setProfile({ ...profile, ...updated });
      setEditing(false);
      setMessage('Profile updated successfully');
      // Update localStorage
      const savedUser = JSON.parse(localStorage.getItem('user') || '{}');
      localStorage.setItem('user', JSON.stringify({ ...savedUser, full_name: updated.full_name, organization: updated.organization }));
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handlePasswordChange = async () => {
    setError(''); setMessage('');
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setError('New passwords do not match');
      return;
    }
    if (passwordForm.new_password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    try {
      await api.changePassword({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      setMessage('Password changed successfully');
      setShowPasswordForm(false);
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500 mx-auto mb-3"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <button onClick={() => navigate('/')} className="text-dark-400 hover:text-white text-sm mb-2 flex items-center gap-1">
          ← Back to Dashboard
        </button>
        <h1 className="text-2xl font-bold text-white">Profile & Settings</h1>
      </div>

      {message && (
        <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm">{message}</div>
      )}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>
      )}

      {/* Profile Card */}
      <div className="bg-dark-800/80 backdrop-blur rounded-xl border border-dark-700/50 p-6 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center text-2xl font-bold">
            {profile?.full_name?.charAt(0) || 'U'}
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{profile?.full_name}</h2>
            <p className="text-dark-400">{profile?.email}</p>
            <span className="inline-block mt-1 px-2.5 py-0.5 bg-blue-500/15 text-blue-400 rounded-full text-xs font-medium">{profile?.role}</span>
          </div>
        </div>

        {editing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-dark-300 mb-1.5">Full Name</label>
              <input type="text" value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full px-4 py-2.5 bg-dark-700/50 border border-dark-600/50 rounded-xl text-white focus:outline-none focus:border-blue-500/50 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-dark-300 mb-1.5">Organization</label>
              <input type="text" value={formData.organization} onChange={e => setFormData({ ...formData, organization: e.target.value })}
                className="w-full px-4 py-2.5 bg-dark-700/50 border border-dark-600/50 rounded-xl text-white focus:outline-none focus:border-blue-500/50 text-sm" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleSave} className="px-5 py-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl text-sm font-medium">Save</button>
              <button onClick={() => setEditing(false)} className="px-5 py-2 bg-dark-700/80 border border-dark-600/50 rounded-xl text-sm">Cancel</button>
            </div>
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-dark-700/30 rounded-lg p-3">
                <div className="text-xs text-dark-400 mb-1">Full Name</div>
                <div className="text-sm text-white">{profile?.full_name}</div>
              </div>
              <div className="bg-dark-700/30 rounded-lg p-3">
                <div className="text-xs text-dark-400 mb-1">Email</div>
                <div className="text-sm text-white">{profile?.email}</div>
              </div>
              <div className="bg-dark-700/30 rounded-lg p-3">
                <div className="text-xs text-dark-400 mb-1">Organization</div>
                <div className="text-sm text-white">{profile?.organization || 'N/A'}</div>
              </div>
              <div className="bg-dark-700/30 rounded-lg p-3">
                <div className="text-xs text-dark-400 mb-1">Role</div>
                <div className="text-sm text-white capitalize">{profile?.role}</div>
              </div>
              <div className="bg-dark-700/30 rounded-lg p-3">
                <div className="text-xs text-dark-400 mb-1">Last Login</div>
                <div className="text-sm text-white">{profile?.last_login ? new Date(profile.last_login).toLocaleString() : 'N/A'}</div>
              </div>
              <div className="bg-dark-700/30 rounded-lg p-3">
                <div className="text-xs text-dark-400 mb-1">Member Since</div>
                <div className="text-sm text-white">{profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A'}</div>
              </div>
            </div>
            <button onClick={() => setEditing(true)} className="px-5 py-2 bg-dark-700/80 border border-dark-600/50 rounded-xl text-sm hover:bg-dark-600/80">
              Edit Profile
            </button>
          </div>
        )}
      </div>

      {/* Change Password */}
      <div className="bg-dark-800/80 backdrop-blur rounded-xl border border-dark-700/50 p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <div className="w-1 h-5 bg-yellow-500 rounded-full"></div>
          Security
        </h3>
        {showPasswordForm ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-dark-300 mb-1.5">Current Password</label>
              <input type="password" value={passwordForm.current_password} onChange={e => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                className="w-full px-4 py-2.5 bg-dark-700/50 border border-dark-600/50 rounded-xl text-white focus:outline-none focus:border-blue-500/50 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-dark-300 mb-1.5">New Password</label>
              <input type="password" value={passwordForm.new_password} onChange={e => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                className="w-full px-4 py-2.5 bg-dark-700/50 border border-dark-600/50 rounded-xl text-white focus:outline-none focus:border-blue-500/50 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-dark-300 mb-1.5">Confirm New Password</label>
              <input type="password" value={passwordForm.confirm_password} onChange={e => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                className="w-full px-4 py-2.5 bg-dark-700/50 border border-dark-600/50 rounded-xl text-white focus:outline-none focus:border-blue-500/50 text-sm" />
            </div>
            <div className="flex gap-2">
              <button onClick={handlePasswordChange} className="px-5 py-2 bg-yellow-500/20 border border-yellow-500/30 rounded-xl text-sm text-yellow-400 hover:bg-yellow-500/30">Change Password</button>
              <button onClick={() => { setShowPasswordForm(false); setPasswordForm({ current_password: '', new_password: '', confirm_password: '' }); }}
                className="px-5 py-2 bg-dark-700/80 border border-dark-600/50 rounded-xl text-sm">Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowPasswordForm(true)} className="px-5 py-2 bg-dark-700/80 border border-dark-600/50 rounded-xl text-sm hover:bg-dark-600/80">
            Change Password
          </button>
        )}
      </div>

      {/* Account Info */}
      <div className="bg-dark-800/80 backdrop-blur rounded-xl border border-dark-700/50 p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <div className="w-1 h-5 bg-green-500 rounded-full"></div>
          Account Status
        </h3>
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${profile?.is_active ? 'bg-green-500' : 'bg-red-500'}`}></span>
          <span className="text-sm text-dark-300">{profile?.is_active ? 'Active' : 'Inactive'}</span>
        </div>
      </div>
    </div>
  );
}
