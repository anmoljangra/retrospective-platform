import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { apiClient } from '../../lib/api-client';
import { TenantRole } from '@retrospace/shared';
import {
  Building,
  Users,
  UserPlus,
  Mail,
  Shield,
  Trash2,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  X,
} from 'lucide-react';

interface MemberItem {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  role: TenantRole;
  joinedAt: string;
}

interface InvitationItem {
  id: string;
  email: string;
  role: TenantRole;
  expiresAt: string;
  createdAt: string;
  invitedByName: string;
}

export function OrganizationSettingsPage() {
  const { activeTenant, user } = useAuth();

  const [members, setMembers] = useState<MemberItem[]>([]);
  const [invitations, setInvitations] = useState<InvitationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite modal state
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<TenantRole>(TenantRole.MEMBER);
  const [inviting, setInviting] = useState(false);
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isOwner = activeTenant?.role === TenantRole.OWNER;
  const isAdminOrOwner = isOwner || activeTenant?.role === TenantRole.ADMIN;

  const loadData = async () => {
    if (!activeTenant) return;
    try {
      setLoading(true);
      setError(null);

      const membersData = await apiClient<MemberItem[]>(
        `/tenants/${activeTenant.tenantId}/members`
      );
      setMembers(membersData);

      if (isAdminOrOwner) {
        const invitesData = await apiClient<InvitationItem[]>(
          `/tenants/${activeTenant.tenantId}/invitations`
        );
        setInvitations(invitesData);
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load organization data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTenant?.tenantId]);

  const handleRoleChange = async (membershipId: string, newRole: TenantRole) => {
    if (!activeTenant) return;
    try {
      await apiClient(`/tenants/${activeTenant.tenantId}/members/${membershipId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole }),
      });
      await loadData();
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to change member role');
    }
  };

  const handleRemoveMember = async (membershipId: string, memberName: string) => {
    if (!activeTenant) return;
    if (!confirm(`Are you sure you want to remove ${memberName} from this organization?`)) return;

    try {
      await apiClient(`/tenants/${activeTenant.tenantId}/members/${membershipId}`, {
        method: 'DELETE',
      });
      await loadData();
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to remove member');
    }
  };

  const handleRevokeInvite = async (invitationId: string) => {
    if (!activeTenant) return;
    try {
      await apiClient(`/tenants/${activeTenant.tenantId}/invitations/${invitationId}`, {
        method: 'DELETE',
      });
      await loadData();
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to revoke invitation');
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant || !inviteEmail.trim()) return;

    try {
      setInviting(true);
      const res = await apiClient<{
        inviteUrl: string;
        token: string;
      }>(`/tenants/${activeTenant.tenantId}/invitations`, {
        method: 'POST',
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      });

      const fullUrl = `${window.location.origin}${res.inviteUrl}`;
      setGeneratedInviteUrl(fullUrl);
      setInviteEmail('');
      await loadData();
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  const copyToClipboard = () => {
    if (generatedInviteUrl) {
      navigator.clipboard.writeText(generatedInviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!activeTenant) {
    return (
      <div className="p-8 text-center text-slate-400">
        Please select or create an organization first.
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center space-x-3 mb-2">
          <Building className="w-6 h-6 text-indigo-400" />
          <h1 className="text-2xl font-bold text-white tracking-tight">Organization Settings</h1>
        </div>
        <p className="text-sm text-slate-400">
          Manage workspace members, assign role permissions, and send invitations.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/60 border border-red-800/80 text-red-200 text-sm flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Org Profile Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
        <h2 className="text-base font-semibold text-white mb-4">Workspace Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80">
            <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Name</span>
            <p className="text-base font-medium text-white mt-1">{activeTenant.tenantName}</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80">
            <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Workspace Slug</span>
            <p className="text-base font-mono text-indigo-400 mt-1">{activeTenant.tenantSlug}</p>
          </div>
        </div>
      </div>

      {/* Members Directory */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center space-x-2">
              <Users className="w-4 h-4 text-indigo-400" />
              <span>Team Members ({members.length})</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">Users with access to this tenant workspace</p>
          </div>
          {isAdminOrOwner && (
            <button
              onClick={() => {
                setGeneratedInviteUrl(null);
                setIsInviteOpen(true);
              }}
              className="inline-flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              <span>Invite New Member</span>
            </button>
          )}
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500 flex items-center justify-center space-x-2">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
            <span className="text-sm">Loading members...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800 bg-slate-950/40">
                <tr>
                  <th className="py-3 px-4">Member</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Joined</th>
                  {isAdminOrOwner && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {members.map((member) => (
                  <tr key={member.membershipId} className="hover:bg-slate-800/30 transition-colors">
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
                      {isOwner && member.userId !== user?.id ? (
                        <select
                          value={member.role}
                          onChange={(e) =>
                            handleRoleChange(member.membershipId, e.target.value as TenantRole)
                          }
                          className="bg-slate-950 border border-slate-800 text-xs rounded px-2 py-1 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value={TenantRole.OWNER}>OWNER</option>
                          <option value={TenantRole.ADMIN}>ADMIN</option>
                          <option value={TenantRole.MEMBER}>MEMBER</option>
                        </select>
                      ) : (
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-semibold ${
                            member.role === TenantRole.OWNER
                              ? 'bg-purple-950/80 text-purple-300 border border-purple-800/60'
                              : member.role === TenantRole.ADMIN
                              ? 'bg-blue-950/80 text-blue-300 border border-blue-800/60'
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
                    {isAdminOrOwner && (
                      <td className="py-3.5 px-4 text-right">
                        {member.userId !== user?.id && (
                          <button
                            onClick={() => handleRemoveMember(member.membershipId, member.name)}
                            title="Remove from organization"
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
        )}
      </div>

      {/* Pending Invitations */}
      {isAdminOrOwner && invitations.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
          <h2 className="text-base font-semibold text-white mb-4 flex items-center space-x-2">
            <Mail className="w-4 h-4 text-indigo-400" />
            <span>Pending Invitations ({invitations.length})</span>
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800 bg-slate-950/40">
                <tr>
                  <th className="py-3 px-4">Invited Email</th>
                  <th className="py-3 px-4">Assigned Role</th>
                  <th className="py-3 px-4">Invited By</th>
                  <th className="py-3 px-4">Expires</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {invitations.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs text-slate-200">{inv.email}</td>
                    <td className="py-3 px-4">
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {inv.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-xs">{inv.invitedByName}</td>
                    <td className="py-3 px-4 text-slate-500 text-xs">
                      {new Date(inv.expiresAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleRevokeInvite(inv.id)}
                        className="text-xs text-red-400 hover:text-red-300 font-medium"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {isInviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 relative">
            <button
              onClick={() => setIsInviteOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white mb-1">Invite Member</h3>
            <p className="text-xs text-slate-400 mb-5">
              Send an invitation to join <strong className="text-white">{activeTenant.tenantName}</strong>
            </p>

            {generatedInviteUrl ? (
              <div className="space-y-4">
                <div className="p-3 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-emerald-200 text-xs">
                  ✅ Invitation generated successfully! Share this link with your teammate:
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    readOnly
                    value={generatedInviteUrl}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-300 select-all"
                  />
                  <button
                    onClick={copyToClipboard}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white text-xs font-semibold flex items-center space-x-1"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                <div className="pt-3 border-t border-slate-800 flex justify-end">
                  <button
                    onClick={() => {
                      setIsInviteOpen(false);
                      setGeneratedInviteUrl(null);
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSendInvite} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Teammate Email
                  </label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="teammate@company.com"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Role in Organization
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as TenantRole)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value={TenantRole.MEMBER}>MEMBER (Participate, vote, collaborate)</option>
                    <option value={TenantRole.ADMIN}>ADMIN (Manage members, teams, retrospectives)</option>
                  </select>
                </div>

                <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsInviteOpen(false)}
                    className="px-4 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={inviting}
                    className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow disabled:opacity-50 flex items-center"
                  >
                    {inviting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        Generating Invite...
                      </>
                    ) : (
                      'Generate Invitation'
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

