# Audit Apply Notes — AIDeepfakeDetectionPlatform

Source: `/Users/erolakarsu/projects/_AUDIT/reports/batch_02.md` (lines 1048-1076).

The audit reports 0 AI endpoints. Inspection shows:
- `routes/aiNew.js`: `/batch-analyze`, `/export-report`, `/watchlist-check`.
- `routes/features.js`: per-resource `:id/analyze` AI endpoints created via a
  factory pattern, plus `users/:id/analyze` and a dashboard-stats endpoint.

The "0 AI endpoints" reading is likely because the factory generates routes at
runtime. The codebase does have AI integration.

## Original audit recommendations

### Missing AI counterparts (audit)
- `/detect-deepfake`, `/analyze-media`, `/detect-face-swapping`,
  `/detect-voice-cloning`, `/generate-authenticity-score`, `/explain-detection`.

### Missing non-AI features
- Media upload/processing pipeline.
- Database for storing detection results.
- Analytics or reporting.
- Social-platform monitoring integration.

### Custom feature suggestions
- Real-time media authentication.
- Social media monitoring.
- Media provenance tracking.
- Explainability.

## Implemented in this pass

None. The audit gap is that real CV-based deepfake detection requires
purpose-built models (not LLM prompts) — adding stub LLM endpoints named
`/detect-deepfake` would be misleading. Backlog-only with explicit risk
flags.

## Backlog (prioritized)

### Mechanical, low-risk
1. `/api/ai/explain-detection` — given a detection result payload, generate
   a human-readable explanation (LLM is appropriate here).
2. `/api/ai/generate-authenticity-score-narrative` — turn metadata into a
   narrative (LLM-appropriate).

### Needs product decision
- Detection-results schema (what do real detectors emit, what do we store?).
- Media-pipeline architecture (queueing, model serving).

### Needs credentials / external SDK
- Specialized deepfake detection models (e.g., Microsoft Video Authenticator,
  Sensity AI, Reality Defender).
- Social platform APIs for monitoring.

### Too risky / large refactor
- Rolling out LLM-based "deepfake detection" endpoints — LLMs cannot reliably
  detect deepfakes from raw media. Real detection needs CV models.
- Real-time media authentication / watermarking infrastructure.

## Apply pass 3 (frontend)

LEFT-AS-IS. The React/Vite frontend already exposes an `AITools.jsx` page (in
`frontend/src/pages/`) that wires every backend AI endpoint
(`/batch-analyze`, `/export-report`, `/watchlist-check`) plus webhooks. JWT
Bearer auth is handled by `services/api.js`. Idempotence rule applies — no
changes made.

## Apply pass 4 (mechanical backlog)

LEFT-AS-IS. Both mechanical backlog items are already implemented in this
repository:

- `POST /api/ai/explain-detection` (BE: `backend/src/routes/aiNew.js` lines
  287-347, with `callAI` 503-on-no-key + `parseAIJson`).
- `POST /api/ai/generate-authenticity-score-narrative` (BE: same file lines
  351-394).

Frontend coverage: `frontend/src/pages/AITools.jsx` already ships
"Explain Detection" and "Score Narrative" tabs that POST to those endpoints
via `api.aiExplainDetection` / `api.aiAuthenticityNarrative` (defined in
`frontend/src/services/api.js`), with JWT bearer + 503-friendly error
handling. Idempotent — no new files written.
