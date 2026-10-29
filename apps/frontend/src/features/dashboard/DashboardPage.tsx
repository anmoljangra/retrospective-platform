import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { apiClient } from '../../lib/api-client';
import { RetrospectiveStatus, ActionItemStatus } from '@retrospace/shared';
import {
  Columns3,
  CheckSquare,
  Users2,
  Building,
  Plus,
  Play,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Sparkles,
  Loader2,
} from 'lucide-react';

interface DashboardStats {
  activeRetros: number;
  totalTeams: number;
  openActions: number;
  overdueActions: number;
}

interface RecentRetro {
  id: string;
  title: string;
  teamName: string;
  status: RetrospectiveStatus;
  createdAt: string;
}

interface PendingAction {
  id: string;
  title: string;
  retrospectiveTitle: string;
  retrospectiveId: string;
  priority: string;
  status: ActionItemStatus;
  dueDate: string | null;
}

export function DashboardPage() {
  const { user, activeTenant } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    activeRetros: 0,
    totalTeams: 0,
    openActions: 0,
    overdueActions: 0,
  });
  const [recentRetros, setRecentRetros] = useState<RecentRetro[]>([]);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboard() {
      if (!activeTenant) return;
      try {
        setLoading(true);

        const [teams, retros, actions] = await Promise.all([
          apiClient<any[]>(`/tenants/${activeTenant.tenantId}/teams`),
          apiClient<any[]>(`/tenants/${activeTenant.tenantId}/retrospectives`),
          apiClient<any[]>(`/tenants/${activeTenant.tenantId}/action-items`),
        ]);

        const activeR = retros.filter((r) => r.status === RetrospectiveStatus.ACTIVE).length;
        const openA = actions.filter((a) => a.status !== ActionItemStatus.DONE);
        const overdueA = openA.filter(
          (a) => a.dueDate && new Date(a.dueDate) < new Date()
        ).length;

        setStats({
          activeRetros: activeR,
          totalTeams: teams.length,
          openActions: openA.length,
          overdueActions: overdueA,
        });

        setRecentRetros(retros.slice(0, 4));
        setPendingActions(openA.slice(0, 5));
      } catch (err) {
        console.error('Failed to load dashboard data', err);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, [activeTenant?.tenantId]);

  if (!activeTenant) {
    return (
      <div className="p-8 text-center text-slate-400">
        Please select or create an organization first.
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Welcome Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-indigo-950/60 via-slate-900 to-slate-900 border border-indigo-900/40 shadow-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-900/50 border border-indigo-700/50 text-indigo-300 text-xs font-medium mb-3">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Workspace: {activeTenant.tenantName}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Welcome back, {user?.name.split(' ')[0]} 👋
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-xl">
            Here is your team's sprint momentum, live retrospectives, and pending action items.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/retrospectives/new"
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/25 flex items-center space-x-2 transition-all transform hover:-translate-y-0.5"
          >
            <Columns3 className="w-4 h-4" />
            <span>New Retrospective</span>
          </Link>
          <Link
            to="/teams"
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 flex items-center space-x-2 transition-colors"
          >
            <Users2 className="w-4 h-4" />
            <span>Teams</span>
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-3">
            <span>Active Sessions</span>
            <div className="h-7 w-7 rounded-lg bg-emerald-950/60 border border-emerald-800/60 flex items-center justify-center text-emerald-400">
              <Play className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">{stats.activeRetros}</p>
          <span className="text-[11px] text-slate-500">Live collaborative boards</span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-3">
            <span>Squads / Teams</span>
            <div className="h-7 w-7 rounded-lg bg-indigo-950/60 border border-indigo-800/60 flex items-center justify-center text-indigo-400">
              <Users2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">{stats.totalTeams}</p>
          <span className="text-[11px] text-slate-500">Configured team squads</span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-3">
            <span>Open Tasks</span>
            <div className="h-7 w-7 rounded-lg bg-blue-950/60 border border-blue-800/60 flex items-center justify-center text-blue-400">
              <CheckSquare className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">{stats.openActions}</p>
          <span className="text-[11px] text-slate-500">Pending continuous improvement</span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-3">
            <span>Overdue Tasks</span>
            <div className="h-7 w-7 rounded-lg bg-red-950/60 border border-red-800/60 flex items-center justify-center text-red-400">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-red-400">{stats.overdueActions}</p>
          <span className="text-[11px] text-slate-500">Past target resolution date</span>
        </div>
      </div>

      {/* Two Column Grid: Recent Retros & Pending Action Items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Retrospectives */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <Columns3 className="w-4 h-4 text-indigo-400" />
                <span>Recent Retrospectives</span>
              </h2>
              <Link
                to="/retrospectives"
                className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center space-x-1"
              >
                <span>View all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {loading ? (
              <div className="py-8 text-center text-slate-500 flex items-center justify-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                <span className="text-xs">Loading sessions...</span>
              </div>
            ) : recentRetros.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No retrospectives conducted yet. Launch your first one!
              </div>
            ) : (
              <div className="space-y-3">
                {recentRetros.map((retro) => (
                  <Link
                    key={retro.id}
                    to={`/retrospectives/${retro.id}`}
                    className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 flex items-center justify-between group transition-colors"
                  >
                    <div>
                      <h3 className="text-xs font-semibold text-white group-hover:text-indigo-300 transition-colors">
                        {retro.title}
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">{retro.teamName}</p>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase ${
                        retro.status === RetrospectiveStatus.ACTIVE
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-slate-900 text-slate-400'
                      }`}
                    >
                      {retro.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Priority Action Items */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <CheckSquare className="w-4 h-4 text-indigo-400" />
                <span>Open Action Items</span>
              </h2>
              <Link
                to="/action-items"
                className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center space-x-1"
              >
                <span>View all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {loading ? (
              <div className="py-8 text-center text-slate-500 flex items-center justify-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                <span className="text-xs">Loading tasks...</span>
              </div>
            ) : pendingActions.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                All action items are resolved! Great work.
              </div>
            ) : (
              <div className="space-y-3">
                {pendingActions.map((action) => (
                  <div
                    key={action.id}
                    className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs"
                  >
                    <div className="truncate mr-3">
                      <p className="font-semibold text-white truncate">{action.title}</p>
                      <Link
                        to={`/retrospectives/${action.retrospectiveId}`}
                        className="text-[10px] text-indigo-400 hover:underline truncate block"
                      >
                        {action.retrospectiveTitle}
                      </Link>
                    </div>

                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-semibold shrink-0 ${
                        action.priority === 'HIGH'
                          ? 'bg-red-950 text-red-300'
                          : 'bg-amber-950 text-amber-300'
                      }`}
                    >
                      {action.priority}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
