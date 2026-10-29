import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { apiClient } from '../../lib/api-client';
import { RETRO_TEMPLATES, type CreateRetrospectiveInput } from '@retrospace/shared';
import {
  Columns3,
  ArrowLeft,
  Loader2,
  Check,
  EyeOff,
  ThumbsUp,
  Sparkles,
  AlertCircle,
} from 'lucide-react';

interface TeamOption {
  id: string;
  name: string;
}

export function CreateRetrospectivePage() {
  const { activeTenant } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedTeamId = searchParams.get('teamId') || '';

  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);

  const [teamId, setTeamId] = useState(preselectedTeamId);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('standard');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [votingLimit, setVotingLimit] = useState(5);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTeams() {
      if (!activeTenant) return;
      try {
        setLoadingTeams(true);
        const data = await apiClient<TeamOption[]>(
          `/tenants/${activeTenant.tenantId}/teams`
        );
        setTeams(data);
        if (!teamId && data.length > 0) {
          setTeamId(data[0].id);
        }
      } catch (err: unknown) {
        setError('Failed to load teams');
      } finally {
        setLoadingTeams(false);
      }
    }
    loadTeams();
  }, [activeTenant?.tenantId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant || !teamId || !title.trim()) return;

    try {
      setSubmitting(true);
      setError(null);

      const payload: CreateRetrospectiveInput = {
        teamId,
        title: title.trim(),
        description: description.trim(),
        template: selectedTemplate,
        isAnonymous,
        votingLimit,
      };

      const res = await apiClient<{
        retrospective: { id: string };
      }>(`/tenants/${activeTenant.tenantId}/retrospectives`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      navigate(`/retrospectives/${res.retrospective.id}`);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to create retrospective');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Back button */}
      <div>
        <Link
          to="/retrospectives"
          className="inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Retrospectives</span>
        </Link>
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Columns3 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Create Retrospective</h1>
            <p className="text-xs text-slate-400">
              Configure session columns, anonymity, and voting limits
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/60 border border-red-800/80 text-red-200 text-sm flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-white">General Information</h2>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Target Team / Squad
            </label>
            {loadingTeams ? (
              <div className="text-xs text-slate-500">Loading squad list...</div>
            ) : teams.length === 0 ? (
              <div className="text-xs text-amber-400">
                You must create a team first before launching a retrospective.{' '}
                <Link to="/teams" className="underline font-semibold text-white">
                  Create a Team
                </Link>
              </div>
            ) : (
              <select
                required
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Retrospective Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Sprint 42 Retrospective — Payment Flow Launch"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Context & Goals (optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief context, milestone notes, or retrospective goals..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Template Picker */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <h2 className="text-base font-semibold text-white">Select Board Template</h2>
          </div>
          <p className="text-xs text-slate-400">
            Choose a proven agile format or customize columns later on the board
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {Object.values(RETRO_TEMPLATES).map((template) => {
              const isSelected = selectedTemplate === template.id;
              return (
                <div
                  key={template.id}
                  onClick={() => setSelectedTemplate(template.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-indigo-950/40 border-indigo-500 shadow-md shadow-indigo-500/10'
                      : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <h3 className="text-sm font-bold text-white">{template.name}</h3>
                    {isSelected && (
                      <span className="h-5 w-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mb-3">{template.description}</p>

                  <div className="flex flex-wrap gap-1.5">
                    {template.columns.map((col) => (
                      <span
                        key={col.title}
                        className="text-[10px] px-2 py-0.5 rounded font-medium border"
                        style={{
                          backgroundColor: `${col.color}15`,
                          borderColor: `${col.color}40`,
                          color: col.color,
                        }}
                      >
                        {col.title}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Settings: Anonymity & Voting Limits */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
          <h2 className="text-base font-semibold text-white">Collaboration Settings</h2>

          {/* Anonymity */}
          <div className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-xl">
            <div className="flex items-start space-x-3">
              <div className="h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300 shrink-0 mt-0.5">
                <EyeOff className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-semibold text-white">Anonymous Feedback Cards</span>
                <p className="text-xs text-slate-400 mt-0.5">
                  Mask card author identities from all participants to encourage psychological safety and candid feedback.
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer ml-4">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {/* Voting limit */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
            <div className="flex items-start space-x-3">
              <div className="h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300 shrink-0 mt-0.5">
                <ThumbsUp className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-semibold text-white">Maximum Votes Per Participant</span>
                <p className="text-xs text-slate-400 mt-0.5">
                  Limit each attendee's voting allocation to prioritize the most impactful topics.
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2 ml-4">
              <input
                type="number"
                min={1}
                max={20}
                value={votingLimit}
                onChange={(e) => setVotingLimit(parseInt(e.target.value) || 5)}
                className="w-16 px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-xs text-slate-400">votes</span>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end space-x-4 pt-2">
          <Link
            to="/retrospectives"
            className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting || teams.length === 0}
            className="px-6 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg shadow-lg shadow-indigo-600/20 flex items-center space-x-2 transition-all"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                <span>Creating Board...</span>
              </>
            ) : (
              <span>Create Retrospective</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

