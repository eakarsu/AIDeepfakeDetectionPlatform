import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { tsApi, TS_FEATURES } from '../../services/tsApi';
import {
  CsamBanner, PageHeader, Card, Btn, LoadingSpinner, ErrorBlock, Toast, toast,
} from './TsShared';

export default function TsForm() {
  const { featureKey, id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const feature = TS_FEATURES.find(f => f.key === featureKey);

  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    if (!isEdit || !feature) return;
    tsApi.get(featureKey, id)
      .then(d => {
        const item = d.data || d;
        const initial = {};
        feature.fields.forEach(f => { initial[f.name] = item[f.name] ?? ''; });
        setForm(initial);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [featureKey, id, isEdit, feature]);

  const handleChange = (name, value) => setForm(prev => ({ ...prev, [name]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!feature) return;
    const required = feature.fields.filter(f => f.required);
    for (const f of required) {
      if (!form[f.name]) { setError(`${f.label} is required`); return; }
    }
    setSaving(true);
    setError('');
    try {
      if (isEdit) {
        await tsApi.update(featureKey, id, form);
        toast('Updated successfully', setToastMsg);
        setTimeout(() => navigate(`/ts/${featureKey}/${id}`), 700);
      } else {
        const result = await tsApi.create(featureKey, form);
        const newId = result.data?.id || result.id;
        toast('Created successfully', setToastMsg);
        setTimeout(() => navigate(`/ts/${featureKey}/${newId}`), 700);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!feature) return <div className="p-6 text-red-400">Unknown feature: {featureKey}</div>;
  if (loading) return <LoadingSpinner />;

  return (
    <div>
      {feature.isCsam && <CsamBanner />}

      <PageHeader
        icon={feature.icon}
        title={isEdit ? `Edit ${feature.name}` : `New ${feature.name}`}
        subtitle={isEdit ? `Editing record #${id}` : `Create a new ${feature.name} record`}
        actions={
          <Btn variant="ghost" size="sm" onClick={() => navigate(isEdit ? `/ts/${featureKey}/${id}` : `/ts/${featureKey}`)}>
            ← Cancel
          </Btn>
        }
      />

      {error && <ErrorBlock message={error} />}

      <Card className="p-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          {feature.fields.map(field => (
            <div key={field.name}>
              <label className="block text-xs font-semibold text-dark-400 uppercase tracking-wide mb-1.5">
                {field.label}
                {field.required && <span className="text-red-400 ml-1">*</span>}
              </label>
              {field.type === 'textarea' ? (
                <textarea
                  rows={4}
                  value={form[field.name] || ''}
                  onChange={e => handleChange(field.name, e.target.value)}
                  className="w-full bg-dark-900/60 border border-dark-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-dark-500 focus:outline-none focus:border-blue-500/60 resize-none"
                  placeholder={field.label}
                />
              ) : field.type === 'select' ? (
                <select
                  value={form[field.name] || ''}
                  onChange={e => handleChange(field.name, e.target.value)}
                  className="w-full bg-dark-900/60 border border-dark-600/50 rounded-lg px-3 py-2 text-sm text-dark-200 focus:outline-none focus:border-blue-500/60"
                >
                  <option value="">Select…</option>
                  {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input
                  type={field.type || 'text'}
                  value={form[field.name] || ''}
                  onChange={e => handleChange(field.name, e.target.value)}
                  className="w-full bg-dark-900/60 border border-dark-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-dark-500 focus:outline-none focus:border-blue-500/60"
                  placeholder={field.label}
                  step={field.type === 'number' ? 'any' : undefined}
                />
              )}
            </div>
          ))}

          <div className="flex gap-3 pt-2">
            <Btn type="submit" variant="primary" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Record'}
            </Btn>
            <Btn type="button" variant="ghost" onClick={() => navigate(isEdit ? `/ts/${featureKey}/${id}` : `/ts/${featureKey}`)}>
              Cancel
            </Btn>
          </div>
        </form>
      </Card>

      <Toast message={toastMsg} />
    </div>
  );
}
