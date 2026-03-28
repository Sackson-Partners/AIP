'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';

const USER_TYPES = [
  {
    role: 'Private Fund',
    icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    color: 'text-teal-400',
    border: 'border-teal-800',
    bg: 'bg-teal-900/20',
    description: 'Full pipeline access, PESTEL analysis, EIN reports, and IC committee management for infrastructure fund managers.',
  },
  {
    role: 'Development Finance',
    icon: 'M3 6l3 1m0 0l-3 9a5 5 0 006.516 6.916M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5 5 0 01-6.516 6.916M18 7l3 9m-3-9l-6-2M6 7H3m15 0h3M6 7v1m12-1v1',
    color: 'text-blue-400',
    border: 'border-blue-800',
    bg: 'bg-blue-900/20',
    description: 'Curated project pipeline, verification status, and deal room access for DFIs and multilateral lenders.',
  },
  {
    role: 'EPC Contractor',
    icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z',
    color: 'text-yellow-400',
    border: 'border-yellow-800',
    bg: 'bg-yellow-900/20',
    description: 'Submit and track infrastructure project proposals, upload technical documentation, and monitor approval stages.',
  },
  {
    role: 'Government',
    icon: 'M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z',
    color: 'text-green-400',
    border: 'border-green-800',
    bg: 'bg-green-900/20',
    description: 'Access approved and curated projects for your jurisdiction, monitor infrastructure activity, and engage with investors.',
  },
  {
    role: 'Academic & Research',
    icon: 'M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222',
    color: 'text-purple-400',
    border: 'border-purple-800',
    bg: 'bg-purple-900/20',
    description: 'Platform analytics, infrastructure trend data, and sector intelligence for research institutions and think tanks.',
  },
  {
    role: 'Journalist & Analyst',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    color: 'text-gray-400',
    border: 'border-gray-700',
    bg: 'bg-gray-800/40',
    description: 'Browse publicly approved projects, sector reports, and infrastructure developments across the African continent.',
  },
];

const FEATURES = [
  {
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    title: 'Pipeline Management',
    desc: 'Track projects from sourcing through IC approval with structured stage-gate workflow.',
  },
  {
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
    title: 'PESTEL Analysis',
    desc: 'AI-assisted Political, Economic, Social, Technical, Environmental and Legal assessments.',
  },
  {
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
    title: 'Verification System',
    desc: 'Multi-level project verification with documented evidence trails and compliance tracking.',
  },
  {
    icon: 'M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z',
    title: 'Data & Deal Rooms',
    desc: 'Secure document storage and controlled sharing for due diligence and transaction close.',
  },
  {
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    title: 'EIN Reports',
    desc: 'Executive Investment Notes generated from structured project data for IC presentation.',
  },
  {
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
    title: 'IC Committee',
    desc: 'Structured investment committee voting and decision management with full audit trail.',
  },
];

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-gray-900 text-white">

      {/* Nav */}
      <header className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-sm">
              A
            </div>
            <span className="font-semibold text-white">AIP Platform</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-gray-400 hover:text-white transition-colors px-4 py-2"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Get access
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-900/30 border border-blue-700/50 rounded-full px-4 py-1.5 text-sm text-blue-300 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          African Infrastructure Intelligence Platform
        </div>
        <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight max-w-4xl mx-auto">
          Infrastructure deal-flow,{' '}
          <span className="text-blue-400">built for Africa</span>
        </h1>
        <p className="mt-6 text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
          From project sourcing to investment close — structured pipeline management, PESTEL analysis, and IC governance for Africa&apos;s infrastructure ecosystem.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/register"
            className="w-full sm:w-auto px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-center"
          >
            Request access
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto px-8 py-3.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white font-medium rounded-lg transition-colors text-center"
          >
            Sign in
          </Link>
        </div>
      </section>

      {/* User types */}
      <section className="max-w-7xl mx-auto px-6 pb-24">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold text-white">Built for every stakeholder</h2>
          <p className="mt-3 text-gray-400">Role-based access tailored to how each participant interacts with infrastructure projects.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {USER_TYPES.map((t) => (
            <div key={t.role} className={`rounded-xl border ${t.border} ${t.bg} p-6`}>
              <div className="flex items-center gap-3 mb-3">
                <svg className={`w-6 h-6 ${t.color}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d={t.icon} />
                </svg>
                <span className={`font-semibold ${t.color}`}>{t.role}</span>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">{t.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-gray-800 bg-gray-950">
        <div className="max-w-7xl mx-auto px-6 py-24">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-white">Everything in one platform</h2>
            <p className="mt-3 text-gray-400">End-to-end tools for the full infrastructure investment lifecycle.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                <div className="w-10 h-10 rounded-lg bg-blue-900/40 border border-blue-800/50 flex items-center justify-center mb-4">
                  <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d={f.icon} />
                  </svg>
                </div>
                <h3 className="font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-20 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to get started?</h2>
          <p className="text-gray-400 mb-8 max-w-lg mx-auto">
            Join infrastructure investors, DFIs, governments, and contractors already using AIP to manage African infrastructure deal-flow.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="w-full sm:w-auto px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-center"
            >
              Request access
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto px-8 py-3.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white font-medium rounded-lg transition-colors text-center"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 bg-gray-950">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center font-bold text-white text-xs">A</div>
            <span className="text-sm text-gray-500">AIP — Africa Infrastructure Partners</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-600">
            <a href="https://www.africa-infra.com" className="hover:text-gray-400 transition-colors">www.africa-infra.com</a>
            <Link href="/login" className="hover:text-gray-400 transition-colors">Sign in</Link>
            <Link href="/register" className="hover:text-gray-400 transition-colors">Register</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
