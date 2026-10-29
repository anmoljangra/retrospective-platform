import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { Sparkles, Layers, ShieldCheck, Users } from 'lucide-react';
import { AuthProvider } from './features/auth/AuthContext';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';
import { OrganizationSettingsPage } from './features/tenants/OrganizationSettingsPage';
import { AcceptInvitationPage } from './features/tenants/AcceptInvitationPage';
import { TeamsPage } from './features/teams/TeamsPage';
import { TeamDetailPage } from './features/teams/TeamDetailPage';
import { RetrospectivesPage } from './features/retrospectives/RetrospectivesPage';
import { CreateRetrospectivePage } from './features/retrospectives/CreateRetrospectivePage';
import { BoardPage } from './features/board/BoardPage';

function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
              R
            </div>
            <span className="text-xl font-bold tracking-tight">RetroSpace</span>
          </div>
          <div className="flex items-center space-x-4">
            <Link
              to="/login"
              className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-md shadow transition-colors"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32 text-center">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-950/80 border border-indigo-800/60 text-indigo-400 text-xs font-medium mb-8">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Next-Generation Multi-Tenant Agile Retrospectives</span>
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-tight">
            Turn Agile Retrospectives Into Measurable Team Momentum.
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto">
            Collaborative Kanban boards, anonymous feedback, concurrency-safe voting, and integrated action item tracking built with rock-solid tenant isolation.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-4">
            <Link
              to="/register"
              className="px-6 py-3 text-base font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-lg shadow-indigo-600/30 transition-all transform hover:-translate-y-0.5"
            >
              Start Free Trial
            </Link>
            <Link
              to="/login"
              className="px-6 py-3 text-base font-semibold text-slate-200 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-lg transition-colors"
            >
              Live Demo
            </Link>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <Layers className="w-8 h-8 text-indigo-400 mb-4" />
            <h3 className="text-lg font-semibold text-white">Dynamic Retrospective Boards</h3>
            <p className="mt-2 text-sm text-slate-400">
              Interactive drag-and-drop columns, customizable Agile templates, and real-time live synchronization.
            </p>
          </div>
          <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <ShieldCheck className="w-8 h-8 text-emerald-400 mb-4" />
            <h3 className="text-lg font-semibold text-white">Enterprise Multi-Tenancy</h3>
            <p className="mt-2 text-sm text-slate-400">
              Complete tenant isolation, role-based authorization, and anonymous feedback masking down to the query level.
            </p>
          </div>
          <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <Users className="w-8 h-8 text-amber-400 mb-4" />
            <h3 className="text-lg font-semibold text-white">Action-Item Accountability</h3>
            <p className="mt-2 text-sm text-slate-400">
              Convert raw feedback directly into assigned tasks, track status, and monitor team momentum across sprints.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-900 py-8 text-center text-xs text-slate-600">
        &copy; {new Date().getFullYear()} RetroSpace Platform. Built with React, Express, PostgreSQL, Drizzle ORM & Docker.
      </footer>
    </div>
  );
}

function DashboardPlaceholder() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">Dashboard Overview</h1>
      <p className="text-slate-400 text-sm">Welcome to your team retrospective workspace.</p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/invite/:token" element={<AcceptInvitationPage />} />

          {/* Protected Application Area */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPlaceholder />} />
            <Route path="/teams" element={<TeamsPage />} />
            <Route path="/teams/:teamId" element={<TeamDetailPage />} />
            <Route path="/retrospectives" element={<RetrospectivesPage />} />
            <Route path="/retrospectives/new" element={<CreateRetrospectivePage />} />
            <Route path="/retrospectives/:retrospectiveId" element={<BoardPage />} />
            <Route path="/settings/organization" element={<OrganizationSettingsPage />} />
          </Route>

          <Route path="*" element={<LandingPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
