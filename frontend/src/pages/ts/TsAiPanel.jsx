import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { tsApi, TS_FEATURES } from '../../services/tsApi';
import {
  CsamBanner, PageHeader, Card, Btn, LoadingSpinner, ErrorBlock,
  Toast, toast, AIResultPanel,
} from './TsShared';

export default function TsAiPanel() {
  const { featureKey } = useParams();
  const navigate = useNavigate();
  const feature = TS_FEATURES.find(f => f.key === featureKey);

  const [selectedVerb, setSelectedVerb] = useState('');
  const [inputJson, setInputJson] = useState('{\n  "id": ""\n}');
  const [results, setResults] = useState([]);  // history of runs
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    if (!feature) return;
    setStatsLoading(true);
    tsApi.stats(featureKey).then(setStats).catch(() => {}).finally(() => setStatsLoading(false));
  }, [featureKey, feature]);

  if (!feature) return <div className="p-6 text-red-400">Unknown feature: {featureKey}</div>;

  const verbDescriptions = {
    // CSAM
    'classify-match-confidence': 'Classify confidence tier based on hash match metadata.',
    'recommend-immediate-report': 'Assess whether immediate NCMEC reporting is required.',
    'score-hash-quality': 'Score hash entry quality and completeness.',
    'generate-ncmec-cybertip-draft': 'Draft a NCMEC CyberTipline report from metadata.',
    'summarize-match-events': 'Summarize hash match patterns across records.',
    'validate-hash-set-version': 'Validate hash set version currency and reliability.',
    'suggest-additional-hash-source': 'Recommend additional hash sources to expand coverage.',
    'detect-hash-collision-risk': 'Assess collision risk for the hash algorithm used.',
    'classify-content-tier-1-2-3': 'Classify severity tier from metadata.',
    'predict-recidivism-actor': 'Predict recidivism risk from actor match history.',
    'recommend-cross-platform-share': 'Recommend whether to share hash cross-platform via GIFCT.',
    'generate-law-enforcement-package': 'Generate law enforcement referral package.',
    'score-evidence-preservation': 'Score evidence preservation quality.',
    'suggest-account-action-tier': 'Suggest account action tier based on severity.',
    'summarize-actor-history': 'Summarize an actor\'s full match history.',
    'score-hash-coverage': 'Score overall hash detection coverage.',
    // Policy
    'classify-policy-match': 'Classify how well a case matches a policy rule.',
    'suggest-policy-rule': 'Suggest a new policy rule based on gap analysis.',
    'detect-policy-drift': 'Detect inconsistencies in policy application over time.',
    'predict-decision-consistency': 'Predict likelihood of consistent decisions.',
    'recommend-policy-refinement': 'Recommend policy refinements based on edge cases.',
    'score-policy-clarity': 'Score policy rule clarity and enforceability.',
    'generate-policy-explanation': 'Generate a plain-language policy explanation.',
    'summarize-policy-events': 'Summarize recent policy-related enforcement events.',
    'validate-policy-against-law': 'Validate policy compliance against legal frameworks.',
    'suggest-cross-policy-conflict-resolution': 'Detect and resolve conflicts between policies.',
    'detect-policy-ambiguity': 'Identify ambiguous policy language.',
    'classify-edge-case': 'Classify a borderline moderation case.',
    'predict-precedent-application': 'Predict how precedent applies to current case.',
    'recommend-deprecation': 'Recommend policies for deprecation.',
    'generate-reviewer-training-example': 'Generate reviewer training examples.',
    'score-decision-explainability': 'Score the explainability of a moderation decision.',
    // Human Review
    'predict-review-time': 'Predict estimated review completion time.',
    'classify-queue-priority': 'Classify queue item priority level.',
    'recommend-assignee': 'Recommend best reviewer assignee.',
    'detect-reviewer-fatigue': 'Detect reviewer fatigue patterns.',
    'score-queue-health': 'Score overall queue health and SLA status.',
    'generate-queue-summary': 'Generate a queue status summary.',
    'summarize-reviewer-throughput': 'Summarize reviewer throughput metrics.',
    'validate-sla-adherence': 'Validate SLA adherence across queue items.',
    'suggest-batch-grouping': 'Suggest batching strategies for efficient review.',
    'detect-coaching-need': 'Detect reviewers who need coaching.',
    'classify-decision-disagreement': 'Classify sources of reviewer disagreement.',
    'predict-overflow-risk': 'Predict queue overflow risk.',
    'recommend-staffing-adjust': 'Recommend staffing adjustments.',
    'generate-coaching-feedback': 'Generate coaching feedback for reviewers.',
    'score-decision-quality': 'Score decision quality consistency.',
    'summarize-decision-variance': 'Summarize variance in reviewer decisions.',
    // Appeals
    'classify-appeal-strength': 'Classify the strength of an appeal.',
    'predict-appeal-outcome': 'Predict likely appeal outcome.',
    'suggest-evidence-needed': 'Suggest evidence needed to support appeal review.',
    'generate-appeal-response': 'Generate a structured appeal response.',
    'summarize-appeal-history': 'Summarize appeal history for a user/content.',
    'score-original-decision': 'Score the quality of the original moderation decision.',
    'validate-procedural-fairness': 'Validate that appeals process was fair.',
    'recommend-policy-clarification': 'Recommend policy clarifications from appeal patterns.',
    'classify-appeal-tier': 'Classify which appeal tier applies.',
    'detect-bad-faith-appeal': 'Detect bad-faith or coordinated appeal patterns.',
    'predict-reversal-rate': 'Predict reversal rate for decision category.',
    'recommend-precedent-citation': 'Recommend relevant precedent citations.',
    'generate-user-letter': 'Generate appeal outcome letter for user.',
    'score-appeal-process-quality': 'Score the quality of the appeal process.',
    'suggest-appeals-policy-change': 'Suggest appeals policy changes based on trends.',
    'summarize-appeals-trends': 'Summarize trends in appeal outcomes.',
    // Region Rules
    'classify-region-applicability': 'Classify which regions a rule applies to.',
    'detect-rule-conflict': 'Detect conflicts between regional rules.',
    'suggest-region-specific-policy': 'Suggest region-specific policy adaptations.',
    'predict-regulator-finding': 'Predict likely regulator finding.',
    'recommend-rule-update': 'Recommend rule updates for compliance.',
    'generate-jurisdiction-summary': 'Generate a jurisdiction summary document.',
    'summarize-rule-changes': 'Summarize recent rule changes.',
    'score-rule-coverage': 'Score rule coverage across jurisdictions.',
    'validate-rule-vs-legal-text': 'Validate rule against legal text.',
    'suggest-rule-versioning': 'Suggest versioning strategy for rules.',
    'classify-content-by-jurisdiction': 'Classify content legality by jurisdiction.',
    'predict-cross-border-issue': 'Predict cross-border enforcement issues.',
    'recommend-geo-block': 'Recommend geo-blocking for compliance.',
    'generate-regulator-response': 'Generate a draft regulator response.',
    'score-multi-jurisdiction-compliance': 'Score compliance across jurisdictions.',
    'detect-overreach': 'Detect potential regulatory overreach.',
    // Transparency
    'classify-report-section': 'Classify which transparency report section data belongs to.',
    'suggest-metric-definition': 'Suggest standardized metric definitions.',
    'detect-metric-anomaly': 'Detect anomalies in reported metrics.',
    'predict-stakeholder-question': 'Predict questions stakeholders will ask.',
    'recommend-narrative-framing': 'Recommend narrative framing for report.',
    'generate-report-section': 'Generate a report section draft.',
    'summarize-period-trends': 'Summarize period-over-period trends.',
    'score-report-completeness': 'Score report completeness.',
    'validate-metric-reproducibility': 'Validate metric reproducibility.',
    'suggest-additional-disclosure': 'Suggest additional disclosures.',
    'classify-disclosure-sensitivity': 'Classify sensitivity of disclosure.',
    'predict-media-pickup': 'Predict media coverage likelihood.',
    'recommend-comparative-baseline': 'Recommend comparative industry baseline.',
    'generate-press-summary': 'Generate press-ready summary.',
    'score-comparability-vs-peers': 'Score comparability to industry peers.',
    'summarize-yoy-changes': 'Summarize year-over-year changes.',
    // Creator Comms
    'classify-comms-tone': 'Classify tone of creator communication.',
    'draft-notice-letter': 'Draft a policy violation notice letter.',
    'predict-creator-reaction': 'Predict creator reaction to enforcement.',
    'suggest-education-resource': 'Suggest educational resources for creator.',
    'generate-deescalation-message': 'Generate a de-escalation message.',
    'summarize-creator-history': 'Summarize creator enforcement history.',
    'score-message-clarity': 'Score clarity of enforcement message.',
    'validate-comms-against-policy': 'Validate communication against policy.',
    'recommend-channel-selection': 'Recommend best communication channel.',
    'classify-creator-tier': 'Classify creator tier and impact.',
    'detect-influencer-blast-radius': 'Assess influencer enforcement impact.',
    'predict-pr-risk': 'Predict PR risk of enforcement action.',
    'recommend-escalation-path': 'Recommend escalation path.',
    'generate-press-statement-template': 'Generate press statement template.',
    'score-comms-effectiveness': 'Score communications effectiveness.',
    'summarize-comms-history': 'Summarize all communications history.',
    // Signal Sharing
    'classify-signal-shareable': 'Classify whether a signal is eligible for sharing.',
    'score-signal-quality': 'Score signal quality and reliability.',
    'predict-cross-platform-utility': 'Predict cross-platform utility of signal.',
    'recommend-signal-tier': 'Recommend appropriate sharing tier.',
    'generate-signal-package': 'Generate a signal sharing package.',
    'summarize-shared-signals': 'Summarize all shared signals.',
    'validate-signal-attribution': 'Validate signal attribution accuracy.',
    'suggest-share-restrictions': 'Suggest sharing restrictions and conditions.',
    'detect-poisoned-signal': 'Detect potentially poisoned or adversarial signals.',
    'classify-actor-network': 'Classify actor network type and reach.',
    'predict-platform-coverage': 'Predict cross-platform detection coverage.',
    'recommend-additional-signal-type': 'Recommend additional signal types.',
    'generate-partner-report': 'Generate partner network report.',
    'score-mutual-defense-value': 'Score mutual defense value of signal.',
    'suggest-signal-revocation': 'Suggest signals for revocation.',
    'summarize-network-health': 'Summarize signal network health.',
  };

  const runVerb = async () => {
    if (!selectedVerb) return;
    setLoading(true);
    setError('');
    let body = {};
    try {
      body = JSON.parse(inputJson);
    } catch {
      setError('Invalid JSON in input');
      setLoading(false);
      return;
    }
    try {
      const r = await tsApi.aiVerb(featureKey, selectedVerb, body);
      const entry = { verb: selectedVerb, result: r.result || r, ts: new Date().toLocaleTimeString(), model: r.model };
      setResults(prev => [entry, ...prev.slice(0, 9)]);
      toast('AI verb completed', setToastMsg);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const verbGroups = [
    { label: 'Classify / Score', verbs: feature.aiVerbs.filter(v => v.startsWith('classify') || v.startsWith('score')) },
    { label: 'Predict / Detect', verbs: feature.aiVerbs.filter(v => v.startsWith('predict') || v.startsWith('detect')) },
    { label: 'Recommend / Suggest', verbs: feature.aiVerbs.filter(v => v.startsWith('recommend') || v.startsWith('suggest')) },
    { label: 'Generate / Draft', verbs: feature.aiVerbs.filter(v => v.startsWith('generate') || v.startsWith('draft')) },
    { label: 'Summarize / Validate', verbs: feature.aiVerbs.filter(v => v.startsWith('summarize') || v.startsWith('validate')) },
    { label: 'Other', verbs: feature.aiVerbs.filter(v =>
      !v.startsWith('classify') && !v.startsWith('score') && !v.startsWith('predict') &&
      !v.startsWith('detect') && !v.startsWith('recommend') && !v.startsWith('suggest') &&
      !v.startsWith('generate') && !v.startsWith('draft') && !v.startsWith('summarize') && !v.startsWith('validate')
    )},
  ].filter(g => g.verbs.length > 0);

  return (
    <div>
      {feature.isCsam && <CsamBanner />}

      <PageHeader
        icon="🤖"
        title={`AI Panel — ${feature.name}`}
        subtitle={`${feature.aiVerbs.length} AI verbs available`}
        actions={
          <Btn variant="ghost" size="sm" onClick={() => navigate(`/ts/${featureKey}`)}>
            ← Back to List
          </Btn>
        }
      />

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <Card className="p-4">
            <div className="text-2xl font-bold text-white">{stats.total ?? '—'}</div>
            <div className="text-xs text-dark-400 mt-1">Total Records</div>
          </Card>
          {stats.bySeverity?.slice(0, 3).map(r => (
            <Card key={r.severity_label} className="p-4">
              <div className="text-2xl font-bold text-white">{r.count}</div>
              <div className="text-xs text-dark-400 mt-1 capitalize">{r.severity_label}</div>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Verb selector + runner */}
        <div className="space-y-4">
          <Card className="p-5">
            <div className="text-xs font-semibold text-dark-400 uppercase tracking-wide mb-3">Select AI Verb</div>
            {verbGroups.map(g => (
              <div key={g.label} className="mb-3">
                <div className="text-xs text-dark-500 font-medium mb-1.5">{g.label}</div>
                {g.verbs.map(v => (
                  <button
                    key={v}
                    onClick={() => setSelectedVerb(v)}
                    className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg mb-0.5 transition-colors ${
                      selectedVerb === v
                        ? 'bg-blue-500/25 text-blue-300 border border-blue-500/30'
                        : 'text-dark-400 hover:bg-dark-700/50 hover:text-white'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            ))}
          </Card>
        </div>

        {/* Input + output */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-5">
            <div className="text-xs font-semibold text-dark-400 uppercase tracking-wide mb-1.5">
              {selectedVerb ? selectedVerb : 'Select a verb to run'}
            </div>
            {selectedVerb && verbDescriptions[selectedVerb] && (
              <div className="text-xs text-dark-400 mb-3 italic">{verbDescriptions[selectedVerb]}</div>
            )}
            <div className="mb-3">
              <div className="text-xs text-dark-500 mb-1">Request body (JSON)</div>
              <textarea
                value={inputJson}
                onChange={e => setInputJson(e.target.value)}
                rows={6}
                className="w-full bg-dark-900/60 border border-dark-600/50 rounded-lg px-3 py-2 text-xs text-dark-200 font-mono placeholder-dark-600 resize-none focus:outline-none focus:border-blue-500/60"
                placeholder='{ "id": "123" }'
              />
            </div>
            {error && <ErrorBlock message={error} />}
            <div className="flex gap-2">
              <Btn variant="primary" onClick={runVerb} disabled={!selectedVerb || loading}>
                {loading ? 'Running…' : '▶ Run AI Verb'}
              </Btn>
              <Btn variant="ghost" size="sm" onClick={() => { setResults([]); setError(''); }}>Clear Results</Btn>
            </div>
          </Card>

          {/* Results history */}
          {results.map((entry, i) => (
            <Card key={i} className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-semibold text-blue-400">{entry.verb}</div>
                <div className="flex items-center gap-3">
                  {entry.model && <span className="text-xs text-dark-500">{entry.model}</span>}
                  <span className="text-xs text-dark-500">{entry.ts}</span>
                </div>
              </div>
              <AIResultPanel result={entry.result} label="" />
            </Card>
          ))}
        </div>
      </div>

      <Toast message={toastMsg} />
    </div>
  );
}
