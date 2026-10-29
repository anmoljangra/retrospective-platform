import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createTenantSchema, type CreateTenantInput } from '@retrospace/shared';
import { apiClient } from '../../lib/api-client';
import { useAuth, type TenantMembershipInfo } from '../auth/AuthContext';
import { X, Building, Loader2, AlertCircle } from 'lucide-react';

interface CreateTenantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateTenantModal({ isOpen, onClose }: CreateTenantModalProps) {
  const { setActiveTenant, refreshUser } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateTenantInput>({
    resolver: zodResolver(createTenantSchema),
    defaultValues: {
      name: '',
      slug: '',
    },
  });

  if (!isOpen) return null;

  const onSubmit = async (data: CreateTenantInput) => {
    try {
      setError(null);
      const res = await apiClient<{
        tenant: { id: string; name: string; slug: string };
        membership: { id: string; role: any };
      }>('/tenants', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      await refreshUser();
      setActiveTenant({
        id: res.membership.id,
        tenantId: res.tenant.id,
        role: res.membership.role,
        joinedAt: new Date().toISOString(),
        tenantName: res.tenant.name,
        tenantSlug: res.tenant.slug,
      });

      reset();
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to create organization');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-5">
          <div className="h-10 w-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Create Organization</h3>
            <p className="text-xs text-slate-400">Set up a new isolated workspace for your team</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-950/60 border border-red-800/80 text-red-200 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Organization Name
            </label>
            <input
              type="text"
              {...register('name')}
              placeholder="e.g. Acme Engineering"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {errors.name && (
              <p className="text-xs text-red-400 mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Workspace Slug (optional)
            </label>
            <input
              type="text"
              {...register('slug')}
              placeholder="e.g. acme-eng"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs"
            />
            {errors.slug && (
              <p className="text-xs text-red-400 mt-1">{errors.slug.message}</p>
            )}
          </div>

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow disabled:opacity-50 flex items-center transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Workspace'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
