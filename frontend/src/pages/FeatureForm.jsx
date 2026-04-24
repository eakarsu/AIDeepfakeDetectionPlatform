import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, FEATURES } from '../services/api';

// Define form fields for each feature
const featureFields = {
  'image-scans': [
    { name: 'title', label: 'Title', type: 'text', required: true },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'file_name', label: 'File Name', type: 'text' },
    { name: 'file_size', label: 'File Size', type: 'text', placeholder: 'e.g. 4.2 MB' },
    { name: 'format', label: 'Format', type: 'select', options: ['JPEG', 'PNG', 'TIFF', 'WEBP', 'BMP', 'GIF'] },
    { name: 'resolution', label: 'Resolution', type: 'text', placeholder: 'e.g. 1920x1080' },
    { name: 'source_url', label: 'Source URL', type: 'text' },
    { name: 'status', label: 'Status', type: 'select', options: ['pending', 'analyzing', 'analyzed', 'completed'] },
    { name: 'risk_level', label: 'Risk Level', type: 'select', options: ['low', 'medium', 'high', 'critical'] },
  ],
  'video-scans': [
    { name: 'title', label: 'Title', type: 'text', required: true },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'file_name', label: 'File Name', type: 'text' },
    { name: 'file_size', label: 'File Size', type: 'text' },
    { name: 'format', label: 'Format', type: 'select', options: ['MP4', 'AVI', 'MOV', 'MKV', 'WEBM'] },
    { name: 'duration', label: 'Duration', type: 'text', placeholder: 'e.g. 02:34' },
    { name: 'resolution', label: 'Resolution', type: 'text' },
    { name: 'frame_count', label: 'Frame Count', type: 'number' },
    { name: 'status', label: 'Status', type: 'select', options: ['pending', 'analyzing', 'analyzed', 'completed'] },
    { name: 'risk_level', label: 'Risk Level', type: 'select', options: ['low', 'medium', 'high', 'critical'] },
  ],
  'audio-scans': [
    { name: 'title', label: 'Title', type: 'text', required: true },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'file_name', label: 'File Name', type: 'text' },
    { name: 'file_size', label: 'File Size', type: 'text' },
    { name: 'format', label: 'Format', type: 'select', options: ['WAV', 'MP3', 'OGG', 'FLAC', 'AAC'] },
    { name: 'duration', label: 'Duration', type: 'text' },
    { name: 'sample_rate', label: 'Sample Rate', type: 'text', placeholder: 'e.g. 44100 Hz' },
    { name: 'status', label: 'Status', type: 'select', options: ['pending', 'analyzing', 'analyzed', 'completed'] },
    { name: 'risk_level', label: 'Risk Level', type: 'select', options: ['low', 'medium', 'high', 'critical'] },
  ],
  'face-swap-detections': [
    { name: 'title', label: 'Title', type: 'text', required: true },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'source_image', label: 'Source Image', type: 'text' },
    { name: 'target_image', label: 'Target Image', type: 'text' },
    { name: 'swap_type', label: 'Swap Type', type: 'select', options: ['Face2Face', 'DeepFaceLab', 'FaceSwap', 'SimSwap', 'FSGAN', 'FaceShifter', 'StyleGAN'] },
    { name: 'faces_detected', label: 'Faces Detected', type: 'number' },
    { name: 'status', label: 'Status', type: 'select', options: ['pending', 'analyzing', 'analyzed', 'completed'] },
    { name: 'risk_level', label: 'Risk Level', type: 'select', options: ['low', 'medium', 'high', 'critical'] },
  ],
  'gan-detections': [
    { name: 'title', label: 'Title', type: 'text', required: true },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'file_name', label: 'File Name', type: 'text' },
    { name: 'gan_type', label: 'GAN Type', type: 'select', options: ['StyleGAN3', 'DALL-E 3', 'Midjourney v6', 'Stable Diffusion XL', 'ProGAN', 'BigGAN', 'CycleGAN', 'Imagen', 'Flux', 'Other'] },
    { name: 'artifacts_found', label: 'Artifacts Found', type: 'textarea' },
    { name: 'status', label: 'Status', type: 'select', options: ['pending', 'analyzing', 'analyzed', 'completed'] },
    { name: 'risk_level', label: 'Risk Level', type: 'select', options: ['low', 'medium', 'high', 'critical'] },
  ],
  'metadata-analyses': [
    { name: 'title', label: 'Title', type: 'text', required: true },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'file_name', label: 'File Name', type: 'text' },
    { name: 'file_type', label: 'File Type', type: 'select', options: ['JPEG', 'PNG', 'PDF', 'MP4', 'WAV', 'EML', 'BIN', 'TIFF', 'JSON', 'Other'] },
    { name: 'tampering_indicators', label: 'Tampering Indicators', type: 'textarea' },
    { name: 'status', label: 'Status', type: 'select', options: ['pending', 'analyzing', 'analyzed', 'completed'] },
    { name: 'risk_level', label: 'Risk Level', type: 'select', options: ['low', 'medium', 'high', 'critical'] },
  ],
  'batch-scans': [
    { name: 'title', label: 'Title', type: 'text', required: true },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'batch_name', label: 'Batch Name', type: 'text' },
    { name: 'total_files', label: 'Total Files', type: 'number' },
    { name: 'completed_files', label: 'Completed Files', type: 'number' },
    { name: 'flagged_files', label: 'Flagged Files', type: 'number' },
    { name: 'scan_type', label: 'Scan Type', type: 'select', options: ['image', 'video', 'audio', 'document', 'mixed', 'image+video', 'document+image'] },
    { name: 'status', label: 'Status', type: 'select', options: ['pending', 'analyzing', 'completed'] },
    { name: 'risk_level', label: 'Risk Level', type: 'select', options: ['low', 'medium', 'high', 'critical'] },
  ],
  'realtime-monitors': [
    { name: 'title', label: 'Title', type: 'text', required: true },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'monitor_name', label: 'Monitor Name', type: 'text' },
    { name: 'source_url', label: 'Source URL', type: 'text' },
    { name: 'monitor_type', label: 'Monitor Type', type: 'select', options: ['social_media', 'broadcast', 'video_platform', 'messaging', 'dark_web', 'news_wire', 'audio_platform', 'marketplace', 'official'] },
    { name: 'alert_threshold', label: 'Alert Threshold (%)', type: 'number' },
    { name: 'is_active', label: 'Active', type: 'select', options: ['true', 'false'] },
    { name: 'status', label: 'Status', type: 'select', options: ['active', 'paused', 'alert'] },
    { name: 'risk_level', label: 'Risk Level', type: 'select', options: ['low', 'medium', 'high', 'critical'] },
  ],
  'election-verifications': [
    { name: 'title', label: 'Title', type: 'text', required: true },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'content_type', label: 'Content Type', type: 'select', options: ['video', 'audio', 'image', 'document'] },
    { name: 'politician_name', label: 'Politician Name', type: 'text' },
    { name: 'party', label: 'Party', type: 'text' },
    { name: 'verification_status', label: 'Verification Status', type: 'select', options: ['unverified', 'verified', 'manipulated', 'fabricated', 'confirmed_fake', 'authentic', 'inconclusive', 'debunked', 'legitimate', 'ai_generated'] },
    { name: 'status', label: 'Status', type: 'select', options: ['pending', 'analyzing', 'analyzed'] },
    { name: 'risk_level', label: 'Risk Level', type: 'select', options: ['low', 'medium', 'high', 'critical'] },
  ],
  'social-media-scans': [
    { name: 'title', label: 'Title', type: 'text', required: true },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'platform', label: 'Platform', type: 'select', options: ['Twitter/X', 'Instagram', 'Facebook', 'TikTok', 'YouTube', 'Reddit', 'LinkedIn', 'Telegram', 'Snapchat', 'Pinterest', 'WhatsApp'] },
    { name: 'account_name', label: 'Account Name', type: 'text' },
    { name: 'content_type', label: 'Content Type', type: 'select', options: ['video', 'image', 'text', 'mixed'] },
    { name: 'followers_count', label: 'Followers Count', type: 'number' },
    { name: 'engagement_rate', label: 'Engagement Rate (%)', type: 'number' },
    { name: 'status', label: 'Status', type: 'select', options: ['pending', 'analyzing', 'analyzed'] },
    { name: 'risk_level', label: 'Risk Level', type: 'select', options: ['low', 'medium', 'high', 'critical'] },
  ],
  'api-keys': [
    { name: 'title', label: 'Title', type: 'text', required: true },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'key_name', label: 'Key Name', type: 'text' },
    { name: 'permissions', label: 'Permissions', type: 'text', placeholder: 'e.g. scan:read,scan:write,analyze' },
    { name: 'rate_limit', label: 'Rate Limit (per day)', type: 'number' },
    { name: 'is_active', label: 'Active', type: 'select', options: ['true', 'false'] },
    { name: 'status', label: 'Status', type: 'select', options: ['active', 'inactive', 'suspended', 'rate_limited'] },
  ],
  'scan-history': [
    { name: 'title', label: 'Title', type: 'text', required: true },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'scan_type', label: 'Scan Type', type: 'select', options: ['image', 'video', 'audio', 'face_swap', 'gan', 'metadata', 'batch', 'social_media', 'election', 'realtime', 'api', 'threat_intel', 'compliance'] },
    { name: 'file_name', label: 'File Name', type: 'text' },
    { name: 'result_summary', label: 'Result Summary', type: 'textarea' },
    { name: 'scan_duration', label: 'Scan Duration', type: 'text' },
    { name: 'status', label: 'Status', type: 'select', options: ['completed', 'failed', 'pending'] },
    { name: 'risk_level', label: 'Risk Level', type: 'select', options: ['low', 'medium', 'high', 'critical'] },
  ],
  'threat-intelligence': [
    { name: 'title', label: 'Title', type: 'text', required: true },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'threat_type', label: 'Threat Type', type: 'select', options: ['state_sponsored', 'organized_crime', 'botnet', 'cybercrime', 'dark_market', 'disinformation', 'espionage', 'exploitation', 'fraud', 'academic_fraud', 'legal_threat'] },
    { name: 'severity', label: 'Severity', type: 'select', options: ['low', 'medium', 'high', 'critical'] },
    { name: 'source', label: 'Source', type: 'text' },
    { name: 'indicators', label: 'Indicators', type: 'textarea' },
    { name: 'mitigation', label: 'Mitigation', type: 'textarea' },
    { name: 'affected_regions', label: 'Affected Regions', type: 'text' },
    { name: 'status', label: 'Status', type: 'select', options: ['active', 'monitoring', 'emerging', 'resolved'] },
    { name: 'risk_level', label: 'Risk Level', type: 'select', options: ['low', 'medium', 'high', 'critical'] },
  ],
  'users': [
    { name: 'email', label: 'Email', type: 'email', required: true },
    { name: 'full_name', label: 'Full Name', type: 'text', required: true },
    { name: 'password', label: 'Password', type: 'password', createOnly: true },
    { name: 'role', label: 'Role', type: 'select', options: ['admin', 'analyst', 'reviewer', 'manager', 'researcher', 'enterprise', 'auditor', 'intern', 'contractor', 'partner', 'api_user'] },
    { name: 'organization', label: 'Organization', type: 'text' },
    { name: 'is_active', label: 'Active', type: 'select', options: ['true', 'false'] },
  ],
  'audit-logs': [
    { name: 'title', label: 'Title', type: 'text', required: true },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'action', label: 'Action', type: 'select', options: ['login', 'login_failed', 'create', 'update', 'delete', 'execute', 'export', 'anomaly', 'config', 'access_denied', 'generate', 'emergency'] },
    { name: 'entity_type', label: 'Entity Type', type: 'text' },
    { name: 'entity_id', label: 'Entity ID', type: 'number' },
    { name: 'user_email', label: 'User Email', type: 'text' },
    { name: 'ip_address', label: 'IP Address', type: 'text' },
    { name: 'status', label: 'Status', type: 'select', options: ['logged', 'flagged'] },
    { name: 'risk_level', label: 'Risk Level', type: 'select', options: ['low', 'medium', 'high', 'critical'] },
  ],
};

