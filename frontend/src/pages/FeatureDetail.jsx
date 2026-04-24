import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, FEATURES } from '../services/api';
import AIResultDisplay from '../components/AIResultDisplay';

const riskBadge = (level) => {
  const colors = {
    low: 'bg-green-500/15 text-green-400 border-green-500/30',
    medium: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    high: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    critical: 'bg-red-500/15 text-red-400 border-red-500/30',
  };
  return colors[level] || 'bg-dark-600/50 text-dark-400 border-dark-600/30';
};

const skipFields = ['id', 'created_at', 'updated_at', 'ai_result', 'created_by', 'password_hash'];

const TAG_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#eab308', '#a855f7', '#f97316', '#06b6d4', '#ec4899', '#6366f1', '#14b8a6'];

export default function FeatureDetail() {
  const { featureKey, id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Bookmark state
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);

  // Comments state
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [editingComment, setEditingComment] = useState(null);
  const [editContent, setEditContent] = useState('');

  // Tags state
  const [itemTags, setItemTags] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3b82f6');

  // File uploads
  const [uploads, setUploads] = useState([]);
  const [uploading, setUploading] = useState(false);

  const feature = FEATURES.find(f => f.key === featureKey);

  useEffect(() => {
    loadItem();
    loadComments();
    loadTags();
    loadBookmark();
    loadUploads();
  }, [featureKey, id]);

  const loadItem = () => {
    api.getOne(featureKey, id)
      .then(data => {
        setItem(data);
        if (data.ai_result) {
          try {
            const parsed = typeof data.ai_result === 'string' ? JSON.parse(data.ai_result) : data.ai_result;
            setAiResult(parsed);
          } catch (e) { /* ignore */ }
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const loadComments = () => {
    api.getComments(featureKey, id).then(setComments).catch(() => {});
  };

  const loadTags = () => {
    Promise.all([
      api.getItemTags(featureKey, id),
      api.getTags(),
    ]).then(([itemT, allT]) => {
      setItemTags(itemT);
      setAllTags(allT);
    }).catch(() => {});
  };

  const loadBookmark = () => {
    api.checkBookmark(featureKey, id).then(data => setBookmarked(data.bookmarked)).catch(() => {});
  };

  const loadUploads = () => {
    api.getUploads(featureKey, id).then(setUploads).catch(() => {});
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAiResult(null);
    try {
      const result = await api.analyze(featureKey, id);
      setAiResult(result);
      const updated = await api.getOne(featureKey, id);
      setItem(updated);
    } catch (err) {
      setAiResult({ success: false, error: err.message, model: 'OpenRouter', analyzed_at: new Date().toISOString() });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.remove(featureKey, id);
      navigate(`/feature/${featureKey}`);
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  const handleToggleBookmark = async () => {
    setBookmarkLoading(true);
    try {
      const displayName = item.title || item.full_name || `Item #${item.id}`;
      const result = await api.toggleBookmark({ feature_key: featureKey, item_id: parseInt(id), item_title: displayName });
      setBookmarked(result.bookmarked);
    } catch (err) { console.error(err); }
    finally { setBookmarkLoading(false); }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setCommentLoading(true);
    try {
      const comment = await api.addComment({ feature_key: featureKey, item_id: parseInt(id), content: newComment });
      setComments([...comments, comment]);
      setNewComment('');
    } catch (err) { alert(err.message); }
    finally { setCommentLoading(false); }
  };

  const handleUpdateComment = async (commentId) => {
    try {
      await api.updateComment(commentId, editContent);
      setComments(comments.map(c => c.id === commentId ? { ...c, content: editContent } : c));
      setEditingComment(null);
    } catch (err) { alert(err.message); }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await api.deleteComment(commentId);
      setComments(comments.filter(c => c.id !== commentId));
    } catch (err) { alert(err.message); }
  };

  const handleAssignTag = async (tagId) => {
    try {
      await api.assignTag({ tag_id: tagId, feature_key: featureKey, item_id: parseInt(id) });
      loadTags();
    } catch (err) { alert(err.message); }
  };

  const handleRemoveTag = async (tagId) => {
    try {
      await api.removeTag(featureKey, id, tagId);
      setItemTags(itemTags.filter(t => t.id !== tagId));
    } catch (err) { alert(err.message); }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    try {
      const tag = await api.createTag({ name: newTagName, color: newTagColor });
      setAllTags([...allTags, tag]);
      setNewTagName('');
    } catch (err) { alert(err.message); }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const upload = await api.uploadFile(file, featureKey, id);
      setUploads([upload, ...uploads]);
    } catch (err) { alert(err.message); }
    finally { setUploading(false); e.target.value = ''; }
  };

  const handleDeleteUpload = async (uploadId) => {
    try {
      await api.deleteUpload(uploadId);
      setUploads(uploads.filter(u => u.id !== uploadId));
    } catch (err) { alert(err.message); }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500 mx-auto mb-3"></div>
        <div className="text-dark-400">Loading...</div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="text-center py-12">
        <div className="text-dark-400">Item not found</div>
        <button onClick={() => navigate(`/feature/${featureKey}`)} className="text-blue-400 mt-2">Go back</button>
      </div>
    );
  }

  const displayName = item.title || item.full_name || item.key_name || `Item #${item.id}`;
  const availableTags = allTags.filter(t => !itemTags.find(it => it.id === t.id));

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
        <div>
          <button onClick={() => navigate(`/feature/${featureKey}`)} className="text-dark-400 hover:text-white text-sm mb-2 flex items-center gap-1">
            ← Back to {feature?.name || featureKey}
          </button>
          <h1 className="text-2xl font-bold text-white">{displayName}</h1>
          {item.description && <p className="text-dark-400 text-sm mt-1 max-w-2xl">{item.description}</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleToggleBookmark}
            disabled={bookmarkLoading}
            className={`px-4 py-2.5 rounded-xl text-sm border transition-colors ${bookmarked ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400' : 'bg-dark-700/80 border-dark-600/50 text-dark-400 hover:text-white'}`}
          >
            {bookmarked ? '★ Bookmarked' : '☆ Bookmark'}
          </button>
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl font-medium text-sm hover:from-blue-600 hover:to-purple-700 transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50"
          >
            {analyzing ? '⟳ Analyzing...' : '🤖 AI Analysis'}
          </button>
          <button
            onClick={() => navigate(`/feature/${featureKey}/${id}/edit`)}
            className="px-5 py-2.5 bg-dark-700/80 border border-dark-600/50 rounded-xl font-medium text-sm hover:bg-dark-600/80 transition-colors"
          >
            Edit
          </button>
          {!deleteConfirm ? (
            <button
              onClick={() => setDeleteConfirm(true)}
              className="px-5 py-2.5 bg-red-500/10 border border-red-500/30 rounded-xl font-medium text-sm text-red-400 hover:bg-red-500/20 transition-colors"
            >
              Delete
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={handleDelete}
                className="px-4 py-2.5 bg-red-600 rounded-xl font-medium text-sm text-white hover:bg-red-700 transition-colors">
                Confirm Delete
              </button>
              <button onClick={() => setDeleteConfirm(false)}
                className="px-4 py-2.5 bg-dark-700/80 rounded-xl font-medium text-sm hover:bg-dark-600/80 transition-colors">
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Status, Risk badges and Tags */}
      <div className="flex flex-wrap gap-2 mb-6">
        {item.status && (
          <span className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-xs font-medium text-blue-300">
            Status: {item.status}
          </span>
        )}
        {item.risk_level && (
          <span className={`px-3 py-1.5 border rounded-full text-xs font-medium ${riskBadge(item.risk_level)}`}>
            Risk: {item.risk_level}
          </span>
        )}
        {item.confidence_score != null && (
          <span className="px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-full text-xs font-medium text-purple-300">
            Confidence: {Number(item.confidence_score).toFixed(1)}%
          </span>
        )}
        {itemTags.map(tag => (
          <span key={tag.id} className="px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5"
            style={{ backgroundColor: tag.color + '20', color: tag.color, border: `1px solid ${tag.color}40` }}>
            {tag.name}
            <button onClick={() => handleRemoveTag(tag.id)} className="hover:opacity-70 text-[10px]">✕</button>
          </span>
        ))}
        <button onClick={() => setShowTagPicker(!showTagPicker)}
          className="px-3 py-1.5 bg-dark-700/50 border border-dark-600/30 rounded-full text-xs text-dark-400 hover:text-white transition-colors">
          + Tag
        </button>
      </div>

      {/* Tag Picker */}
      {showTagPicker && (
        <div className="mb-6 p-4 bg-dark-800/80 rounded-xl border border-dark-700/50">
          <div className="text-sm font-medium mb-2 text-dark-200">Assign Tags</div>
          <div className="flex flex-wrap gap-2 mb-3">
            {availableTags.map(tag => (
              <button key={tag.id} onClick={() => handleAssignTag(tag.id)}
                className="px-3 py-1 rounded-full text-xs transition-colors hover:opacity-80"
                style={{ backgroundColor: tag.color + '20', color: tag.color, border: `1px solid ${tag.color}40` }}>
                + {tag.name}
              </button>
            ))}
            {availableTags.length === 0 && <span className="text-xs text-dark-500">No more tags available</span>}
          </div>
          <div className="flex gap-2 items-center">
            <input type="text" value={newTagName} onChange={e => setNewTagName(e.target.value)} placeholder="New tag name"
              className="px-3 py-1.5 bg-dark-700/50 border border-dark-600/50 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500/50" />
            <div className="flex gap-1">
              {TAG_COLORS.map(c => (
                <button key={c} onClick={() => setNewTagColor(c)}
                  className={`w-5 h-5 rounded-full ${newTagColor === c ? 'ring-2 ring-white ring-offset-1 ring-offset-dark-800' : ''}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
            <button onClick={handleCreateTag} className="px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-lg text-xs hover:bg-blue-500/30">Create</button>
          </div>
        </div>
      )}

      {/* Details Grid */}
      <div className="bg-dark-800/80 backdrop-blur rounded-xl border border-dark-700/50 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <div className="w-1 h-5 bg-blue-500 rounded-full"></div>
          Details
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(item)
            .filter(([key]) => !skipFields.includes(key))
            .map(([key, value]) => {
              if (value === null || value === undefined) return null;
              let displayValue = value;
              if (typeof value === 'object') displayValue = JSON.stringify(value);
              if (typeof value === 'boolean') displayValue = value ? 'Yes' : 'No';
              return (
                <div key={key} className="bg-dark-700/30 rounded-lg p-3">
                  <div className="text-xs text-dark-400 capitalize mb-1">{key.replace(/_/g, ' ')}</div>
                  <div className="text-sm text-dark-200 break-words">{String(displayValue)}</div>
                </div>
              );
            })}
        </div>
        <div className="mt-4 pt-4 border-t border-dark-700/30 flex gap-6 text-xs text-dark-500">
          <span>Created: {item.created_at ? new Date(item.created_at).toLocaleString() : 'N/A'}</span>
          <span>Updated: {item.updated_at ? new Date(item.updated_at).toLocaleString() : 'N/A'}</span>
        </div>
      </div>

      {/* File Uploads */}
      <div className="bg-dark-800/80 backdrop-blur rounded-xl border border-dark-700/50 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <div className="w-1 h-5 bg-cyan-500 rounded-full"></div>
          Attachments
          <span className="text-xs text-dark-500 font-normal">({uploads.length})</span>
        </h2>
        <div className="mb-3">
          <label className="inline-flex items-center gap-2 px-4 py-2 bg-dark-700/50 border border-dark-600/50 rounded-xl text-sm text-dark-300 hover:bg-dark-700 hover:text-white cursor-pointer transition-colors">
            {uploading ? 'Uploading...' : '+ Upload File'}
            <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
          </label>
        </div>
        {uploads.length > 0 ? (
          <div className="space-y-2">
            {uploads.map(u => (
              <div key={u.id} className="flex items-center justify-between p-3 bg-dark-700/30 rounded-lg">
                <div>
                  <div className="text-sm text-white">{u.original_name}</div>
                  <div className="text-xs text-dark-500">{formatFileSize(u.file_size)} · {u.mime_type} · {new Date(u.created_at).toLocaleDateString()}</div>
                </div>
                <button onClick={() => handleDeleteUpload(u.id)} className="text-xs text-dark-500 hover:text-red-400">Delete</button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-dark-500">No files attached</div>
        )}
      </div>

      {/* AI Analysis Results */}
      {(analyzing || aiResult) && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <div className="w-1 h-5 bg-purple-500 rounded-full"></div>
            AI Analysis
          </h2>
          <AIResultDisplay result={aiResult} loading={analyzing} />
        </div>
      )}

      {/* Comments */}
      <div className="bg-dark-800/80 backdrop-blur rounded-xl border border-dark-700/50 p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <div className="w-1 h-5 bg-yellow-500 rounded-full"></div>
          Comments
          <span className="text-xs text-dark-500 font-normal">({comments.length})</span>
        </h2>

        {/* Comment list */}
        {comments.length > 0 ? (
          <div className="space-y-3 mb-4">
            {comments.map(c => (
              <div key={c.id} className="p-3 bg-dark-700/30 rounded-lg">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-[9px] font-bold">
                      {(c.user_name || 'U').charAt(0)}
                    </div>
                    <span className="text-xs font-medium text-white">{c.user_name || 'Unknown'}</span>
                    <span className="text-[10px] text-dark-500">{c.user_role}</span>
                    <span className="text-[10px] text-dark-500">{new Date(c.created_at).toLocaleString()}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingComment(c.id); setEditContent(c.content); }} className="text-[10px] text-dark-500 hover:text-blue-400">Edit</button>
                    <button onClick={() => handleDeleteComment(c.id)} className="text-[10px] text-dark-500 hover:text-red-400">Delete</button>
                  </div>
                </div>
                {editingComment === c.id ? (
                  <div className="flex gap-2">
                    <input type="text" value={editContent} onChange={e => setEditContent(e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-dark-700/50 border border-dark-600/50 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500/50" />
                    <button onClick={() => handleUpdateComment(c.id)} className="px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-lg text-xs">Save</button>
                    <button onClick={() => setEditingComment(null)} className="px-3 py-1.5 bg-dark-700/50 rounded-lg text-xs text-dark-400">Cancel</button>
                  </div>
                ) : (
                  <div className="text-sm text-dark-300 whitespace-pre-wrap">{c.content}</div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-dark-500 mb-4">No comments yet. Be the first to add one.</div>
        )}

        {/* Add comment */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddComment()}
            placeholder="Write a comment..."
            className="flex-1 px-4 py-2.5 bg-dark-700/50 border border-dark-600/50 rounded-xl text-sm text-white placeholder-dark-500 focus:outline-none focus:border-blue-500/50"
          />
          <button onClick={handleAddComment} disabled={commentLoading || !newComment.trim()}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl text-sm font-medium disabled:opacity-50">
            {commentLoading ? '...' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  );
}
