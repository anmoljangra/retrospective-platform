import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { apiClient } from '../../lib/api-client';
import { Building, Shield, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface InvitationDetails {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  tenantName: string;
  tenantSlug: string;
  inviterName: string;
}

export function AcceptInvitationPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, refreshUser, setActiveTenant } = useAuth();

  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchInvite() {
      if (!token) return;
      try {
        setLoading(true);
        const data = await apiClient<InvitationDetails>(`/invitations/${token}`);
        setInvitation(data);
      } catch (err: unknown) {
        setError((err as Error).message || 'Failed to load invitation');
      } finally {
        setLoading(false);
      }
    }
    fetchInvite();
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    try {
      setAccepting(true);
      setError(null);
      const res = await apiClient<{
        tenantId: string;
        tenantName: string;
      }>(`/invitations/${token}/accept`, {
        method: 'POST',
      });

      await refreshUser();
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to accept invitation');
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-4" />
        <p className="text-sm">Loading invitation details...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center">
        <div className="h-12 w-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mx-auto mb-4">
          <Building className="w-6 h-6" />
        </div>

        {error ? (
          <div>
            <div className="h-10 w-10 rounded-full bg-red-950/60 border border-red-800/80 text-red-400 flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Invalid or Expired Invitation</h2>
            <p className="text-xs text-slate-400 mb-6">{error}</p>
            <Link
              to="/"
              className="inline-block px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold"
            >
              Back to Home
            </Link>
          </div>
        ) : invitation ? (
          <div>
            <h2 className="text-xl font-bold text-white mb-2">You've Been Invited!</h2>
            <p className="text-sm text-slate-400 mb-6">
              <strong className="text-white">{invitation.inviterName}</strong> has invited you to join the{' '}
              <strong className="text-indigo-400">{invitation.tenantName}</strong> organization as a{' '}
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-mono text-xs">
                {invitation.role}
              </span>
              .
            </p>

            {user ? (
              <div className="space-y-4">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-left text-xs">
                  <span className="text-slate-500">Signed in as:</span>
                  <p className="text-white font-medium">{user.email}</p>
                </div>

                <button
                  onClick={handleAccept}
                  disabled={accepting}
                  className="w-full flex items-center justify-center py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg shadow-lg shadow-indigo-600/20 transition-all"
                >
                  {accepting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Joining Organization...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Accept & Join Organization
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-500 mb-4">
                  Please log in or register with your email to accept this invitation.
                </p>
                <Link
                  to="/login"
                  className="block w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg shadow transition-colors"
                >
                  Sign In to Accept
                </Link>
                <Link
                  to="/register"
                  className="block w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-lg border border-slate-700 transition-colors"
                >
                  Create New Account
                </Link>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
