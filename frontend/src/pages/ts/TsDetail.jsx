import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { tsApi, TS_FEATURES } from '../../services/tsApi';
import {
  CsamBanner, PageHeader, Card, Btn, SeverityBadge, StatusBadge,
  LoadingSpinner, ErrorBlock, Toast, toast, AIResultPanel,
} from './TsShared';

const SKIP = ['created_by', 'ai_result', 'password_hash'];

function FieldRow({ label, value }) {
  if (value === undefined || value === null) return null;
  const display = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
  return (
    <div className="flex flex-col sm:flex-row gap-1 py-2.5 border-b border-dark-700/30">
      <div className="sm:w-48 text-dark-400 text-xs uppercase tracking-wide font-medium flex-shrink-0 pt-0.5">{label}</div>
      <div className="text-white text-sm break-all flex-1">{display || <span className="text-dark-500">—</span>}</div>
    </div>
  );
}

export default function TsDetail() {
  const { featureKey, id } = useParams();
  const navigate = useNavigate();
  const feature = TS_FEATURES.find(f => f.key === featureKey);

  const [item, setItem] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [aiVerb, setAiVerb] = useState('');
  const [aiInput, setAiInput] = useState('');
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    if (!feature) return;
    setLoading(true);
    tsApi.get(featureKey, id)
      .then(d => setItem(d.data || d))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [featureKey, id, feature]);

  const loadHistory = () => {
    setShowHistory(true);
    tsApi.history(featureKey, id).then(d => setHistory(d.data || [])).catch(() => {});
  };

  const handleDelete = async () => {
    if (!window.confirm('Soft-delete this record?')) return;
    try {
      await tsApi.remove(featureKey, id);
      toast('Deleted', setToastMsg);
      setTimeout(() => navigate(`/ts/${featureKey}`), 800);
    } catch (e) { toast('Error: ' + e.message, setToastMsg); }
  };

  const handleArchive = async () => {
    setArchiving(true);
    try {
      await tsApi.archive(featureKey, id);
      toast('Archived', setToastMsg);
      setItem(prev => ({ ...prev, is_archived: true }));
    } catch (e) { toast('Error: ' + e.message, setToastMsg); }
    finally { setArchiving(false); }
  };

  const handleRestore = async () => {
    setArchiving(true);
    try {
      await tsApi.restore(featureKey, id);
      toast('Restored', setToastMsg);
      setItem(prev => ({ ...prev, is_archived: false }));
    } catch (e) { toast('Error: ' + e.message, setToastMsg); }
    finally { setArchiving(false); }
  };

  const runAiVerb = async () => {
    if (!aiVerb) return;
    setAiLoading(true);
    setAiError('');
    setAiResult(null);
    try {
      let body = { id: item.id };
      if (aiInput.trim()) {
        try { body = { ...body, ...JSON.parse(aiInput) }; }
        catch { body.extra = aiInput; }
      }
      const r = await tsApi.aiVerb(featureKey, aiVerb, body);
      setAiResult(r.result || r);
    } catch (e) { setAiError(e.message); }
    finally { setAiLoading(false); }
  };

  if (!feature) return <div className="p-6 text-red-400">Unknown feature</div>;
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorBlock message={error} />;
  if (!item) return null;

  const displayTitle = feature.isCsam
    ? `Hash Record #${item.id}`
    : (item.title || item.name || `Record #${item.id}`);

  const metaFields = Object.entries(item).filter(([k]) => !SKIP.includes(k));

  return (
    <div>
      {feature.isCsam && <CsamBanner />}

      <PageHeader
        icon={feature.icon}
        title={displayTitle}
        subtitle={`${feature.name} · ID ${item.id}`}
        actions={
          <div className="flex gap-2 flex-wrap">
            <Btn onClick={() => navigate(`/ts/${featureKey}`)} variant="ghost" size="sm">← Back</Btn>
            <Btn onClick={() => navigate(`/ts/${featureKey}/${id}/edit`)} variant="default" size="sm">Edit</Btn>
            {item.is_archived
              ? <Btn onClick={handleRestore} variant="success" size="sm" disabled={archiving}>Restore</Btn>
              : <Btn onClick={handleArchive} variant="warning" size="sm" disabled={archiving}>Archive</Btn>
            }
            <Btn onClick={handleDelete} variant="danger" size="sm">Delete</Btn>
            <Btn onClick={() => navigate(`/ts/${featureKey}/ai-panel`)} variant="ghost" size="sm">🤖 AI Panel</Btn>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main metadata */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-5">
            <div className="text-xs font-semibold text-dark-400 uppercase tracking-wide mb-3">
              {feature.isCsam ? 'Hash & Case Metadata' : 'Record Details'}
            </div>
            {feature.isCsam ? (
              // CSAM: only show hash + severity + case metadata, no content fields
              <>
                <FieldRow label="ID" value={item.id} />
                <FieldRow label="Hash Value" value={item.hash_value} />
                <FieldRow label="Hash Algorithm" value={item.hash_algorithm} />
                <FieldRow label="Hash Set Version" value={item.hash_set_version} />
                <FieldRow label="Match Source" value={item.match_source} />
                <FieldRow label="Severity Label" value={<SeverityBadge label={item.severity_label} />} />
                <FieldRow label="Confidence Score" value={item.confidence_score} />
                <FieldRow label="Content ID" value={item.content_id} />
                <FieldRow label="Platform Origin" value={item.platform_origin} />
                <FieldRow label="Actor ID" value={item.actor_id} />
                <FieldRow label="Reported to NCMEC" value={String(item.reported_to_ncmec)} />
                <FieldRow label="NCMEC Report ID" value={item.ncmec_report_id} />
                <FieldRow label="LE Notified" value={String(item.law_enforcement_notified)} />
                <FieldRow label="Account Action" value={item.account_action} />
                <FieldRow label="Preservation Status" value={item.preservation_status} />
                <FieldRow label="Cross-Platform Shared" value={String(item.cross_platform_shared)} />
                <FieldRow label="Status" value={<StatusBadge status={item.status} />} />
                <FieldRow label="Matched At" value={item.matched_at} />
                <FieldRow label="Created At" value={item.created_at} />
                <FieldRow label="Updated At" value={item.updated_at} />
                <FieldRow label="Archived" value={String(item.is_archived)} />
              </>
            ) : (
              metaFields.map(([k, v]) => <FieldRow key={k} label={k.replace(/_/g, ' ')} value={v} />)
            )}
          </Card>

          {/* AI Result stored on record */}
          {item.ai_result && (
            <Card className="p-5">
              <div className="text-xs font-semibold text-dark-400 uppercase tracking-wide mb-3">Stored AI Result</div>
              <AIResultPanel result={
                typeof item.ai_result === 'string'
                  ? (() => { try { return JSON.parse(item.ai_result); } catch { return item.ai_result; } })()
                  : item.ai_result
              } />
            </Card>
          )}

          {/* Audit history */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-semibold text-dark-400 uppercase tracking-wide">Audit History</div>
              {!showHistory && <Btn size="sm" onClick={loadHistory}>Load History</Btn>}
            </div>
            {showHistory && (
              history.length === 0
                ? <div className="text-sm text-dark-500">No history entries</div>
                : <div className="space-y-2">
                    {history.map((h, i) => (
                      <div key={i} className="text-xs text-dark-300 bg-dark-900/40 rounded px-3 py-2">
                        <span className="text-dark-500">{new Date(h.created_at).toLocaleString()}</span>
                        {' — '}
                        {h.action || h.description || JSON.stringify(h)}
                      </div>
                    ))}
                  </div>
            )}
          </Card>
        </div>

        {/* AI Verbs sidebar */}
        <div className="space-y-4">
          <Card className="p-5">
            <div className="text-xs font-semibold text-dark-400 uppercase tracking-wide mb-3">Run AI Verb</div>
            <select
              value={aiVerb}
              onChange={e => { setAiVerb(e.target.value); setAiResult(null); setAiError(''); }}
              className="w-full bg-dark-900/60 border border-dark-600/50 rounded-lg px-3 py-2 text-sm text-dark-200 mb-3 focus:outline-none focus:border-blue-500/60"
            >
              <option value="">Select AI verb…</option>
              {feature.aiVerbs.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
            <textarea
              placeholder='Extra JSON params (optional)\ne.g. {"actor_id": "abc"}'
              value={aiInput}
              onChange={e => setAiInput(e.target.value)}
              rows={3}
              className="w-full bg-dark-900/60 border border-dark-600/50 rounded-lg px-3 py-2 text-xs text-dark-300 placeholder-dark-600 mb-3 font-mono resize-none focus:outline-none focus:border-blue-500/60"
            />
            <Btn variant="primary" onClick={runAiVerb} disabled={!aiVerb || aiLoading} size="sm">
              {aiLoading ? 'Running…' : '🤖 Run'}
            </Btn>
            {aiError && <div className="mt-2 text-xs text-red-400">{aiError}</div>}
            <AIResultPanel result={aiResult} loading={aiLoading && !aiResult} label={aiVerb} />
          </Card>

          {/* Quick AI Verbs list */}
          <Card className="p-5">
            <div className="text-xs font-semibold text-dark-400 uppercase tracking-wide mb-3">All AI Verbs ({feature.aiVerbs.length})</div>
            <div className="space-y-1">
              {feature.aiVerbs.map(v => (
                <button
                  key={v}
                  onClick={() => setAiVerb(v)}
                  className={`w-full text-left text-xs px-2 py-1.5 rounded transition-colors ${aiVerb === v ? 'bg-blue-500/20 text-blue-400' : 'text-dark-400 hover:bg-dark-700/40 hover:text-dark-200'}`}
                >
                  {v}
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Toast message={toastMsg} />
    </div>
  );
}
