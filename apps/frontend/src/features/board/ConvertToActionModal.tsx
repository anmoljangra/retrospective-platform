import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { apiClient } from '../../lib/api-client';
import { ActionItemPriority, type CreateActionItemInput } from '@retrospace/shared';
import { CheckSquare, X, Loader2, AlertCircle } from 'lucide-react';

interface ConvertToActionModalProps {
  retrospectiveId: string;
  cardId: string;
  initialContent: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ConvertToActionModal({
  retrospectiveId,
  cardId,
  initialContent,
  isOpen,
  onClose,
  onSuccess,
}: ConvertToActionModalProps) {
  const { activeTenant } = useAuth();
  const [title, setTitle] = useState(initialContent);
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<ActionItemPriority>(ActionItemPriority.MEDIUM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant || !title.trim()) return;

    try {
      setSubmitting(true);
      setError(null);

      const payload: CreateActionItemInput = {
        feedbackCardId: cardId,
        title: title.trim(),
        description: description.trim(),
        priority,
      };

      await apiClient(
        `/tenants/${activeTenant.tenantId}/retrospectives/${retrospectiveId}/action-items`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );

      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to create action item');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-2.5 mb-2">
          <CheckSquare className="w-5 h-5 text-indigo-400" />
          <h3 className="text-base font-bold text-white">Convert to Action Item</h3>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Turn this retrospective observation into a tracked action task
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-950/60 border border-red-800 text-red-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Task Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Task Details (optional)
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Implementation notes, next steps..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as ActionItemPriority)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value={ActionItemPriority.LOW}>LOW</option>
              <option value={ActionItemPriority.MEDIUM}>MEDIUM</option>
              <option value={ActionItemPriority.HIGH}>HIGH</option>
            </select>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !title.trim()}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow disabled:opacity-50 flex items-center"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Action Item'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

