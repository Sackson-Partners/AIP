'use client';

import { useState } from 'react';
import AdminGuard from '@/components/AdminGuard';
import Link from 'next/link';

const ROLE_FEATURES: Record<string, string[]> = {
  super_admin:        ['Full platform access', 'User management', 'All analytics', 'All modules'],
  private_fund:       ['All projects', 'PETFEL full', 'EIN reports', 'IC voting', 'Pipeline'],
  dfi:                ['All projects', 'PETFEL full', 'EIN reports', 'IC management', 'Pipeline'],
  epc_contractor:     ['Own projects only', 'PETFEL summary', 'Upload documents', 'Pipeline view'],
  government:         ['Approved + curated projects', 'PETFEL summary', 'EIN approved only'],
  academic:           ['Approved projects', 'Analytics', 'PETFEL summary'],
  journalist_analyst: ['Approved projects only', 'PETFEL summary'],
  investor:           ['Curated + approved projects', 'PETFEL summary', 'EIN approved only'],
};

const EMAIL_TEMPLATES = [
  {
    name: 'Email Confirmation',
    subject: 'Confirm your AIP account',
    preview: 'Click the link below to confirm your email address and activate your account on the Africa Infrastructure Partners platform.',
    template: `{{ .SiteURL }}/auth/callback?code={{ .Code }}`,
  },
  {
    name: 'Password Reset',
    subject: 'Reset your AIP password',
    preview: 'You requested a password reset for your AIP account. Click the link below to set a new password.',
    template: `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery`,
  },
  {
    name: 'Magic Link',
    subject: 'Your AIP sign-in link',
    preview: 'Use this link to sign in to your AIP account. The link expires in 1 hour.',
    template: `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=magiclink`,
  },
];

const SYSTEM_CHECKS = [
  { label: 'Supabase Auth',     status: 'ok',      detail: 'Email/password + confirmation active' },
  { label: 'API Connection',    status: 'unknown',  detail: 'Check /health endpoint' },
  { label: 'CORS Origins',      status: 'ok',      detail: 'www.app.africa-infra.com + www.africa-infra.com allowed' },
  { label: 'Auth Callback',     status: 'ok',      detail: '/auth/callback route active' },
  { label: 'RLS Policies',      status: 'warning', detail: 'Verify enabled on all tables in Supabase' },
];

