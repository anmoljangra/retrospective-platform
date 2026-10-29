import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { apiClient } from '../../lib/api-client';
import { RetrospectiveStatus } from '@retrospace/shared';
import {
  Columns3,
  Plus,
  Loader2,
  AlertCircle,
  Clock,
  CheckCircle2,
  CircleDot,
  EyeOff,
  ThumbsUp,
  ArrowRight,
  Filter,
} from 'lucide-react';

interface RetrospectiveItem {
  id: string;
  tenantId: string;
  teamId: string;
  teamName: string;
  title: string;
  description: string;
  status: RetrospectiveStatus;
  template: string;
  isAnonymous: boolean;
  votingLimit: number;
  cardCount: number;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
}

export function RetrospectivesPage() {
  const { activeTenant } = useAuth();
  const [retros, setRetros] = useState<RetrospectiveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const loadRetros = async () => {
    if (!activeTenant) return;
    try {
      setLoading(true);
      setError(null);
      const url =
        statusFilter === 'ALL'
          ? `/tenants/${activeTenant.tenantId}/retrospectives`
          : `/tenants/${activeTenant.tenantId}/retrospectives?status=${statusFilter}`;
      const data = await apiClient<RetrospectiveItem[]>(url);
      setRetros(data);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load retrospectives');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRetros();
  }, [activeTenant?.tenantId, statusFilter]);

  if (!activeTenant) {
    return (
      <div className="p-8 text-center text-slate-400">
        Please select an active organization first.
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <Columns3 className="w-6 h-6 text-indigo-400" />
            <h1 className="text-2xl font-bold text-white tracking-tight">Retrospectives</h1>
          </div>
          <p className="text-sm text-slate-400">
            Collaborative Agile boards for <strong className="text-white">{activeTenant.tenantName}</strong>
          </p>
        </div>
        <Link
          to="/retrospectives/new"
          className="inline-flex items-center space-x-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-lg shadow-indigo-600/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Retrospective</span>
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-3 overflow-x-auto">
        {['ALL', RetrospectiveStatus.ACTIVE, RetrospectiveStatus.DRAFT, RetrospectiveStatus.COMPLETED].map(
          (status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                statusFilter === status
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {status === 'ALL' ? 'All Sessions' : status}
            </button>
          )
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
          <span className="text-sm">Loading retrospectives...</span>
        </div>
      ) : retros.length === 0 ? (
        <div className="p-12 rounded-2xl bg-slate-900 border border-slate-800 text-center max-w-lg mx-auto">
          <div className="h-12 w-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mx-auto mb-4">
            <Columns3 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-white mb-1">No Retrospectives Found</h3>
          <p className="text-xs text-slate-400 mb-6">
            Get started by launching an Agile retrospective session with your team.
          </p>
          <Link
            to="/retrospectives/new"
            className="inline-block px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow"
          >
            Create Retrospective
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {retros.map((retro) => {
            const isRetroActive = retro.status === RetrospectiveStatus.ACTIVE;
            const isCompleted = retro.status === RetrospectiveStatus.COMPLETED;

            return (
              <Link
                key={retro.id}
                to={`/retrospectives/${retro.id}`}
                className="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900/90 transition-all group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <span
                      className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide uppercase ${
                        isRetroActive
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                          : isCompleted
                          ? 'bg-slate-800 text-slate-400'
                          : 'bg-amber-950/80 text-amber-300 border border-amber-800/60'
                      }`}
                    >
                      {isRetroActive && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                      <span>{retro.status}</span>
                    </span>

                    <span className="text-[11px] font-medium text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-800/40">
                      {retro.teamName}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-1">
                    {retro.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                    {retro.description || 'Sprint retrospective session'}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
                    {retro.isAnonymous && (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-800/80 text-slate-300">
                        <EyeOff className="w-3 h-3 text-slate-400" />
                        <span>Anonymous</span>
                      </span>
                    )}
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-800/80 text-slate-300">
                      <ThumbsUp className="w-3 h-3 text-slate-400" />
                      <span>{retro.votingLimit} votes max</span>
                    </span>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-500">
                  <span>{retro.cardCount} feedback cards</span>
                  <div className="flex items-center space-x-1 text-slate-400 group-hover:text-indigo-400 transition-colors">
                    <span>Open Board</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
