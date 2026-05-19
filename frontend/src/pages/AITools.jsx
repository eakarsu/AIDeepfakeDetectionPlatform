import React, { useEffect, useState } from 'react';
import { api, FEATURES } from '../services/api';

const SCAN_TYPES = [
  { value: 'image', label: 'Image' },
  { value: 'video', label: 'Video' },
  { value: 'audio', label: 'Audio' },
  { value: 'face_swap', label: 'Face Swap' },
  { value: 'gan', label: 'GAN' },
  { value: 'metadata', label: 'Metadata' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'election', label: 'Election' },
  { value: 'threat', label: 'Threat' },
];

export default function AITools() {
  const [tab, setTab] = useState('watchlist');

  // Watchlist
  const [target, setTarget] = useState('');
  const [targetMode, setTargetMode] = useState('account_handle');
  const [watchResult, setWatchResult] = useState(null);
  const [watchLoading, setWatchLoading] = useState(false);
  const [watchError, setWatchError] = useState('');

  // PDF export
  const [scanId, setScanId] = useState('');
  const [scanType, setScanType] = useState('image');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState('');

  // Batch analyze
  const [batchScanId, setBatchScanId] = useState('');
  const [batchResult, setBatchResult] = useState(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchError, setBatchError] = useState('');

  // Explain detection
  const [explainScanId, setExplainScanId] = useState('');
  const [explainScanType, setExplainScanType] = useState('image');
  const [explainAudience, setExplainAudience] = useState('analyst');
  const [explainResult, setExplainResult] = useState(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainError, setExplainError] = useState('');

  // Authenticity narrative
  const [narrScore, setNarrScore] = useState('');
  const [narrFileName, setNarrFileName] = useState('');
  const [narrSource, setNarrSource] = useState('');
  const [narrTarget, setNarrTarget] = useState('');
  const [narrMetadata, setNarrMetadata] = useState('');
  const [narrResult, setNarrResult] = useState(null);
  const [narrLoading, setNarrLoading] = useState(false);
  const [narrError, setNarrError] = useState('');

  // Webhooks
  const [hooks, setHooks] = useState([]);
  const [hookUrl, setHookUrl] = useState('');
  const [hookEvents, setHookEvents] = useState({ critical_detection: true, high_risk: true });
  const [hookDescription, setHookDescription] = useState('');
  const [hookError, setHookError] = useState('');

  const loadHooks = async () => {
    try { setHooks(await api.getWebhooks()); } catch (e) { setHookError(e.message); }
  };
  useEffect(() => { loadHooks(); }, []);

  const runWatchlist = async () => {
    setWatchLoading(true); setWatchError(''); setWatchResult(null);
    try {
      const payload = targetMode === 'url' ? { url: target } : { account_handle: target };
      const r = await api.aiWatchlistCheck(payload);
      setWatchResult(r);
    } catch (e) { setWatchError(e.message); }
    finally { setWatchLoading(false); }
  };

  const downloadPdf = async () => {
    setPdfLoading(true); setPdfError('');
    try {
      const blob = await api.aiExportReport(scanId, scanType);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scan-report-${scanId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) { setPdfError(e.message); }
    finally { setPdfLoading(false); }
  };

  const runBatch = async () => {
    setBatchLoading(true); setBatchError(''); setBatchResult(null);
    try {
      const r = await api.aiBatchAnalyze(parseInt(batchScanId, 10));
      setBatchResult(r);
    } catch (e) { setBatchError(e.message); }
    finally { setBatchLoading(false); }
  };

  const runExplain = async () => {
    setExplainLoading(true); setExplainError(''); setExplainResult(null);
    try {
      const payload = {
        scan_id: parseInt(explainScanId, 10),
        scan_type: explainScanType,
        audience: explainAudience,
      };
      const r = await api.aiExplainDetection(payload);
      setExplainResult(r);
    } catch (e) {
      const msg = (e && e.message) || 'Request failed';
      setExplainError(/503|not configured|unavailable/i.test(msg) ? 'AI service unavailable. The server is missing OPENROUTER_API_KEY.' : msg);
    } finally { setExplainLoading(false); }
  };

  const runNarrative = async () => {
    setNarrLoading(true); setNarrError(''); setNarrResult(null);
    try {
      let metaObj = undefined;
      if (narrMetadata.trim()) {
        try { metaObj = JSON.parse(narrMetadata); }
        catch (_) { setNarrError('Metadata must be valid JSON'); setNarrLoading(false); return; }
      }
      const payload = {
        authenticity_score: narrScore !== '' ? Number(narrScore) : undefined,
        file_name: narrFileName || undefined,
        source: narrSource || undefined,
        target: narrTarget || undefined,
        metadata: metaObj,
      };
      const r = await api.aiAuthenticityNarrative(payload);
      setNarrResult(r);
    } catch (e) {
      const msg = (e && e.message) || 'Request failed';
      setNarrError(/503|not configured|unavailable/i.test(msg) ? 'AI service unavailable. The server is missing OPENROUTER_API_KEY.' : msg);
    } finally { setNarrLoading(false); }
  };

  const addHook = async () => {
    setHookError('');
    try {
      const events = Object.entries(hookEvents).filter(([, v]) => v).map(([k]) => k);
      await api.configureWebhook({ url: hookUrl, events, description: hookDescription });
      setHookUrl(''); setHookDescription('');
      loadHooks();
    } catch (e) { setHookError(e.message); }
  };

  const deleteHook = async (id) => {
    if (!confirm('Delete this webhook?')) return;
    try { await api.deleteWebhook(id); loadHooks(); } catch (e) { setHookError(e.message); }
  };

  const tabBtn = (key, label) => (
    <button
      key={key}
      onClick={() => setTab(key)}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === key ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40' : 'bg-dark-800/60 text-dark-300 hover:text-white border border-dark-700/40'}`}
    >{label}</button>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">AI Tools</h1>
      <p className="text-dark-400 text-sm mb-6">Watchlist scanner, court-ready PDF reports, batch analyzer, and webhook alerts.</p>

      <div className="flex flex-wrap gap-2 mb-6">
        {tabBtn('watchlist', 'Watchlist Check')}
        {tabBtn('pdf', 'PDF Report Export')}
        {tabBtn('batch', 'Batch Analyzer')}
        {tabBtn('explain', 'Explain Detection')}
        {tabBtn('narrative', 'Score Narrative')}
        {tabBtn('webhooks', 'Webhooks')}
      </div>

      {tab === 'watchlist' && (
        <div className="bg-dark-800/60 border border-dark-700/40 rounded-2xl p-5">
          <h2 className="text-lg font-semibold mb-4">Social/URL Authenticity Check</h2>
          <div className="flex gap-2 mb-3">
            <select value={targetMode} onChange={(e) => setTargetMode(e.target.value)} className="bg-dark-900/60 border border-dark-700/60 rounded-lg px-3 py-2 text-sm">
              <option value="account_handle">Account handle</option>
              <option value="url">URL</option>
            </select>
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder={targetMode === 'url' ? 'https://example.com/post/123' : '@account_name'}
              className="flex-1 bg-dark-900/60 border border-dark-700/60 rounded-lg px-3 py-2 text-sm"
            />
            <button disabled={!target || watchLoading} onClick={runWatchlist} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 rounded-lg text-sm font-medium">
              {watchLoading ? 'Checking...' : 'Run check'}
            </button>
          </div>
          {watchError && <div className="text-red-400 text-sm mb-3">{watchError}</div>}
          {watchResult && (
            <pre className="text-xs bg-dark-900/60 border border-dark-700/40 rounded-lg p-3 overflow-auto max-h-[480px]">{JSON.stringify(watchResult, null, 2)}</pre>
          )}
        </div>
      )}

      {tab === 'pdf' && (
        <div className="bg-dark-800/60 border border-dark-700/40 rounded-2xl p-5">
          <h2 className="text-lg font-semibold mb-4">Court-Admissible PDF Report</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
            <input type="number" value={scanId} onChange={(e) => setScanId(e.target.value)} placeholder="Scan ID" className="bg-dark-900/60 border border-dark-700/60 rounded-lg px-3 py-2 text-sm" />
            <select value={scanType} onChange={(e) => setScanType(e.target.value)} className="bg-dark-900/60 border border-dark-700/60 rounded-lg px-3 py-2 text-sm">
              {SCAN_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <button disabled={!scanId || pdfLoading} onClick={downloadPdf} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 rounded-lg text-sm font-medium">
              {pdfLoading ? 'Generating...' : 'Download PDF'}
            </button>
          </div>
          {pdfError && <div className="text-red-400 text-sm">{pdfError}</div>}
          <p className="text-xs text-dark-400">Generates a chain-of-custody PDF combining scan metadata, AI findings, audit trail, and confidence score.</p>
        </div>
      )}

      {tab === 'batch' && (
        <div className="bg-dark-800/60 border border-dark-700/40 rounded-2xl p-5">
          <h2 className="text-lg font-semibold mb-4">Batch Aggregate Threat Analysis</h2>
          <div className="flex gap-2 mb-3">
            <input type="number" value={batchScanId} onChange={(e) => setBatchScanId(e.target.value)} placeholder="Batch Scan ID" className="flex-1 bg-dark-900/60 border border-dark-700/60 rounded-lg px-3 py-2 text-sm" />
            <button disabled={!batchScanId || batchLoading} onClick={runBatch} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 rounded-lg text-sm font-medium">
              {batchLoading ? 'Analyzing...' : 'Analyze'}
            </button>
          </div>
          {batchError && <div className="text-red-400 text-sm mb-3">{batchError}</div>}
          {batchResult && (
            <pre className="text-xs bg-dark-900/60 border border-dark-700/40 rounded-lg p-3 overflow-auto max-h-[480px]">{JSON.stringify(batchResult, null, 2)}</pre>
          )}
        </div>
      )}

      {tab === 'explain' && (
        <div className="bg-dark-800/60 border border-dark-700/40 rounded-2xl p-5">
          <h2 className="text-lg font-semibold mb-4">Explain a Detection Result</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
            <input type="number" value={explainScanId} onChange={(e) => setExplainScanId(e.target.value)} placeholder="Scan ID" className="bg-dark-900/60 border border-dark-700/60 rounded-lg px-3 py-2 text-sm" />
            <select value={explainScanType} onChange={(e) => setExplainScanType(e.target.value)} className="bg-dark-900/60 border border-dark-700/60 rounded-lg px-3 py-2 text-sm">
              {SCAN_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select value={explainAudience} onChange={(e) => setExplainAudience(e.target.value)} className="bg-dark-900/60 border border-dark-700/60 rounded-lg px-3 py-2 text-sm">
              <option value="analyst">Analyst</option>
              <option value="executive">Executive</option>
              <option value="legal">Legal / Court</option>
              <option value="journalist">Journalist</option>
              <option value="general">General Public</option>
            </select>
          </div>
          <button disabled={!explainScanId || explainLoading} onClick={runExplain} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 rounded-lg text-sm font-medium">
            {explainLoading ? 'Generating...' : 'Generate explanation'}
          </button>
          {explainError && <div className="text-red-400 text-sm mt-3">{explainError}</div>}
          {explainResult && (
            <pre className="text-xs bg-dark-900/60 border border-dark-700/40 rounded-lg p-3 overflow-auto max-h-[480px] mt-3">{JSON.stringify(explainResult, null, 2)}</pre>
          )}
          <p className="text-xs text-dark-400 mt-3">Generates a plain-English narrative for an existing scan, tailored to the selected audience.</p>
        </div>
      )}

      {tab === 'narrative' && (
        <div className="bg-dark-800/60 border border-dark-700/40 rounded-2xl p-5">
          <h2 className="text-lg font-semibold mb-4">Authenticity Score Narrative</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
            <input type="number" min="0" max="100" value={narrScore} onChange={(e) => setNarrScore(e.target.value)} placeholder="Authenticity score (0-100)" className="bg-dark-900/60 border border-dark-700/60 rounded-lg px-3 py-2 text-sm" />
            <input value={narrFileName} onChange={(e) => setNarrFileName(e.target.value)} placeholder="File name (optional)" className="bg-dark-900/60 border border-dark-700/60 rounded-lg px-3 py-2 text-sm" />
            <input value={narrSource} onChange={(e) => setNarrSource(e.target.value)} placeholder="Source (e.g. Twitter, broadcast) (optional)" className="bg-dark-900/60 border border-dark-700/60 rounded-lg px-3 py-2 text-sm" />
            <input value={narrTarget} onChange={(e) => setNarrTarget(e.target.value)} placeholder="Target subject (optional)" className="bg-dark-900/60 border border-dark-700/60 rounded-lg px-3 py-2 text-sm" />
          </div>
          <textarea value={narrMetadata} onChange={(e) => setNarrMetadata(e.target.value)} placeholder='Metadata JSON (optional). e.g. {"resolution":"1080p","codec":"h264"}' className="w-full bg-dark-900/60 border border-dark-700/60 rounded-lg px-3 py-2 text-sm font-mono mb-3" rows={4} />
          <button disabled={(narrScore === '' && !narrMetadata) || narrLoading} onClick={runNarrative} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 rounded-lg text-sm font-medium">
            {narrLoading ? 'Generating...' : 'Generate narrative'}
          </button>
          {narrError && <div className="text-red-400 text-sm mt-3">{narrError}</div>}
          {narrResult && (
            <pre className="text-xs bg-dark-900/60 border border-dark-700/40 rounded-lg p-3 overflow-auto max-h-[480px] mt-3">{JSON.stringify(narrResult, null, 2)}</pre>
          )}
          <p className="text-xs text-dark-400 mt-3">Turns a numeric authenticity score and metadata into a structured narrative suitable for reports, social posts, or briefings.</p>
        </div>
      )}

      {tab === 'webhooks' && (
        <div className="bg-dark-800/60 border border-dark-700/40 rounded-2xl p-5">
          <h2 className="text-lg font-semibold mb-4">Outbound Alert Webhooks</h2>
          <p className="text-xs text-dark-400 mb-3">Webhooks fire automatically when an AI scan returns a high or critical risk verdict.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
            <input value={hookUrl} onChange={(e) => setHookUrl(e.target.value)} placeholder="https://hooks.slack.com/..." className="bg-dark-900/60 border border-dark-700/60 rounded-lg px-3 py-2 text-sm md:col-span-2" />
            <input value={hookDescription} onChange={(e) => setHookDescription(e.target.value)} placeholder="Description (optional)" className="bg-dark-900/60 border border-dark-700/60 rounded-lg px-3 py-2 text-sm md:col-span-2" />
            <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={hookEvents.critical_detection} onChange={(e) => setHookEvents({ ...hookEvents, critical_detection: e.target.checked })} /> critical_detection</label>
            <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={hookEvents.high_risk} onChange={(e) => setHookEvents({ ...hookEvents, high_risk: e.target.checked })} /> high_risk</label>
            <button disabled={!hookUrl} onClick={addHook} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 rounded-lg text-sm font-medium md:col-span-2">Add webhook</button>
          </div>
          {hookError && <div className="text-red-400 text-sm mb-3">{hookError}</div>}
          <div className="border-t border-dark-700/40 pt-3 mt-3">
            <h3 className="text-sm font-semibold mb-2">Configured webhooks</h3>
            {hooks.length === 0 ? (
              <div className="text-xs text-dark-400">No webhooks configured.</div>
            ) : (
              <ul className="space-y-2">
                {hooks.map(h => (
                  <li key={h.id} className="flex items-center justify-between bg-dark-900/40 border border-dark-700/40 rounded-lg px-3 py-2">
                    <div className="text-xs">
                      <div className="font-mono text-blue-300 break-all">{h.url}</div>
                      <div className="text-dark-400">{(h.events || []).join(', ')} {h.description ? `· ${h.description}` : ''}</div>
                    </div>
                    <button onClick={() => deleteHook(h.id)} className="text-red-400 hover:text-red-300 text-xs">Delete</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
