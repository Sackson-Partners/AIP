'use client'

import { useState } from 'react'
import Link from 'next/link'

const ROLES = [
  { value: 'GOV_FOCAL',  label: 'Government — Focal Point' },
  { value: 'GOV_TECH',   label: 'Government — Technical Member' },
  { value: 'EPC',        label: 'EPC Company' },
  { value: 'SPONSOR',    label: 'Sponsor / Developer' },
  { value: 'PARTNER',    label: 'Investor / Partner' },
]

const GOV_ROLES = ['GOV_FOCAL', 'GOV_TECH']

// Abbreviated ISO country list (Africa-focused + global)
const COUNTRIES = [
  'Algeria','Angola','Benin','Botswana','Burkina Faso','Burundi','Cameroon','Cape Verde',
  'Central African Republic','Chad','Comoros','Congo','DR Congo','Djibouti','Egypt',
  'Equatorial Guinea','Eritrea','Eswatini','Ethiopia','Gabon','Gambia','Ghana','Guinea',
  'Guinea-Bissau','Ivory Coast','Kenya','Lesotho','Liberia','Libya','Madagascar','Malawi',
  'Mali','Mauritania','Mauritius','Morocco','Mozambique','Namibia','Niger','Nigeria','Rwanda',
  'São Tomé and Príncipe','Senegal','Sierra Leone','Somalia','South Africa','South Sudan',
  'Sudan','Tanzania','Togo','Tunisia','Uganda','Zambia','Zimbabwe',
  '---',
  'Canada','China','France','Germany','India','Japan','Netherlands','Norway','United Kingdom',
  'United States','Other',
]

export default function RequestAccessPage() {
  const [form, setForm] = useState({
    email: '', fullName: '', organization: '', country: '', phone: '',
    roleRequested: '', ministry: '', message: '',
  })
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const isGovRole = GOV_ROLES.includes(form.roleRequested)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.email || !form.fullName || !form.roleRequested) return
    if (isGovRole && !form.ministry.trim()) {
      setErrorMsg('Ministry / Department is required for government roles.')
      setStatus('error')
      return
    }
    setStatus('loading')
    setErrorMsg('')
    try {
      const res = await fetch('/api/auth/request-access', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setErrorMsg(data.error ?? 'Submission failed'); setStatus('error'); return }
      setStatus('success')
    } catch {
      setErrorMsg('Network error. Please try again.')
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-brand-navy flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Request Submitted</h2>
          <p className="text-gray-500 mb-6">
            Thank you for your interest in the AIP Platform. Our team will review your request and contact you at{' '}
            <strong>{form.email}</strong> within 2–3 business days.
          </p>
          <Link href="/auth/signin" className="text-brand-navy font-semibold hover:underline">
            Back to Sign In
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-navy flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl p-10 max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-brand-gold rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-brand-navy font-bold text-xl">AIP</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Request Platform Access</h1>
          <p className="text-gray-500 mt-1 text-sm">
            AIP is invitation-only. Submit your details and our team will review your request.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
            <input
              type="text"
              required
              value={form.fullName}
              onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
              placeholder="Your full name"
            />
          </div>

          {/* Work Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Work Email *</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
              placeholder="you@organisation.com"
            />
          </div>

          {/* Organisation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Organisation</label>
            <input
              type="text"
              value={form.organization}
              onChange={e => setForm(f => ({ ...f, organization: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
              placeholder="Ministry, Fund, Company name..."
            />
          </div>

          {/* Country + Phone row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
              <select
                value={form.country}
                onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold bg-white"
              >
                <option value="">Select country</option>
                {COUNTRIES.map(c =>
                  c === '---'
                    ? <option key="sep" disabled>──────────</option>
                    : <option key={c} value={c}>{c}</option>
                )}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input
                type="tel"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
                placeholder="+27 82 000 0000"
              />
            </div>
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">I am a... *</label>
            <select
              required
              value={form.roleRequested}
              onChange={e => setForm(f => ({ ...f, roleRequested: e.target.value, ministry: '' }))}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold bg-white"
            >
              <option value="">Select your role</option>
              {ROLES.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* Ministry — conditional on government roles */}
          {isGovRole && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ministry / Department *</label>
              <input
                type="text"
                required
                value={form.ministry}
                onChange={e => setForm(f => ({ ...f, ministry: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
                placeholder="e.g. Ministry of Energy and Water Resources"
              />
            </div>
          )}

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Why are you requesting access?</label>
            <textarea
              rows={3}
              value={form.message}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold resize-none"
              placeholder="Brief description of your interest in the platform..."
            />
          </div>

          {status === 'error' && (
            <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{errorMsg}</p>
          )}

          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full bg-brand-gold text-brand-navy font-semibold py-3 rounded-lg hover:bg-amber-400 transition disabled:opacity-60"
          >
            {status === 'loading' ? 'Submitting…' : 'Submit Access Request'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have access?{' '}
          <Link href="/auth/signin" className="text-brand-navy font-semibold hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
