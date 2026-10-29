import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { apiClient } from '../../lib/api-client';
import { TeamRole, TenantRole } from '@retrospace/shared';
import {
  Users2,
  UserPlus,
  Shield,
  Trash2,
  Columns3,
  Calendar,
  AlertCircle,
  Loader2,
  X,
  Plus,
  ArrowLeft,
} from 'lucide-react';

interface TeamDetails {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  createdAt: string;
}

interface TeamMemberItem {
  id: string;
  teamId: string;
  userId: string;
  name: string;
  email: string;
  role: TeamRole;
  joinedAt: string;
}

interface OrgMemberItem {
  userId: string;
  name: string;
  email: string;
  role: string;
}

export function TeamDetailPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const { activeTenant, user } = useAuth();

  const [team, setTeam] = useState<TeamDetails | null>(null);
  const [members, setMembers] = useState<TeamMemberItem[]>([]);
  const [orgMembers, setOrgMembers] = useState<OrgMemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add member modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<TeamRole>(TeamRole.MEMBER);
  const [adding, setAdding] = useState(false);

  const isTenantAdmin =
    activeTenant?.role === TenantRole.OWNER || activeTenant?.role === TenantRole.ADMIN;
  const isFacilitator =
    isTenantAdmin || members.some((m) => m.userId === user?.id && m.role === TeamRole.FACILITATOR);

  const loadTeamData = async () => {
    if (!activeTenant || !teamId) return;
    try {
      setLoading(true);
      setError(null);

      const [teamData, membersData, orgData] = await Promise.all([
        apiClient<TeamDetails>(`/tenants/${activeTenant.tenantId}/teams/${teamId}`),
        apiClient<TeamMemberItem[]>(`/tenants/${activeTenant.tenantId}/teams/${teamId}/members`),
        apiClient<OrgMemberItem[]>(`/tenants/${activeTenant.tenantId}/members`),
      ]);

      setTeam(teamData);
      setMembers(membersData);
      setOrgMembers(orgData);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load team details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeamData();
  }, [activeTenant?.tenantId, teamId]);

  const handleRoleChange = async (targetUserId: string, newRole: TeamRole) => {
    if (!activeTenant || !teamId) return;
    try {
      await apiClient(`/tenants/${activeTenant.tenantId}/teams/${teamId}/members/${targetUserId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole }),
      });
      await loadTeamData();
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to update member role');
    }
  };

  const handleRemoveMember = async (targetUserId: string, memberName: string) => {
    if (!activeTenant || !teamId) return;
    if (!confirm(`Are you sure you want to remove ${memberName} from this team?`)) return;

    try {
      await apiClient(`/tenants/${activeTenant.tenantId}/teams/${teamId}/members/${targetUserId}`, {
        method: 'DELETE',
      });
      await loadTeamData();
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to remove team member');
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant || !teamId || !selectedUserId) return;

    try {
      setAdding(true);
      await apiClient(`/tenants/${activeTenant.tenantId}/teams/${teamId}/members`, {
        method: 'POST',
        body: JSON.stringify({
          userId: selectedUserId,
          role: selectedRole,
        }),
      });

      setSelectedUserId('');
      setIsAddOpen(false);
      await loadTeamData();
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to add team member');
    } finally {
      setAdding(false);
    }
  };

  // Find organization members who are not yet in this team
  const availableOrgMembers = orgMembers.filter(
    (om) => !members.some((tm) => tm.userId === om.userId)
  );

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500 flex items-center justify-center space-x-2">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        <span className="text-sm">Loading team...</span>
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="p-8 text-center text-red-400">
        <AlertCircle className="w-8 h-8 mx-auto mb-2" />
        <p className="text-sm">{error || 'Team not found'}</p>
        <Link to="/teams" className="text-xs text-indigo-400 hover:underline mt-4 inline-block">
          &larr; Back to Teams
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Back button & Team Header */}
      <div>
        <Link
          to="/teams"
          className="inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Teams</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3 mb-1">
              <div className="h-10 w-10 rounded-xl bg-indigo-950 border border-indigo-800/60 flex items-center justify-center text-indigo-400 font-bold">
                {team.name.charAt(0)}
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">{team.name}</h1>
            </div>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              {team.description || 'No description provided for this team.'}
            </p>
          </div>

          <Link
            to={`/retrospectives/new?teamId=${team.id}`}
            className="inline-flex items-center space-x-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-lg shadow-indigo-600/20 transition-all self-start sm:self-auto"
          >
            <Columns3 className="w-4 h-4" />
            <span>Launch Retrospective</span>
          </Link>
        </div>
      </div>

      {/* Team Members Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center space-x-2">
              <Users2 className="w-4 h-4 text-indigo-400" />
              <span>Team Members ({members.length})</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">Facilitators and participating teammates</p>
          </div>

          {isFacilitator && (
            <button
              onClick={() => setIsAddOpen(true)}
              className="inline-flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Member</span>
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800 bg-slate-950/40">
              <tr>
                <th className="py-3 px-4">Member</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Team Role</th>
                <th className="py-3 px-4">Joined</th>
                {isFacilitator && <th className="py-3 px-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3.5 px-4 font-medium text-white flex items-center space-x-2.5">
                    <div className="h-7 w-7 rounded-full bg-indigo-950 border border-indigo-700 text-indigo-300 flex items-center justify-center text-xs font-bold uppercase">
                      {member.name.charAt(0)}
                    </div>
                    <span>{member.name}</span>
                    {member.userId === user?.id && (
                      <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded ml-1">
                        You
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-slate-400 text-xs font-mono">{member.email}</td>
                  <td className="py-3.5 px-4">
                    {isFacilitator && member.userId !== user?.id ? (
                      <select
                        value={member.role}
                        onChange={(e) =>
                          handleRoleChange(member.userId, e.target.value as TeamRole)
                        }
                        className="bg-slate-950 border border-slate-800 text-xs rounded px-2 py-1 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value={TeamRole.FACILITATOR}>FACILITATOR</option>
                        <option value={TeamRole.MEMBER}>MEMBER</option>
                      </select>
                    ) : (
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-semibold ${
                          member.role === TeamRole.FACILITATOR
                            ? 'bg-amber-950/80 text-amber-300 border border-amber-800/60'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {member.role}
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 text-xs">
                    {new Date(member.joinedAt).toLocaleDateString()}
                  </td>
                  {isFacilitator && (
                    <td className="py-3.5 px-4 text-right">
                      {member.userId !== user?.id && (
                        <button
                          onClick={() => handleRemoveMember(member.userId, member.name)}
                          title="Remove from team"
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-950/40 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Member Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 relative">
            <button
              onClick={() => setIsAddOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white mb-1">Add Team Member</h3>
            <p className="text-xs text-slate-400 mb-5">
              Select a teammate from <strong className="text-white">{activeTenant?.tenantName}</strong> to join {team.name}
            </p>

            {availableOrgMembers.length === 0 ? (
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-center text-xs text-slate-400">
                All organization members are already part of this team!
              </div>
            ) : (
              <form onSubmit={handleAddMember} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Select Teammate
                  </label>
                  <select
                    required
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Choose an organization member --</option>
                    {availableOrgMembers.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.name} ({m.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Squad Role
                  </label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value as TeamRole)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value={TeamRole.MEMBER}>MEMBER (Participate, vote, comment)</option>
                    <option value={TeamRole.FACILITATOR}>FACILITATOR (Run retro sessions, manage columns)</option>
                  </select>
                </div>

                <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsAddOpen(false)}
                    className="px-4 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={adding || !selectedUserId}
                    className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow disabled:opacity-50 flex items-center"
                  >
                    {adding ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      'Add to Team'
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
