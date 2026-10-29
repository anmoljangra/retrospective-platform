import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { apiClient } from '../../lib/api-client';
import {
  MessageSquare,
  X,
  Send,
  Trash2,
  Loader2,
  AlertCircle,
} from 'lucide-react';

interface CommentItem {
  id: string;
  feedbackCardId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

interface CardCommentsModalProps {
  retrospectiveId: string;
  cardId: string;
  cardContent: string;
  isOpen: boolean;
  onClose: () => void;
  onCommentCountChange?: (newCount: number) => void;
}

export function CardCommentsModal({
  retrospectiveId,
  cardId,
  cardContent,
  isOpen,
  onClose,
  onCommentCountChange,
}: CardCommentsModalProps) {
  const { activeTenant, user } = useAuth();
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadComments = async () => {
    if (!activeTenant) return;
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient<CommentItem[]>(
        `/tenants/${activeTenant.tenantId}/retrospectives/${retrospectiveId}/cards/${cardId}/comments`
      );
      setComments(data);
      onCommentCountChange?.(data.length);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadComments();
    }
  }, [isOpen, cardId]);

  if (!isOpen) return null;

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant || !newComment.trim()) return;

    try {
      setSubmitting(true);
      const created = await apiClient<CommentItem>(
        `/tenants/${activeTenant.tenantId}/retrospectives/${retrospectiveId}/cards/${cardId}/comments`,
        {
          method: 'POST',
          body: JSON.stringify({ content: newComment.trim() }),
        }
      );

      const updated = [...comments, created];
      setComments(updated);
      setNewComment('');
      onCommentCountChange?.(updated.length);
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!activeTenant) return;
    try {
      await apiClient(
        `/tenants/${activeTenant.tenantId}/retrospectives/${retrospectiveId}/cards/${cardId}/comments/${commentId}`,
        { method: 'DELETE' }
      );
      const updated = comments.filter((c) => c.id !== commentId);
      setComments(updated);
      onCommentCountChange?.(updated.length);
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to delete comment');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative flex flex-col max-h-[85vh]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-2.5 mb-2">
          <MessageSquare className="w-5 h-5 text-indigo-400" />
          <h3 className="text-base font-bold text-white">Card Discussion</h3>
        </div>

        {/* Card quote */}
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs text-slate-300 italic mb-4 line-clamp-3">
          "{cardContent}"
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-950/60 border border-red-800 text-red-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-4">
          {loading ? (
            <div className="p-8 text-center text-slate-500 flex items-center justify-center space-x-2">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
              <span className="text-xs">Loading comments...</span>
            </div>
          ) : comments.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No comments yet. Start the conversation below!
            </div>
          ) : (
            comments.map((comment) => (
              <div
                key={comment.id}
                className="p-3 bg-slate-950/60 border border-slate-800/60 rounded-xl space-y-1 group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300">
                    {comment.authorName}
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] text-slate-500">
                      {new Date(comment.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {comment.authorId === user?.id && (
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-200 whitespace-pre-wrap">{comment.content}</p>
              </div>
            ))
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleAddComment} className="pt-3 border-t border-slate-800 flex space-x-2">
          <input
            type="text"
            required
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment or question..."
            className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={submitting || !newComment.trim()}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center justify-center transition-colors"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

