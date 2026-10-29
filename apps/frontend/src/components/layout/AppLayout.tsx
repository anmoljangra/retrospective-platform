import React, { useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';
import { CreateTenantModal } from '../../features/tenants/CreateTenantModal';
import {
  LayoutDashboard,
  Users2,
  Columns3,
  CheckSquare,
  Settings,
  LogOut,
  ChevronDown,
  Plus,
  Building,
  Menu,
  X,
  Shield,
} from 'lucide-react';

export function AppLayout() {
  const { user, memberships, activeTenant, setActiveTenant, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Teams', href: '/teams', icon: Users2 },
    { name: 'Retrospectives', href: '/retrospectives', icon: Columns3 },
    { name: 'Action Items', href: '/action-items', icon: CheckSquare },
    { name: 'Organization Settings', href: '/settings/organization', icon: Settings },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      <CreateTenantModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />

      {/* Mobile Top Navigation */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-40">
        <div className="flex items-center space-x-2">
          <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow">
            R
          </div>
          <span className="font-bold text-white text-lg">RetroSpace</span>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Workspace Switcher Header */}
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center space-x-2.5 mb-4">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-md shadow-indigo-600/30">
              R
            </div>
            <span className="font-bold text-white tracking-tight">RetroSpace</span>
          </div>

          {/* Org Switcher */}
          <div className="relative">
            <button
              onClick={() => setIsOrgDropdownOpen(!isOrgDropdownOpen)}
              className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-left transition-colors"
            >
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="h-6 w-6 rounded-md bg-indigo-950 border border-indigo-700/60 flex items-center justify-center text-indigo-400 shrink-0">
                  <Building className="w-3.5 h-3.5" />
                </div>
                <div className="truncate">
                  <p className="text-xs font-semibold text-white truncate">
                    {activeTenant ? activeTenant.tenantName : 'Select Organization'}
                  </p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">
                    {activeTenant ? activeTenant.role : 'None'}
                  </p>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
            </button>

            {isOrgDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Your Organizations
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {memberships.map((m) => (
                    <button
                      key={m.tenantId}
                      onClick={() => {
                        setActiveTenant(m);
                        setIsOrgDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-800/80 transition-colors ${
                        activeTenant?.tenantId === m.tenantId ? 'text-indigo-400 font-semibold bg-indigo-950/30' : 'text-slate-300'
                      }`}
                    >
                      <span className="truncate">{m.tenantName}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 ml-2 shrink-0">
                        {m.role}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="border-t border-slate-800 mt-1 pt-1">
                  <button
                    onClick={() => {
                      setIsOrgDropdownOpen(false);
                      setIsCreateModalOpen(true);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-indigo-400 hover:bg-slate-800 flex items-center space-x-2 font-medium transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Organization</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Primary Links */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Footer */}
        <div className="p-3 border-t border-slate-800">
          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/60">
            <div className="truncate">
              <p className="text-xs font-semibold text-slate-200 truncate">{user?.name}</p>
              <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-950/30 rounded-md transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
}

