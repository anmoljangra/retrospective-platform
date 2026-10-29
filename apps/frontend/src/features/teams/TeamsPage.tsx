import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { apiClient } from '../../lib/api-client';
import { createTeamSchema, type CreateTeamInput } from '@retrospace/shared';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Users2,
  Plus,
  Loader2,
  AlertCircle,
  X,
  ArrowRight,
  Columns3,
  Users,
} from 'lucide-react';

interface TeamItem {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  retroCount: number;
  createdAt: string;
}

export function TeamsPage() {
  const { activeTenant } = useAuth();
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateTeamInput>({
    resolver: zodResolver(createTeamSchema),
    defaultValues: { name: '', description: '' },
  });

  const loadTeams = async () => {
    if (!activeTenant) return;
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient<TeamItem[]>(`/tenants/${activeTenant.tenantId}/teams`);
      setTeams(data);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load teams');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeams();
  }, [activeTenant?.tenantId]);

  const handleCreateTeam = async (data: CreateTeamInput) => {
    if (!activeTenant) return;
    try {
      await apiClient(`/tenants/${activeTenant.tenantId}/teams`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      reset();
      setIsCreateOpen(false);
      await loadTeams();
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to create team');
    }
  };

  if (!activeTenant) {
    return (
      <div className="p-8 text-center text-slate-400">
        Please select an active organization first.
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <Users2 className="w-6 h-6 text-indigo-400" />
            <h1 className="text-2xl font-bold text-white tracking-tight">Teams</h1>
          </div>
          <p className="text-sm text-slate-400">
            Collaborative Agile squads in <strong className="text-white">{activeTenant.tenantName}</strong>
          </p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center space-x-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-lg shadow-indigo-600/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Create Team</span>
        </button>
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
          <span className="text-sm">Loading teams...</span>
        </div>
      ) : teams.length === 0 ? (
        <div className="p-12 rounded-2xl bg-slate-900 border border-slate-800 text-center max-w-lg mx-auto">
          <div className="h-12 w-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mx-auto mb-4">
            <Users2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-white mb-1">No Teams Yet</h3>
          <p className="text-xs text-slate-400 mb-6">
            Teams organize your squads, assign facilitators, and host sprint retrospectives.
          </p>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow"
          >
            Create Your First Team
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map((team) => (
            <Link
              key={team.id}
              to={`/teams/${team.id}`}
              className="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900/90 transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div className="h-10 w-10 rounded-xl bg-indigo-950/80 border border-indigo-800/60 flex items-center justify-center text-indigo-400 font-bold">
                    {team.name.charAt(0)}
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                </div>
                <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors">
                  {team.name}
                </h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                  {team.description || 'No description provided.'}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center space-x-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-500" />
                  <span>{team.memberCount} members</span>
                </span>
                <span className="flex items-center space-x-1.5">
                  <Columns3 className="w-3.5 h-3.5 text-slate-500" />
                  <span>{team.retroCount} retros</span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create Team Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 relative">
            <button
              onClick={() => setIsCreateOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white mb-1">Create New Team</h3>
            <p className="text-xs text-slate-400 mb-5">
              Set up a sprint squad within <strong className="text-white">{activeTenant.tenantName}</strong>
            </p>

            <form onSubmit={handleSubmit(handleCreateTeam)} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Team Name
                </label>
                <input
                  type="text"
                  required
                  {...register('name')}
                  placeholder="e.g. Frontend Core, Payments Squad"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {errors.name && (
                  <p className="text-xs text-red-400 mt-1">{errors.name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Description (optional)
                </label>
                <textarea
                  rows={3}
                  {...register('description')}
                  placeholder="Brief description of the squad's scope..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow disabled:opacity-50 flex items-center"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Team'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

