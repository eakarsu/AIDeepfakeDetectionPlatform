/**
 * Shared UI primitives for all Trust & Safety pages.
 * Import from here, not from individual pages.
 */
import React from 'react';

export const severityColors = {
  critical: 'bg-red-500/20 text-red-400 border border-red-500/40',
  high:     'bg-orange-500/20 text-orange-400 border border-orange-500/40',
  medium:   'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40',
  low:      'bg-green-500/20 text-green-400 border border-green-500/40',
  unknown:  'bg-dark-600/40 text-dark-400 border border-dark-600/30',
};

export const statusColors = {
  active:        'bg-emerald-500/15 text-emerald-400',
  pending:       'bg-dark-600/40 text-dark-300',
  in_review:     'bg-blue-500/15 text-blue-400',
  draft:         'bg-slate-500/15 text-slate-400',
  published:     'bg-green-500/15 text-green-400',
  shared:        'bg-blue-500/15 text-blue-400',
  revoked:       'bg-red-500/15 text-red-400',
  resolved:      'bg-green-500/15 text-green-400',
  upheld:        'bg-green-500/15 text-green-400',
  overturned:    'bg-yellow-500/15 text-yellow-400',
  deprecated:    'bg-dark-600/40 text-dark-400',
  escalated:     'bg-orange-500/15 text-orange-400',
  deleted:       'bg-red-500/15 text-red-400',
  archived:      'bg-dark-600/40 text-dark-400',
};

export function SeverityBadge({ label }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${severityColors[label] || severityColors.unknown}`}>
      {label || 'unknown'}
    </span>
  );
}

export function StatusBadge({ status }) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${statusColors[status] || 'bg-dark-600/40 text-dark-400'}`}>
      {status || '—'}
    </span>
  );
}

export function CsamBanner() {
  return (
    <div className="mb-6 flex items-start gap-3 bg-red-900/30 border border-red-500/50 rounded-xl p-4">
      <span className="text-2xl flex-shrink-0">🔐</span>
      <div>
        <div className="font-bold text-red-300 text-sm mb-0.5">Hash-only — no content access</div>
        <div className="text-red-400/80 text-xs leading-relaxed">
          This module stores and displays <strong>cryptographic hash values, severity labels, and case metadata only</strong>.
          No content thumbnails, descriptions, or representations of actual material are present or accessible here.
          All identifiers are opaque references used solely for detection and legal reporting purposes.
        </div>
      </div>
    </div>
  );
}

export function LoadingSpinner({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-20 text-dark-400">
      <div className="w-6 h-6 border-2 border-blue-500/40 border-t-blue-500 rounded-full animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function ErrorBlock({ message }) {
  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
      {message}
    </div>
  );
}

export function PageHeader({ icon, title, subtitle, actions }) {
  return (
    <div className="flex items-start justify-between mb-6 gap-4">
      <div className="flex items-center gap-3">
        <span className="text-3xl">{icon}</span>
        <div>
          <h1 className="text-xl font-bold text-white">{title}</h1>
          {subtitle && <p className="text-sm text-dark-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = '' }) {
  return (
    <div className={`bg-dark-800/60 border border-dark-700/50 rounded-xl ${className}`}>
      {children}
    </div>
  );
}

export function Btn({ onClick, variant = 'default', size = 'md', children, disabled }) {
  const variants = {
    default:   'bg-dark-700/60 hover:bg-dark-600/60 text-dark-200 border border-dark-600/50',
    primary:   'bg-blue-600 hover:bg-blue-500 text-white',
    danger:    'bg-red-600 hover:bg-red-500 text-white',
    success:   'bg-emerald-600 hover:bg-emerald-500 text-white',
    warning:   'bg-amber-600 hover:bg-amber-500 text-white',
    ghost:     'hover:bg-dark-700/50 text-dark-300 hover:text-white',
  };
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-5 py-2.5 text-base' };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]}`}
    >
      {children}
    </button>
  );
}

export function AIResultPanel({ result, loading, label }) {
  if (loading) return (
    <div className="flex items-center gap-2 text-dark-400 text-sm py-3">
      <div className="w-4 h-4 border-2 border-blue-500/40 border-t-blue-500 rounded-full animate-spin" />
      Running AI analysis…
    </div>
  );
  if (!result) return null;
  return (
    <div className="mt-3 bg-dark-900/60 border border-dark-600/50 rounded-lg p-4">
      {label && <div className="text-xs font-semibold text-dark-400 uppercase tracking-wide mb-2">{label}</div>}
      {typeof result === 'string'
        ? <pre className="text-xs text-dark-200 whitespace-pre-wrap">{result}</pre>
        : <pre className="text-xs text-dark-200 whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
      }
    </div>
  );
}

export function toast(msg, setter) {
  setter(msg);
  setTimeout(() => setter(''), 3000);
}

export function Toast({ message }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-6 right-6 z-50 bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 text-sm text-white shadow-xl">
      {message}
    </div>
  );
}
