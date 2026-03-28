'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '../context/AuthContext';

const USER_TYPES = [
  {
    role: 'Private Fund',
    icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    description: 'Full pipeline access, PESTEL analysis, EIN reports, and IC committee management for infrastructure fund managers.',
  },
  {
    role: 'Development Finance',
    icon: 'M3 6l3 1m0 0l-3 9a5 5 0 006.516 6.916M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5 5 0 01-6.516 6.916M18 7l3 9m-3-9l-6-2M6 7H3m15 0h3M6 7v1m12-1v1',
    description: 'Curated project pipeline, verification status, and deal room access for DFIs and multilateral lenders.',
  },
  {
    role: 'EPC Contractor',
    icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z',
    description: 'Submit and track infrastructure project proposals, upload technical documentation, and monitor approval stages.',
  },
  {
    role: 'Government',
    icon: 'M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z',
    description: 'Access approved and curated projects for your jurisdiction, monitor infrastructure activity, and engage with investors.',
  },
  {
    role: 'Academic & Research',
    icon: 'M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222',
    description: 'Platform analytics, infrastructure trend data, and sector intelligence for research institutions and think tanks.',
  },
  {
    role: 'Journalist & Analyst',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
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

function LanguageToggle() {
  const [lang, setLang] = useState<'EN' | 'FR'>('EN');
  const [showToast, setShowToast] = useState(false);

  const toggle = (next: 'EN' | 'FR') => {
    if (next === 'FR') {
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
    setLang(next);
  };

  return (
    <div className="relative flex items-center">
      <div className="flex items-center border border-gray-300 rounded-md overflow-hidden text-xs font-medium">
        <button
          onClick={() => toggle('EN')}
          className={`px-2.5 py-1 transition-colors ${lang === 'EN' ? 'bg-brand-navy text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
        >
          EN
        </button>
        <button
          onClick={() => toggle('FR')}
          className={`px-2.5 py-1 transition-colors ${lang === 'FR' ? 'bg-brand-navy text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
        >
          FR
        </button>
      </div>
      {showToast && (
        <div className="absolute top-8 right-0 bg-brand-navy text-white text-xs px-3 py-1.5 rounded shadow-lg whitespace-nowrap z-50">
          French version coming soon
        </div>
      )}
    </div>
  );
}

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
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-gold" />
      </div>
    );
  }

  if (isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-white text-foreground">

      {/* Navbar */}
      <header className="bg-brand-navy border-b border-brand-navy-light sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="bg-white rounded px-2 py-1 shrink-0">
              <Image
                src="/logo.png"
                alt="Africa Infrastructure Partners"
                width={110}
                height={28}
                className="h-7 w-auto"
                priority
              />
            </div>
            <nav className="hidden md:flex items-center gap-6 text-sm text-gray-300">
              <a href="#sectors" className="hover:text-white transition-colors">Sectors</a>
              <a href="#features" className="hover:text-white transition-colors">Services</a>
              <a href="#stakeholders" className="hover:text-white transition-colors">About Us</a>
              <a href="https://www.africa-infra.com" className="hover:text-white transition-colors">Insights</a>
              <a href="mailto:contact@africa-infra.com" className="hover:text-white transition-colors">Contact</a>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <Link
              href="/login"
              className="hidden sm:block text-sm text-gray-300 hover:text-white transition-colors px-3 py-1.5"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="text-sm bg-brand-gold hover:bg-brand-gold-dark text-brand-navy font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              AIP Platform
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-white">
        <div className="max-w-7xl mx-auto px-6 pt-20 pb-20 text-center">
          <div className="inline-flex items-center gap-2 bg-brand-gold/10 border border-brand-gold/30 rounded-full px-4 py-1.5 text-sm text-brand-gold font-medium mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-gold" />
            African Infrastructure Intelligence Platform
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-brand-navy leading-tight max-w-4xl mx-auto">
            Connect Africa&apos;s Infrastructure{' '}
            <span className="text-brand-gold">Projects with Global Capital</span>
          </h1>
          <p className="mt-6 text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
            From project sourcing to investment close — structured pipeline management, PESTEL analysis, and IC governance for Africa&apos;s infrastructure ecosystem.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="w-full sm:w-auto px-8 py-3.5 bg-brand-gold hover:bg-brand-gold-dark text-brand-navy font-semibold rounded-lg transition-colors text-center"
            >
              Request Access
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto px-8 py-3.5 bg-white hover:bg-gray-50 border border-gray-300 text-brand-navy font-medium rounded-lg transition-colors text-center"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="bg-brand-navy">
        <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: '54', label: 'African Nations' },
            { value: '$2T+', label: 'Infrastructure Gap' },
            { value: '6', label: 'Stakeholder Types' },
            { value: '15+', label: 'Platform Modules' },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-3xl font-bold text-brand-gold">{s.value}</div>
              <div className="text-sm text-gray-400 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Stakeholders */}
      <section id="stakeholders" className="bg-gray-50 py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-brand-navy">Built for every stakeholder</h2>
            <p className="mt-3 text-gray-500 max-w-xl mx-auto">Role-based access tailored to how each participant interacts with infrastructure projects.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {USER_TYPES.map((t) => (
              <div key={t.role} className="bg-white rounded-xl border border-gray-200 p-6 hover:border-brand-gold/40 hover:shadow-sm transition-all">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-brand-gold/10 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-brand-gold" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d={t.icon} />
                    </svg>
                  </div>
                  <span className="font-semibold text-brand-navy">{t.role}</span>
                </div>
                <p className="text-sm text-gray-500 leading-relaxed">{t.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-white py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-brand-navy">Everything in one platform</h2>
            <p className="mt-3 text-gray-500 max-w-xl mx-auto">End-to-end tools for the full infrastructure investment lifecycle.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-gray-50 rounded-xl border border-gray-200 p-6">
                <div className="w-10 h-10 rounded-lg bg-brand-navy flex items-center justify-center mb-4">
                  <svg className="w-5 h-5 text-brand-gold" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d={f.icon} />
                  </svg>
                </div>
                <h3 className="font-semibold text-brand-navy mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA banner */}
      <section className="bg-brand-navy py-20">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to get started?</h2>
          <p className="text-gray-400 mb-8 max-w-lg mx-auto">
            Join infrastructure investors, DFIs, governments, and contractors already using AIP to manage African infrastructure deal-flow.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="w-full sm:w-auto px-8 py-3.5 bg-brand-gold hover:bg-brand-gold-dark text-brand-navy font-semibold rounded-lg transition-colors text-center"
            >
              Request Access
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto px-8 py-3.5 bg-transparent hover:bg-brand-navy-light border border-gray-600 text-white font-medium rounded-lg transition-colors text-center"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-brand-navy border-t border-brand-navy-light">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-white rounded px-2 py-1">
              <Image src="/logo.png" alt="AIP" width={90} height={24} className="h-6 w-auto" />
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <a href="https://www.africa-infra.com" className="hover:text-gray-300 transition-colors">www.africa-infra.com</a>
            <Link href="/login" className="hover:text-gray-300 transition-colors">Sign In</Link>
            <Link href="/register" className="hover:text-gray-300 transition-colors">Register</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
