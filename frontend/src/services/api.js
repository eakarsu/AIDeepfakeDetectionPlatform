const API_BASE = '/api';

const getToken = () => localStorage.getItem('token');

const headers = () => ({
  'Content-Type': 'application/json',
  ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
});

const handleResponse = async (res) => {
  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
};

export const api = {
  // Auth
  login: (email, password) =>
    fetch(`${API_BASE}/auth/login`, { method: 'POST', headers: headers(), body: JSON.stringify({ email, password }) }).then(handleResponse),

  register: (data) =>
    fetch(`${API_BASE}/auth/register`, { method: 'POST', headers: headers(), body: JSON.stringify(data) }).then(handleResponse),

  getMe: () =>
    fetch(`${API_BASE}/auth/me`, { headers: headers() }).then(handleResponse),

  // Dashboard
  getStats: () =>
    fetch(`${API_BASE}/dashboard/stats`, { headers: headers() }).then(handleResponse),

  // Generic CRUD
  getAll: (feature) =>
    fetch(`${API_BASE}/${feature}`, { headers: headers() }).then(handleResponse),

  getOne: (feature, id) =>
    fetch(`${API_BASE}/${feature}/${id}`, { headers: headers() }).then(handleResponse),

  create: (feature, data) =>
    fetch(`${API_BASE}/${feature}`, { method: 'POST', headers: headers(), body: JSON.stringify(data) }).then(handleResponse),

  update: (feature, id, data) =>
    fetch(`${API_BASE}/${feature}/${id}`, { method: 'PUT', headers: headers(), body: JSON.stringify(data) }).then(handleResponse),

  remove: (feature, id) =>
    fetch(`${API_BASE}/${feature}/${id}`, { method: 'DELETE', headers: headers() }).then(handleResponse),

  analyze: (feature, id) =>
    fetch(`${API_BASE}/${feature}/${id}/analyze`, { method: 'POST', headers: headers() }).then(handleResponse),

  // Profile
  getProfile: () =>
    fetch(`${API_BASE}/profile`, { headers: headers() }).then(handleResponse),

  updateProfile: (data) =>
    fetch(`${API_BASE}/profile`, { method: 'PUT', headers: headers(), body: JSON.stringify(data) }).then(handleResponse),

  changePassword: (data) =>
    fetch(`${API_BASE}/profile/password`, { method: 'PUT', headers: headers(), body: JSON.stringify(data) }).then(handleResponse),

  // Notifications
  getNotifications: (unreadOnly = false) =>
    fetch(`${API_BASE}/notifications?unread_only=${unreadOnly}`, { headers: headers() }).then(handleResponse),

  getUnreadCount: () =>
    fetch(`${API_BASE}/notifications/unread-count`, { headers: headers() }).then(handleResponse),

  markNotificationRead: (id) =>
    fetch(`${API_BASE}/notifications/${id}/read`, { method: 'PUT', headers: headers() }).then(handleResponse),

  markAllNotificationsRead: () =>
    fetch(`${API_BASE}/notifications/read-all`, { method: 'PUT', headers: headers() }).then(handleResponse),

  deleteNotification: (id) =>
    fetch(`${API_BASE}/notifications/${id}`, { method: 'DELETE', headers: headers() }).then(handleResponse),

  createNotification: (data) =>
    fetch(`${API_BASE}/notifications`, { method: 'POST', headers: headers(), body: JSON.stringify(data) }).then(handleResponse),

  // Bookmarks
  getBookmarks: () =>
    fetch(`${API_BASE}/bookmarks`, { headers: headers() }).then(handleResponse),

  checkBookmark: (featureKey, itemId) =>
    fetch(`${API_BASE}/bookmarks/check/${featureKey}/${itemId}`, { headers: headers() }).then(handleResponse),

  toggleBookmark: (data) =>
    fetch(`${API_BASE}/bookmarks/toggle`, { method: 'POST', headers: headers(), body: JSON.stringify(data) }).then(handleResponse),

  deleteBookmark: (id) =>
    fetch(`${API_BASE}/bookmarks/${id}`, { method: 'DELETE', headers: headers() }).then(handleResponse),

  // Comments
  getComments: (featureKey, itemId) =>
    fetch(`${API_BASE}/comments/${featureKey}/${itemId}`, { headers: headers() }).then(handleResponse),

  addComment: (data) =>
    fetch(`${API_BASE}/comments`, { method: 'POST', headers: headers(), body: JSON.stringify(data) }).then(handleResponse),

  updateComment: (id, content) =>
    fetch(`${API_BASE}/comments/${id}`, { method: 'PUT', headers: headers(), body: JSON.stringify({ content }) }).then(handleResponse),

  deleteComment: (id) =>
    fetch(`${API_BASE}/comments/${id}`, { method: 'DELETE', headers: headers() }).then(handleResponse),

  // Tags
  getTags: () =>
    fetch(`${API_BASE}/tags`, { headers: headers() }).then(handleResponse),

  createTag: (data) =>
    fetch(`${API_BASE}/tags`, { method: 'POST', headers: headers(), body: JSON.stringify(data) }).then(handleResponse),

  deleteTag: (id) =>
    fetch(`${API_BASE}/tags/${id}`, { method: 'DELETE', headers: headers() }).then(handleResponse),

  getItemTags: (featureKey, itemId) =>
    fetch(`${API_BASE}/tags/${featureKey}/${itemId}`, { headers: headers() }).then(handleResponse),

  assignTag: (data) =>
    fetch(`${API_BASE}/tags/assign`, { method: 'POST', headers: headers(), body: JSON.stringify(data) }).then(handleResponse),

  removeTag: (featureKey, itemId, tagId) =>
    fetch(`${API_BASE}/tags/assign/${featureKey}/${itemId}/${tagId}`, { method: 'DELETE', headers: headers() }).then(handleResponse),

  // Export
  exportCSV: (featureKey) =>
    fetch(`${API_BASE}/export/${featureKey}/csv`, { headers: headers() }).then(res => res.blob()),

  exportJSON: (featureKey) =>
    fetch(`${API_BASE}/export/${featureKey}/json`, { headers: headers() }).then(res => res.blob()),

  // Activity
  getActivity: (limit = 50, offset = 0) =>
    fetch(`${API_BASE}/activity?limit=${limit}&offset=${offset}`, { headers: headers() }).then(handleResponse),

  // Upload
  uploadFile: (file, featureKey, itemId) => {
    const formData = new FormData();
    formData.append('file', file);
    if (featureKey) formData.append('feature_key', featureKey);
    if (itemId) formData.append('item_id', itemId);
    return fetch(`${API_BASE}/upload`, {
      method: 'POST',
      headers: { ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
      body: formData,
    }).then(handleResponse);
  },

  getUploads: (featureKey, itemId) =>
    fetch(`${API_BASE}/uploads/${featureKey}/${itemId}`, { headers: headers() }).then(handleResponse),

  deleteUpload: (id) =>
    fetch(`${API_BASE}/uploads/${id}`, { method: 'DELETE', headers: headers() }).then(handleResponse),

  // Reports
  getReports: () =>
    fetch(`${API_BASE}/reports`, { headers: headers() }).then(handleResponse),

  getReport: (id) =>
    fetch(`${API_BASE}/reports/${id}`, { headers: headers() }).then(handleResponse),

  createReport: (data) =>
    fetch(`${API_BASE}/reports`, { method: 'POST', headers: headers(), body: JSON.stringify(data) }).then(handleResponse),

  deleteReport: (id) =>
    fetch(`${API_BASE}/reports/${id}`, { method: 'DELETE', headers: headers() }).then(handleResponse),

  // Bulk operations
  bulkDelete: (featureKey, ids) =>
    fetch(`${API_BASE}/bulk/${featureKey}/delete`, { method: 'POST', headers: headers(), body: JSON.stringify({ ids }) }).then(handleResponse),

  bulkUpdateStatus: (featureKey, ids, status) =>
    fetch(`${API_BASE}/bulk/${featureKey}/status`, { method: 'PUT', headers: headers(), body: JSON.stringify({ ids, status }) }).then(handleResponse),

  bulkUpdateRisk: (featureKey, ids, risk_level) =>
    fetch(`${API_BASE}/bulk/${featureKey}/risk`, { method: 'PUT', headers: headers(), body: JSON.stringify({ ids, risk_level }) }).then(handleResponse),

  // Analytics
  getAnalytics: () =>
    fetch(`${API_BASE}/analytics/overview`, { headers: headers() }).then(handleResponse),

  // Search
  globalSearch: (params) => {
    const searchParams = new URLSearchParams(params).toString();
    return fetch(`${API_BASE}/search?${searchParams}`, { headers: headers() }).then(handleResponse);
  },

  // Compare
  compareItems: (items) =>
    fetch(`${API_BASE}/compare`, { method: 'POST', headers: headers(), body: JSON.stringify({ items }) }).then(handleResponse),
};

export const FEATURES = [
  { key: 'image-scans', name: 'Image Scans', icon: 'Camera', color: 'from-blue-500 to-blue-700', description: 'Detect deepfake images using AI analysis', category: 'Detection' },
  { key: 'video-scans', name: 'Video Scans', icon: 'Video', color: 'from-purple-500 to-purple-700', description: 'Analyze videos for deepfake manipulation', category: 'Detection' },
  { key: 'audio-scans', name: 'Audio Scans', icon: 'Mic', color: 'from-green-500 to-green-700', description: 'Detect synthetic and cloned voices', category: 'Detection' },
  { key: 'face-swap-detections', name: 'Face Swap Detection', icon: 'Users', color: 'from-red-500 to-red-700', description: 'Identify face swap manipulations', category: 'Detection' },
  { key: 'gan-detections', name: 'GAN Detection', icon: 'Cpu', color: 'from-yellow-500 to-yellow-700', description: 'Detect GAN-generated content', category: 'Detection' },
  { key: 'metadata-analyses', name: 'Metadata Analysis', icon: 'FileSearch', color: 'from-cyan-500 to-cyan-700', description: 'Forensic file metadata analysis', category: 'Forensics' },
  { key: 'batch-scans', name: 'Batch Scanning', icon: 'Layers', color: 'from-indigo-500 to-indigo-700', description: 'Bulk file scanning operations', category: 'Operations' },
  { key: 'realtime-monitors', name: 'Real-time Monitoring', icon: 'Activity', color: 'from-emerald-500 to-emerald-700', description: 'Live feed deepfake monitoring', category: 'Operations' },
  { key: 'election-verifications', name: 'Election Security', icon: 'Shield', color: 'from-rose-500 to-rose-700', description: 'Political content verification', category: 'Security' },
  { key: 'social-media-scans', name: 'Social Media Scanner', icon: 'Globe', color: 'from-orange-500 to-orange-700', description: 'Social platform deepfake scanning', category: 'Security' },
  { key: 'api-keys', name: 'API Management', icon: 'Key', color: 'from-slate-500 to-slate-700', description: 'Manage enterprise API keys', category: 'Administration' },
  { key: 'scan-history', name: 'Scan History', icon: 'History', color: 'from-teal-500 to-teal-700', description: 'Historical scan results & reports', category: 'Reports' },
  { key: 'threat-intelligence', name: 'Threat Intelligence', icon: 'AlertTriangle', color: 'from-amber-500 to-amber-700', description: 'Track deepfake threats globally', category: 'Intelligence' },
  { key: 'users', name: 'User Management', icon: 'UserCog', color: 'from-pink-500 to-pink-700', description: 'Manage users and roles', category: 'Administration' },
  { key: 'audit-logs', name: 'Audit & Compliance', icon: 'ClipboardCheck', color: 'from-violet-500 to-violet-700', description: 'Audit logs and compliance tracking', category: 'Reports' },
];
