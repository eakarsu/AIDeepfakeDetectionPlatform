import React from 'react';

const riskColors = {
  low: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400', badge: 'bg-green-500/20 text-green-300' },
  medium: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', badge: 'bg-yellow-500/20 text-yellow-300' },
  high: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400', badge: 'bg-orange-500/20 text-orange-300' },
  critical: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', badge: 'bg-red-500/20 text-red-300' },
};

const VerdictBadge = ({ verdict }) => {
  const isGood = /authentic|verified|clean|secure|normal|original|no_swap|natural|nominal|low_threat|valid/i.test(verdict);
  const isBad = /deepfake|manipulated|synthetic|confirmed|critical|compromised|violation|disinformation|swap/i.test(verdict);
  const color = isGood ? 'bg-green-500/20 text-green-300 border-green-500/30' : isBad ? 'bg-red-500/20 text-red-300 border-red-500/30' : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
  return (
    <span className={`inline-block px-4 py-2 rounded-full border text-sm font-bold uppercase tracking-wider ${color}`}>
      {String(verdict).replace(/_/g, ' ')}
    </span>
  );
};

const ConfidenceRing = ({ percentage }) => {
  const p = Number(percentage) || 0;
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (p / 100) * circumference;
  const color = p >= 80 ? '#ef4444' : p >= 50 ? '#f59e0b' : '#22c55e';

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="100" height="100" className="-rotate-90">
        <circle cx="50" cy="50" r="40" stroke="#334155" strokeWidth="6" fill="none" />
        <circle cx="50" cy="50" r="40" stroke={color} strokeWidth="6" fill="none"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease-out' }} />
      </svg>
      <div className="absolute text-center">
        <div className="text-xl font-bold" style={{ color }}>{p}%</div>
        <div className="text-[10px] text-dark-400">confidence</div>
      </div>
    </div>
  );
};

const Section = ({ title, children }) => (
  <div className="mb-4">
    <h4 className="text-sm font-semibold text-dark-300 uppercase tracking-wider mb-2 flex items-center gap-2">
      <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
      {title}
    </h4>
    <div className="bg-dark-800/50 rounded-xl p-4 border border-dark-700/30">
      {children}
    </div>
  </div>
);

const renderValue = (value, depth = 0) => {
  if (value === null || value === undefined) return <span className="text-dark-500 italic">N/A</span>;
  if (typeof value === 'boolean') return <span className={value ? 'text-green-400' : 'text-red-400'}>{value ? 'Yes' : 'No'}</span>;
  if (typeof value === 'number') return <span className="text-blue-400 font-mono">{value}</span>;
  if (typeof value === 'string') return <span className="text-dark-200">{value}</span>;

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-dark-500 italic">None</span>;
    if (typeof value[0] === 'string') {
      return (
        <div className="flex flex-wrap gap-2">
          {value.map((v, i) => (
            <span key={i} className="px-3 py-1 bg-dark-700/50 rounded-full text-xs text-dark-200 border border-dark-600/30">
              {v}
            </span>
          ))}
        </div>
      );
    }
    return (
      <div className="space-y-2">
        {value.map((item, i) => (
          <div key={i} className="bg-dark-700/30 rounded-lg p-3 border border-dark-600/20">
            {typeof item === 'object' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(item).map(([k, v]) => (
                  <div key={k}>
                    <span className="text-xs text-dark-400 capitalize">{k.replace(/_/g, ' ')}: </span>
                    {renderValue(v, depth + 1)}
                  </div>
                ))}
              </div>
            ) : renderValue(item, depth + 1)}
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === 'object') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Object.entries(value).map(([k, v]) => (
          <div key={k} className="bg-dark-700/20 rounded-lg p-3">
            <div className="text-xs text-dark-400 capitalize mb-1">{k.replace(/_/g, ' ')}</div>
            <div className="text-sm">{renderValue(v, depth + 1)}</div>
          </div>
        ))}
      </div>
    );
  }

  return <span>{String(value)}</span>;
};

export default function AIResultDisplay({ result, loading }) {
  if (loading) {
    return (
      <div className="bg-dark-800/80 rounded-2xl p-8 border border-dark-700/50 text-center">
        <div className="inline-block">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <div className="text-lg font-semibold text-blue-400 animate-pulse">Analyzing with AI...</div>
          <div className="text-sm text-dark-400 mt-2">Processing through {result?.model || 'OpenRouter AI'}</div>
        </div>
      </div>
    );
  }

  if (!result) return null;

  if (!result.success) {
    return (
      <div className="bg-red-500/10 rounded-2xl p-6 border border-red-500/30">
        <div className="text-red-400 font-semibold mb-2">Analysis Failed</div>
        <div className="text-dark-300 text-sm">{result.error}</div>
        <div className="text-dark-500 text-xs mt-2">Model: {result.model} | Time: {result.analyzed_at}</div>
      </div>
    );
  }

  const analysis = result.analysis;
  if (!analysis) return null;

  const risk = riskColors[analysis.risk_level] || riskColors.medium;
  const { verdict, confidence_percentage, risk_level, summary, recommendations, detection_methods, ...sections } = analysis;

  return (
    <div className={`rounded-2xl border ${risk.border} overflow-hidden`}>
      {/* Header */}
      <div className={`${risk.bg} p-6 border-b ${risk.border}`}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="text-xs text-dark-400 uppercase tracking-wider mb-2">AI Analysis Result</div>
            {verdict && <VerdictBadge verdict={verdict} />}
            {summary && <p className="text-dark-200 text-sm mt-3 max-w-2xl leading-relaxed">{summary}</p>}
          </div>
          {confidence_percentage !== undefined && <ConfidenceRing percentage={confidence_percentage} />}
        </div>

        {risk_level && (
          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs text-dark-400">Risk Level:</span>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${risk.badge}`}>{risk_level}</span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-6 bg-dark-900/50 space-y-4">
        {detection_methods && (
          <Section title="Detection Methods">
            <div className="flex flex-wrap gap-2">
              {detection_methods.map((m, i) => (
                <span key={i} className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-300">{m}</span>
              ))}
            </div>
          </Section>
        )}

        {Object.entries(sections).map(([key, value]) => {
          if (key === 'raw_analysis') return null;
          return (
            <Section key={key} title={key.replace(/_/g, ' ')}>
              {renderValue(value)}
            </Section>
          );
        })}

        {recommendations && (
          <Section title="Recommendations">
            <div className="space-y-2">
              {recommendations.map((r, i) => (
                <div key={i} className="flex items-start gap-3 p-2">
                  <span className="mt-0.5 w-5 h-5 bg-blue-500/20 rounded-full flex items-center justify-center text-xs text-blue-400 shrink-0">{i + 1}</span>
                  <span className="text-sm text-dark-200">{r}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Footer */}
        <div className="pt-4 border-t border-dark-700/30 flex items-center justify-between text-xs text-dark-500">
          <span>Model: {result.model}</span>
          <span>Analyzed: {new Date(result.analyzed_at).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
