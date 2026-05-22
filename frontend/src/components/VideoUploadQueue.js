import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * VideoUploadQueue
 * --------------------------------------------------------------
 * Drag-and-drop video uploader + live analysis queue.
 *
 *   POST /api/custom-views/upload-video   (multipart, field "video")
 *   GET  /api/custom-views/queue          -> { items: [...] }
 *
 * Queue items progress pending -> processing -> done on the server,
 * with a mock authenticity_score attached on completion.
 */

function fmtBytes(n) {
  if (n == null) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function statusBadge(status) {
  const map = {
    pending:    { bg: 'rgba(148,163,184,0.18)', fg: '#cbd5e1', label: 'Pending'    },
    processing: { bg: 'rgba(245,158,11,0.18)',  fg: '#fbbf24', label: 'Processing' },
    done:       { bg: 'rgba(16,185,129,0.18)',  fg: '#34d399', label: 'Done'       },
    error:      { bg: 'rgba(239,68,68,0.18)',   fg: '#fca5a5', label: 'Error'      },
  };
  return map[status] || map.pending;
}

function scoreColor(score) {
  if (score == null) return '#64748b';
  if (score >= 60) return '#10b981';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

export default function VideoUploadQueue() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const fetchQueue = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/custom-views/queue', {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      setItems(Array.isArray(j?.items) ? j.items : []);
    } catch (e) {
      // Surface fetch errors but don't blow away the existing list.
      setError(e.message || 'Failed to load queue');
    }
  }, []);

  useEffect(() => {
    fetchQueue();
    const id = setInterval(fetchQueue, 2000);
    return () => clearInterval(id);
  }, [fetchQueue]);

  const doUpload = useCallback(async (file) => {
    if (!file) return;
    setError(null);
    setUploading(true);
    setProgressPct(0);
    try {
      const token = localStorage.getItem('token');
      const form = new FormData();
      form.append('video', file);

      // Use XHR for upload progress.
      const result = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/custom-views/upload-video');
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) {
            setProgressPct(Math.round((ev.loaded / ev.total) * 100));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try { resolve(JSON.parse(xhr.responseText || '{}')); }
            catch (_) { resolve({}); }
          } else {
            let msg = `HTTP ${xhr.status}`;
            try { const j = JSON.parse(xhr.responseText || '{}'); if (j?.error) msg = j.error; } catch (_) {}
            reject(new Error(msg));
          }
        };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.send(form);
      });

      if (!result?.queue_id) throw new Error('Upload accepted but no queue_id returned');
      // Refresh immediately to show the new pending item.
      await fetchQueue();
    } catch (e) {
      setError(e.message || 'Upload failed');
    } finally {
      setUploading(false);
      setProgressPct(0);
    }
  }, [fetchQueue]);

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer?.files || []);
    const video = files.find(f => f.type.startsWith('video/')) || files[0];
    if (video) doUpload(video);
  };

  const onFilePicked = (e) => {
    const f = e.target.files?.[0];
    if (f) doUpload(f);
    e.target.value = '';
  };

  return (
    <div data-testid="video-upload-queue" style={{ width: '100%' }}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {/* Drop zone */}
        <div
          data-testid="video-drop-zone"
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            flex: '1 1 360px',
            minWidth: 280,
            minHeight: 180,
            padding: 20,
            background: dragOver ? 'rgba(59,130,246,0.10)' : 'rgba(15,23,42,0.6)',
            border: `2px dashed ${dragOver ? '#60a5fa' : 'rgba(148,163,184,0.35)'}`,
            borderRadius: 14,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 150ms ease',
          }}
        >
          <div style={{ fontSize: 36, color: '#60a5fa' }}>⬆</div>
          <div style={{ marginTop: 8, fontSize: 14, color: '#e2e8f0', fontWeight: 700 }}>
            Drop a video here, or click to choose
          </div>
          <div style={{ marginTop: 4, fontSize: 11, color: '#94a3b8' }}>
            Max 200MB · mp4 / mov / webm
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            data-testid="video-file-input"
            onChange={onFilePicked}
            style={{ display: 'none' }}
          />
          {uploading && (
            <div style={{ marginTop: 14, width: '80%' }}>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
                Uploading… {progressPct}%
              </div>
              <div style={{ height: 6, background: 'rgba(148,163,184,0.2)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  width: `${progressPct}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg,#3b82f6,#8b5cf6)',
                  transition: 'width 150ms ease',
                }} />
              </div>
            </div>
          )}
          {error && (
            <div style={{
              marginTop: 12,
              fontSize: 11,
              color: '#fecaca',
              background: 'rgba(239,68,68,0.10)',
              border: '1px solid rgba(239,68,68,0.4)',
              borderRadius: 6,
              padding: '4px 8px',
            }}>
              {error}
            </div>
          )}
        </div>

        {/* Queue list */}
        <div style={{ flex: '2 1 420px', minWidth: 320 }}>
          <div style={{
            background: 'rgba(15,23,42,0.6)',
            border: '1px solid rgba(148,163,184,0.2)',
            borderRadius: 12,
            padding: 12,
            marginBottom: 8,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>
              Analysis queue
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              {items.length} item{items.length === 1 ? '' : 's'} · refreshes every 2s
            </div>
          </div>

          <div data-testid="queue-list" style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 360, overflowY: 'auto' }}>
            {items.length === 0 && (
              <div style={{ padding: 14, fontSize: 12, color: '#94a3b8', textAlign: 'center', background: 'rgba(15,23,42,0.4)', borderRadius: 8 }}>
                No items yet. Upload a video to queue an analysis.
              </div>
            )}
            {items.map(item => {
              const badge = statusBadge(item.status);
              return (
                <div
                  key={item.queue_id}
                  data-testid="queue-item"
                  style={{
                    background: 'rgba(15,23,42,0.55)',
                    border: '1px solid rgba(148,163,184,0.18)',
                    borderRadius: 10,
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.file_name}
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>
                      {item.queue_id} · {fmtBytes(item.size_bytes)} · {item.mimetype || 'video'}
                    </div>
                  </div>
                  {item.status === 'done' && item.authenticity_score != null && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>Authenticity</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: scoreColor(item.authenticity_score) }}>
                        {item.authenticity_score}%
                      </div>
                      {item.verdict && (
                        <div style={{ fontSize: 10, color: scoreColor(item.authenticity_score) }}>
                          {item.verdict}
                        </div>
                      )}
                    </div>
                  )}
                  <span style={{
                    padding: '3px 10px',
                    borderRadius: 999,
                    background: badge.bg,
                    color: badge.fg,
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    whiteSpace: 'nowrap',
                  }}>
                    {badge.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
