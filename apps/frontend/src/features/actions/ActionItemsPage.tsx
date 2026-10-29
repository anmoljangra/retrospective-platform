import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { apiClient } from '../../lib/api-client';
import {
  ActionItemStatus,
  ActionItemPriority,
  type UpdateActionItemInput,
} from '@retrospace/shared';
import {
  CheckSquare,
  Clock,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Circle,
  PlayCircle,
  Trash2,
  Filter,
  Columns3,
  Loader2,
  AlertCircle,
  LayoutGrid,
  List,
} from 'lucide-react';

interface ActionItem {
  id: string;
  tenantId: string;
  retrospectiveId: string;
  retrospectiveTitle: string;
  feedbackCardId: string | null;
  title: string;
  description: string;
  status: ActionItemStatus;
  priority: ActionItemPriority;
  assigneeId: string | null;
  assigneeName: string | null;
  dueDate: string | null;
  createdAt: string;
}

export function ActionItemsPage() {
  const { activeTenant } = useAuth();
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');

  const loadItems = async () => {
    if (!activeTenant) return;
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (priorityFilter !== 'ALL') params.append('priority', priorityFilter);

      const queryString = params.toString() ? `?${params.toString()}` : '';
      const data = await apiClient<ActionItem[]>(
        `/tenants/${activeTenant.tenantId}/action-items${queryString}`
      );
      setItems(data);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load action items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, [activeTenant?.tenantId, statusFilter, priorityFilter]);

  const handleStatusChange = async (itemId: string, newStatus: ActionItemStatus) => {
    if (!activeTenant) return;
    try {
      // Optimistic update
      setItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, status: newStatus } : i))
      );

      await apiClient(
        `/tenants/${activeTenant.tenantId}/action-items/${itemId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: newStatus }),
        }
      );
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to update status');
      await loadItems();
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!activeTenant) return;
    if (!confirm('Are you sure you want to delete this action item?')) return;

    try {
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      await apiClient(
        `/tenants/${activeTenant.tenantId}/action-items/${itemId}`,
        { method: 'DELETE' }
      );
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to delete action item');
      await loadItems();
    }
  };

  if (!activeTenant) {
    return (
      <div className="p-8 text-center text-slate-400">
        Please select an active organization first.
      </div>
    );
  }

  const columns: { id: ActionItemStatus; label: string; icon: any; color: string }[] = [
    { id: ActionItemStatus.TODO, label: 'To Do', icon: Circle, color: '#94A3B8' },
    { id: ActionItemStatus.IN_PROGRESS, label: 'In Progress', icon: PlayCircle, color: '#6366F1' },
    { id: ActionItemStatus.DONE, label: 'Completed', icon: CheckCircle2, color: '#10B981' },
  ];

  const isOverdue = (dueDate: string | null, status: ActionItemStatus) => {
    if (!dueDate || status === ActionItemStatus.DONE) return false;
    return new Date(dueDate) < new Date();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <CheckSquare className="w-6 h-6 text-indigo-400" />
            <h1 className="text-2xl font-bold text-white tracking-tight">Action Items</h1>
          </div>
          <p className="text-sm text-slate-400">
            Accountability and continuous improvement tasks in <strong className="text-white">{activeTenant.tenantName}</strong>
          </p>
        </div>

        {/* View Switcher */}
        <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 p-1 rounded-xl self-start sm:self-auto">
          <button
            onClick={() => setViewMode('board')}
            className={`p-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
              viewMode === 'board'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span>Board</span>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
              viewMode === 'list'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <List className="w-4 h-4" />
            <span>Table</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-900/60 border border-slate-800 rounded-xl text-xs">
        <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px] flex items-center space-x-1">
          <Filter className="w-3.5 h-3.5" />
          <span>Filters:</span>
        </span>

        {/* Priority Filter */}
        <div className="flex items-center space-x-1">
          <span className="text-slate-400">Priority:</span>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="ALL">All Priorities</option>
            <option value={ActionItemPriority.HIGH}>HIGH</option>
            <option value={ActionItemPriority.MEDIUM}>MEDIUM</option>
            <option value={ActionItemPriority.LOW}>LOW</option>
          </select>
        </div>

        {/* Status Filter (Active in list view) */}
        {viewMode === 'list' && (
          <div className="flex items-center space-x-1">
            <span className="text-slate-400">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">All Statuses</option>
              <option value={ActionItemStatus.TODO}>To Do</option>
              <option value={ActionItemStatus.IN_PROGRESS}>In Progress</option>
              <option value={ActionItemStatus.DONE}>Completed</option>
            </select>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/60 border border-red-800/80 text-red-200 text-sm flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-slate-500 flex items-center justify-center space-x-2">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
          <span className="text-sm">Loading action items...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="p-12 rounded-2xl bg-slate-900 border border-slate-800 text-center max-w-lg mx-auto">
          <div className="h-12 w-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mx-auto mb-4">
            <CheckSquare className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-white mb-1">No Action Items Yet</h3>
          <p className="text-xs text-slate-400 mb-6">
            Action items can be converted directly from feedback cards during retrospectives.
          </p>
          <Link
            to="/retrospectives"
            className="inline-block px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow"
          >
            Go to Retrospectives
          </Link>
        </div>
      ) : viewMode === 'board' ? (
        /* Kanban View */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {columns.map((col) => {
            const colItems = items.filter((i) => i.status === col.id);
            const Icon = col.icon;

            return (
              <div
                key={col.id}
                className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                  <div className="flex items-center space-x-2">
                    <Icon className="w-4 h-4" style={{ color: col.color }} />
                    <h2 className="text-sm font-bold text-white">{col.label}</h2>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-400 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                    {colItems.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {colItems.map((item) => {
                    const overdue = isOverdue(item.dueDate, item.status);

                    return (
                      <div
                        key={item.id}
                        className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 shadow-sm transition-all space-y-2 group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-xs font-semibold text-white line-clamp-2">
                            {item.title}
                          </h3>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {item.description && (
                          <p className="text-[11px] text-slate-400 line-clamp-2">
                            {item.description}
                          </p>
                        )}

                        <div className="pt-2 border-t border-slate-900 flex flex-wrap items-center justify-between gap-2 text-[10px]">
                          {/* Priority pill */}
                          <span
                            className={`px-1.5 py-0.5 rounded font-semibold ${
                              item.priority === ActionItemPriority.HIGH
                                ? 'bg-red-950/80 text-red-300 border border-red-800/60'
                                : item.priority === ActionItemPriority.MEDIUM
                                ? 'bg-amber-950/80 text-amber-300 border border-amber-800/60'
                                : 'bg-blue-950/80 text-blue-300 border border-blue-800/60'
                            }`}
                          >
                            {item.priority}
                          </span>

                          {/* Overdue / Due Date */}
                          {item.dueDate && (
                            <span
                              className={`flex items-center space-x-1 px-1.5 py-0.5 rounded ${
                                overdue
                                  ? 'bg-red-950 text-red-400 font-bold border border-red-800'
                                  : 'text-slate-500'
                              }`}
                            >
                              {overdue && <AlertTriangle className="w-3 h-3 text-red-400" />}
                              <span>{new Date(item.dueDate).toLocaleDateString()}</span>
                            </span>
                          )}

                          {/* Quick Status Select */}
                          <select
                            value={item.status}
                            onChange={(e) =>
                              handleStatusChange(item.id, e.target.value as ActionItemStatus)
                            }
                            className="bg-slate-900 border border-slate-800 text-[10px] rounded px-1.5 py-0.5 text-slate-300 focus:outline-none"
                          >
                            <option value={ActionItemStatus.TODO}>To Do</option>
                            <option value={ActionItemStatus.IN_PROGRESS}>In Progress</option>
                            <option value={ActionItemStatus.DONE}>Done</option>
                          </select>
                        </div>

                        {/* Originating Retro */}
                        <div className="text-[10px] text-slate-500 truncate pt-1">
                          From: <Link to={`/retrospectives/${item.retrospectiveId}`} className="text-indigo-400 hover:underline">{item.retrospectiveTitle}</Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800 bg-slate-950/40">
                <tr>
                  <th className="py-3 px-4">Task</th>
                  <th className="py-3 px-4">Retrospective</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Assignee</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-medium text-white max-w-xs truncate">
                      {item.title}
                    </td>
                    <td className="py-3 px-4 text-indigo-400 truncate">
                      <Link to={`/retrospectives/${item.retrospectiveId}`} className="hover:underline">
                        {item.retrospectiveTitle}
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          item.priority === ActionItemPriority.HIGH
                            ? 'bg-red-950 text-red-300'
                            : item.priority === ActionItemPriority.MEDIUM
                            ? 'bg-amber-950 text-amber-300'
                            : 'bg-blue-950 text-blue-300'
                        }`}
                      >
                        {item.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <select
                        value={item.status}
                        onChange={(e) =>
                          handleStatusChange(item.id, e.target.value as ActionItemStatus)
                        }
                        className="bg-slate-950 border border-slate-800 text-xs rounded px-2 py-1 text-slate-200"
                      >
                        <option value={ActionItemStatus.TODO}>To Do</option>
                        <option value={ActionItemStatus.IN_PROGRESS}>In Progress</option>
                        <option value={ActionItemStatus.DONE}>Done</option>
                      </select>
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {item.assigneeName || 'Unassigned'}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