function AdminSettingsContent() {
  const [selectedTemplate, setSelectedTemplate] = useState(0);
  const [migrationStatus, setMigrationStatus] = useState<string | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);

  const runDataRoomAccessMigration = async () => {
    if (!confirm('Run DataRoomAccess table migration? This will create the table if it doesn\'t exist.')) {
      return;
    }

    setIsMigrating(true);
    setMigrationStatus(null);

    try {
      const response = await fetch('/api/admin/migrate-data-room-access', {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        if (data.alreadyExists) {
          setMigrationStatus('✓ Table already exists - no changes needed');
        } else {
          setMigrationStatus('✓ Migration successful! DataRoomAccess table created');
        }
      } else {
        setMigrationStatus(`✗ Migration failed: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      setMigrationStatus(`✗ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold text-white">Platform Settings</h1>
        <p className="text-gray-400 mt-1">Configuration, permissions, email templates, and system health</p>
      </div>

      {/* Role permissions matrix */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Role Permissions</h2>
        <div className="space-y-3">
          {Object.entries(ROLE_FEATURES).map(([role, features]) => (
            <div key={role} className="flex items-start gap-4">
              <div className="w-40 shrink-0">
                <span className="text-sm font-medium text-gray-300 capitalize">
                  {role.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {features.map((f) => (
                  <span key={f} className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-gray-600">
          Permissions are defined in <code className="text-gray-500">src/hooks/useRBAC.ts</code>.
          Edit that file to change role access.
        </p>
      </div>

      {/* Email templates */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Email Templates</h2>
        <div className="flex gap-2 mb-5 flex-wrap">
          {EMAIL_TEMPLATES.map((t, i) => (
            <button
              key={t.name}
              onClick={() => setSelectedTemplate(i)}
              className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
                selectedTemplate === i
                  ? 'bg-brand-gold text-brand-navy'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
        {(() => {
          const t = EMAIL_TEMPLATES[selectedTemplate];
          return (
            <div className="space-y-3">
              <div>
                <div className="text-xs text-gray-500 mb-1">Subject</div>
                <div className="text-sm text-white bg-gray-900 rounded-lg px-3 py-2">{t.subject}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Preview text</div>
                <div className="text-sm text-gray-300 bg-gray-900 rounded-lg px-3 py-2">{t.preview}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Confirmation URL (use in Supabase template)</div>
                <div className="text-xs font-mono text-blue-300 bg-gray-900 rounded-lg px-3 py-2 break-all">
                  {t.template}
                </div>
              </div>
            </div>
          );
        })()}
        <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-800/40 rounded-lg">
          <p className="text-xs text-yellow-300/80">
            Set these URLs in <strong>Supabase Dashboard → Auth → Email Templates</strong>.
            The Site URL must be <code>https://www.app.africa-infra.com</code>.
          </p>
        </div>
      </div>

      {/* System health */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">System Health</h2>
          <Link
            href="/dashboard/admin/setup"
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            Platform stats →
          </Link>
        </div>
        <div className="space-y-3">
          {SYSTEM_CHECKS.map((c) => (
            <div key={c.label} className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full shrink-0 ${
                c.status === 'ok'      ? 'bg-green-500' :
                c.status === 'warning' ? 'bg-yellow-500' : 'bg-gray-500'
              }`} />
              <div className="flex-1">
                <span className="text-sm text-white">{c.label}</span>
                <span className="text-xs text-gray-500 ml-2">{c.detail}</span>
              </div>
              <span className={`text-xs capitalize ${
                c.status === 'ok'      ? 'text-green-400' :
                c.status === 'warning' ? 'text-yellow-400' : 'text-gray-500'
              }`}>
                {c.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Database Migrations */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Database Migrations</h2>
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4 p-4 bg-gray-900 rounded-lg">
            <div className="flex-1">
              <h3 className="text-sm font-medium text-white mb-1">DataRoomAccess Table</h3>
              <p className="text-xs text-gray-400">
                Creates the DataRoomAccess table for access code verification. Required for Data Room and PETFEL access control.
              </p>
              {migrationStatus && (
                <div className={`mt-2 text-xs ${migrationStatus.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
                  {migrationStatus}
                </div>
              )}
            </div>
            <button
              onClick={runDataRoomAccessMigration}
              disabled={isMigrating}
              className="px-4 py-2 bg-brand-gold text-brand-navy rounded-lg hover:bg-brand-gold-dark transition disabled:opacity-50 text-sm font-medium whitespace-nowrap"
            >
              {isMigrating ? 'Running...' : 'Run Migration'}
            </button>
          </div>
          <div className="p-3 bg-yellow-900/20 border border-yellow-800/40 rounded-lg">
            <p className="text-xs text-yellow-300/80">
              <strong>⚠ Warning:</strong> Only run migrations once. Check the status message to see if the table already exists.
            </p>
          </div>
        </div>
      </div>

      {/* AI Engine Configuration */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">AI Engine Configuration</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">OpenAI API Key</label>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-gray-900 rounded-lg px-4 py-2 font-mono text-xs text-gray-300">
                {process.env.NEXT_PUBLIC_OPENAI_CONFIGURED === 'true' ? (
                  <span className="text-green-400">✓ Configured</span>
                ) : (
                  <span className="text-yellow-400">⚠ Not configured</span>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-600 mt-1">Set OPENAI_API_KEY in .env.local</p>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Amazon Bedrock Claude API Key (AWS External Token)</label>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-gray-900 rounded-lg px-4 py-2 font-mono text-xs text-gray-300">
                {process.env.NEXT_PUBLIC_ANTHROPIC_CONFIGURED === 'true' ? (
                  <span className="text-green-400">✓ Configured</span>
                ) : (
                  <span className="text-yellow-400">⚠ Not configured</span>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-600 mt-1">Set ANTHROPIC_API_KEY in .env.local (AWS Bedrock external token)</p>
          </div>
          <div className="mt-3 p-3 bg-blue-900/20 border border-blue-800/40 rounded-lg">
            <p className="text-xs text-blue-300/80">
              <strong>Note:</strong> API keys are server-side environment variables and cannot be changed from this UI for security.
              Update them in Vercel dashboard → Settings → Environment Variables, or locally in .env.local
            </p>
          </div>
        </div>
      </div>

      {/* Supabase config */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Supabase Configuration Checklist</h2>
        <ul className="space-y-2 text-sm text-gray-300">
          {[
            ['Site URL', 'https://www.app.africa-infra.com'],
            ['Redirect URLs', 'https://www.app.africa-infra.com/auth/callback, https://www.africa-infra.com/auth/callback'],
            ['Email confirm template', '{{ .SiteURL }}/auth/callback?code={{ .Code }}'],
            ['RLS enabled', 'All tables (profiles, projects, etc.)'],
          ].map(([label, value]) => (
            <li key={label} className="flex items-start gap-3">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>
                <span className="text-gray-400">{label}: </span>
                <code className="text-blue-300 text-xs">{value}</code>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function AdminSettingsPage() {
  return (
    <AdminGuard>
      <AdminSettingsContent />
    </AdminGuard>
  );
}
