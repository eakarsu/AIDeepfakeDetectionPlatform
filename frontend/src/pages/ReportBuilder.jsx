import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, FEATURES } from '../services/api';

export default function ReportBuilder() {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    report_type: 'summary',
    feature_keys: [],
    filters: { status: '', risk_level: '', date_from: '', date_to: '' },
  });

  useEffect(() => {
    api.getReports().then(setReports).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const data = {
        ...form,
        feature_keys: form.feature_keys.length > 0 ? form.feature_keys.join(',') : undefined,
        filters: Object.fromEntries(Object.entries(form.filters).filter(([, v]) => v)),
      };
      const result = await api.createReport(data);
      setReports([result, ...reports]);
      setShowForm(false);
      setForm({ title: '', description: '', report_type: 'summary', feature_keys: [], filters: { status: '', risk_level: '', date_from: '', date_to: '' } });
    } catch (err) { alert(err.message); }
    finally { setGenerating(false); }
  };

  const handleViewReport = async (id) => {
    try {
      const report = await api.getReport(id);
      setSelectedReport(report);
    } catch (err) { alert(err.message); }
  };

  const handleDeleteReport = async (id) => {
    await api.deleteReport(id);
    setReports(reports.filter(r => r.id !== id));
    if (selectedReport?.id === id) setSelectedReport(null);
  };

  const toggleFeature = (key) => {
    setForm(prev => ({
      ...prev,
      feature_keys: prev.feature_keys.includes(key)
        ? prev.feature_keys.filter(k => k !== key)
        : [...prev.feature_keys, key],
    }));
  };

  if (selectedReport) {
    const data = typeof selectedReport.data === 'string' ? JSON.parse(selectedReport.data) : selectedReport.data;
    return (
      <div>
        <div className="mb-6">
          <button onClick={() => setSelectedReport(null)} className="text-dark-400 hover:text-white text-sm mb-2 flex items-center gap-1">\u2190 Back to Reports</button>
          <h1 className="text-2xl font-bold text-white">{selectedReport.title}</h1>
          <p className="text-dark-400 text-sm mt-1">Generated: {new Date(selectedReport.created_at).toLocaleString()}</p>
        </div>

        {data && Object.entries(data).map(([key, section]) => (
          <div key={key} className="bg-dark-800/80 rounded-xl border border-dark-700/50 p-5 mb-4">
            <h3 className="text-sm font-semibold text-white mb-3">{FEATURES.find(f => f.key === key)?.name || key}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <div className="bg-dark-700/30 rounded-lg p-2 text-center">
                <div className="text-lg font-bold">{section.total}</div>
                <div className="text-[10px] text-dark-400">Total</div>
              </div>
              {section.risk_breakdown && Object.entries(section.risk_breakdown).map(([risk, count]) => (
                count > 0 && (
                  <div key={risk} className="bg-dark-700/30 rounded-lg p-2 text-center">
                    <div className={`text-lg font-bold ${risk === 'critical' ? 'text-red-400' : risk === 'high' ? 'text-orange-400' : risk === 'medium' ? 'text-yellow-400' : 'text-green-400'}`}>{count}</div>
                    <div className="text-[10px] text-dark-400 capitalize">{risk}</div>
                  </div>
                )
              ))}
            </div>
            {section.status_breakdown && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(section.status_breakdown).map(([status, count]) => (
                  <span key={status} className="px-2 py-0.5 bg-dark-700/50 rounded text-[10px] text-dark-300">{status}: {count}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={() => navigate('/')} className="text-dark-400 hover:text-white text-sm mb-2 flex items-center gap-1">\u2190 Back to Dashboard</button>
          <h1 className="text-2xl font-bold text-white">Report Builder</h1>
          <p className="text-dark-400 text-sm mt-1">Generate and view reports</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl text-sm font-medium">
          + New Report
        </button>
      </div>

      {showForm && (
        <div className="bg-dark-800/80 rounded-xl border border-dark-700/50 p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Generate Report</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm text-dark-300 mb-1.5">Title <span className="text-red-400">*</span></label>
              <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                className="w-full px-4 py-2.5 bg-dark-700/50 border border-dark-600/50 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500/50"
                placeholder="e.g. Weekly Security Report" />
            </div>
            <div>
              <label className="block text-sm text-dark-300 mb-1.5">Type</label>
              <select value={form.report_type} onChange={e => setForm({ ...form, report_type: e.target.value })}
                className="w-full px-4 py-2.5 bg-dark-700/50 border border-dark-600/50 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500/50">
                <option value="summary">Summary</option>
                <option value="detailed">Detailed</option>
                <option value="risk_assessment">Risk Assessment</option>
                <option value="compliance">Compliance</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-dark-300 mb-1.5">Description</label>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2}
                className="w-full px-4 py-2.5 bg-dark-700/50 border border-dark-600/50 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500/50 resize-none"
                placeholder="Optional description" />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm text-dark-300 mb-2">Features to Include (leave empty for all)</label>
            <div className="flex flex-wrap gap-2">
              {FEATURES.filter(f => f.key !== 'users').map(f => (
                <button key={f.key} onClick={() => toggleFeature(f.key)}
                  className={`px-3 py-1 rounded-lg text-xs transition-colors ${form.feature_keys.includes(f.key) ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-dark-700/50 text-dark-400 border border-dark-600/30 hover:bg-dark-700'}`}>
                  {f.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div>
              <label className="block text-[11px] text-dark-400 mb-1">Status Filter</label>
              <select value={form.filters.status} onChange={e => setForm({ ...form, filters: { ...form.filters, status: e.target.value } })}
                className="w-full px-3 py-2 bg-dark-700/50 border border-dark-600/50 rounded-lg text-white text-xs focus:outline-none focus:border-blue-500/50">
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="analyzed">Analyzed</option>
                <option value="completed">Completed</option>
                <option value="active">Active</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-dark-400 mb-1">Risk Level</label>
              <select value={form.filters.risk_level} onChange={e => setForm({ ...form, filters: { ...form.filters, risk_level: e.target.value } })}
                className="w-full px-3 py-2 bg-dark-700/50 border border-dark-600/50 rounded-lg text-white text-xs focus:outline-none focus:border-blue-500/50">
                <option value="">All</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-dark-400 mb-1">From Date</label>
              <input type="date" value={form.filters.date_from} onChange={e => setForm({ ...form, filters: { ...form.filters, date_from: e.target.value } })}
                className="w-full px-3 py-2 bg-dark-700/50 border border-dark-600/50 rounded-lg text-white text-xs focus:outline-none focus:border-blue-500/50" />
            </div>
            <div>
              <label className="block text-[11px] text-dark-400 mb-1">To Date</label>
              <input type="date" value={form.filters.date_to} onChange={e => setForm({ ...form, filters: { ...form.filters, date_to: e.target.value } })}
                className="w-full px-3 py-2 bg-dark-700/50 border border-dark-600/50 rounded-lg text-white text-xs focus:outline-none focus:border-blue-500/50" />
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={handleGenerate} disabled={!form.title || generating}
              className="px-5 py-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl text-sm font-medium disabled:opacity-50">
              {generating ? 'Generating...' : 'Generate Report'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-5 py-2 bg-dark-700/80 border border-dark-600/50 rounded-xl text-sm">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500 mx-auto"></div></div>
      ) : reports.length === 0 ? (
        <div className="text-center py-12 bg-dark-800/50 rounded-xl border border-dark-700/30">
          <div className="text-dark-500 text-lg mb-1">No reports yet</div>
          <div className="text-dark-500 text-sm">Generate your first report above</div>
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map(r => (
            <div key={r.id} className="bg-dark-800/80 rounded-xl border border-dark-700/50 p-4 flex items-center justify-between hover:border-dark-600/80 transition-colors">
              <div className="flex-1 cursor-pointer" onClick={() => handleViewReport(r.id)}>
                <div className="font-medium text-sm text-white">{r.title}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-blue-400 capitalize">{r.report_type}</span>
                  <span className="text-xs text-dark-500">{new Date(r.created_at).toLocaleString()}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleViewReport(r.id)} className="text-xs text-blue-400 hover:text-blue-300">View</button>
                <button onClick={() => handleDeleteReport(r.id)} className="text-xs text-dark-500 hover:text-red-400">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