export default function FeatureForm() {
  const { featureKey, id } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const feature = FEATURES.find(f => f.key === featureKey);
  const isEdit = !!id;
  const fields = featureFields[featureKey] || [
    { name: 'title', label: 'Title', type: 'text', required: true },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'status', label: 'Status', type: 'select', options: ['pending', 'analyzing', 'analyzed', 'completed'] },
    { name: 'risk_level', label: 'Risk Level', type: 'select', options: ['low', 'medium', 'high', 'critical'] },
  ];

  useEffect(() => {
    if (id) {
      api.getOne(featureKey, id)
        .then(data => {
          const initial = {};
          fields.forEach(f => {
            if (data[f.name] !== undefined && data[f.name] !== null) {
              initial[f.name] = String(data[f.name]);
            }
          });
          setFormData(initial);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [featureKey, id]);

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      // Process data types
      const data = { ...formData };
      fields.forEach(f => {
        if (f.type === 'number' && data[f.name]) {
          data[f.name] = Number(data[f.name]);
        }
        if (f.name === 'is_active' && data[f.name]) {
          data[f.name] = data[f.name] === 'true';
        }
      });

      if (isEdit) {
        await api.update(featureKey, id, data);
        navigate(`/feature/${featureKey}/${id}`);
      } else {
        const result = await api.create(featureKey, data);
        navigate(`/feature/${featureKey}/${result.id}`);
      }
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
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
    <div>
      <div className="mb-6">
        <button onClick={() => navigate(isEdit ? `/feature/${featureKey}/${id}` : `/feature/${featureKey}`)} className="text-dark-400 hover:text-white text-sm mb-2 flex items-center gap-1">
          ← Back
        </button>
        <h1 className="text-2xl font-bold text-white">
          {isEdit ? 'Edit' : 'New'} {feature?.name || featureKey}
        </h1>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-dark-800/80 backdrop-blur rounded-xl border border-dark-700/50 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fields
            .filter(f => !isEdit || !f.createOnly)
            .map(field => (
              <div key={field.name} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                <label className="block text-sm text-dark-300 mb-1.5">
                  {field.label}
                  {field.required && <span className="text-red-400 ml-1">*</span>}
                </label>

                {field.type === 'textarea' ? (
                  <textarea
                    value={formData[field.name] || ''}
                    onChange={e => handleChange(field.name, e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2.5 bg-dark-700/50 border border-dark-600/50 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 text-sm resize-none"
                    placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                    required={field.required}
                  />
                ) : field.type === 'select' ? (
                  <select
                    value={formData[field.name] || ''}
                    onChange={e => handleChange(field.name, e.target.value)}
                    className="w-full px-4 py-2.5 bg-dark-700/50 border border-dark-600/50 rounded-xl text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 text-sm"
                    required={field.required}
                  >
                    <option value="">Select {field.label}</option>
                    {field.options.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.type}
                    value={formData[field.name] || ''}
                    onChange={e => handleChange(field.name, e.target.value)}
                    className="w-full px-4 py-2.5 bg-dark-700/50 border border-dark-600/50 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 text-sm"
                    placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                    required={field.required}
                  />
                )}
              </div>
            ))}
        </div>

        <div className="flex items-center gap-3 mt-6 pt-4 border-t border-dark-700/30">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl font-medium text-sm hover:from-blue-600 hover:to-purple-700 transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50"
          >
            {saving ? 'Saving...' : isEdit ? 'Update' : 'Create'}
          </button>
          <button
            type="button"
            onClick={() => navigate(isEdit ? `/feature/${featureKey}/${id}` : `/feature/${featureKey}`)}
            className="px-6 py-2.5 bg-dark-700/80 border border-dark-600/50 rounded-xl font-medium text-sm hover:bg-dark-600/80 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
