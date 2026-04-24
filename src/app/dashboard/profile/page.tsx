// src/app/dashboard/profile/page.tsx
// MIGRATED: Supabase profile updates → NextAuth + Prisma

'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'
import {
  User,
  Mail,
  Building2,
  Globe,
  Phone,
  Briefcase,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
  Shield,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react'

const COUNTRIES = [
  'Algeria','Angola','Benin','Botswana','Burkina Faso','Burundi','Cabo Verde',
  'Cameroon','Central African Republic','Chad','Comoros','DRC','Congo',
  'Djibouti','Egypt','Equatorial Guinea','Eritrea','Eswatini','Ethiopia',
  'Gabon','Gambia','Ghana','Guinea','Guinea-Bissau','Ivory Coast','Kenya',
  'Lesotho','Liberia','Libya','Madagascar','Malawi','Mali','Mauritania',
  'Mauritius','Morocco','Mozambique','Namibia','Niger','Nigeria','Rwanda',
  'São Tomé and Príncipe','Senegal','Sierra Leone','Somalia','South Africa',
  'South Sudan','Sudan','Tanzania','Togo','Tunisia','Uganda','Zambia','Zimbabwe',
  'United Kingdom','United States','France','Germany','China','India','Other',
]

export default function ProfilePage() {
  const { data: session, update: updateSession } = useSession()
  const [loading, setLoading] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    organization: '',
    country: '',
    jobTitle: '',
    timezone: 'UTC',
    emailNotifications: true,
  })

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  })

  // Populate form from session
  useEffect(() => {
    if (session?.user) {
      setFormData((prev) => ({
        ...prev,
        firstName: session.user.firstName ?? '',
        lastName: session.user.lastName ?? '',
        organization: session.user.organization ?? '',
      }))
    }
  }, [session])

  // ── Profile update ─────────────────────────────────────────────
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setSuccess(null)
    setError(null)

    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to update profile')
        return
      }

      // Refresh NextAuth session with new data
      await updateSession({
        firstName: formData.firstName,
        lastName: formData.lastName,
        organization: formData.organization,
      })

      setSuccess('Profile updated successfully')
      setTimeout(() => setSuccess(null), 3000)
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Password change (internal accounts only) ───────────────────
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('New passwords do not match')
      return
    }

    setPasswordLoading(true)
    setSuccess(null)
    setError(null)

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
          confirmPassword: passwordData.confirmPassword,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to change password')
        return
      }

      setSuccess('Password changed successfully')
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setTimeout(() => setSuccess(null), 3000)
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setPasswordLoading(false)
    }
  }

  const isInternal = session?.user?.authProvider === 'INTERNAL'
  const initials = (
    session?.user?.firstName?.[0] ??
    session?.user?.email?.[0] ??
    'U'
  ).toUpperCase()

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-5 bg-slate-800/60 border border-slate-700 rounded-2xl p-6">
        <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-2xl font-bold text-white shrink-0">
          {initials}
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">
            {session?.user?.name ?? 'My Profile'}
          </h1>
          <p className="text-slate-400 text-sm">{session?.user?.email}</p>
          <div className="flex items-center gap-1.5 mt-1.5">
            {isInternal ? (
              <span className="flex items-center gap-1 text-xs text-slate-300 bg-slate-700 px-2 py-0.5 rounded-full">
                <Shield className="w-3 h-3" /> Internal Account
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-blue-300 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">
                <Globe className="w-3 h-3" /> Microsoft Account
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Alerts */}
      {success && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm"
        >
          <CheckCircle className="w-4 h-4 shrink-0" />
          {success}
        </motion.div>
      )}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </motion.div>
      )}

      {/* Profile Form */}
      <form
        onSubmit={handleProfileSubmit}
        className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 space-y-5"
      >
        <div className="flex items-center gap-2 mb-1">
          <User className="w-4 h-4 text-slate-400" />
          <h2 className="text-white font-semibold">Personal Information</h2>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">First Name</label>
            <input
              type="text"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              className="w-full bg-slate-900/60 border border-slate-600 rounded-xl py-2.5 px-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Last Name</label>
            <input
              type="text"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              className="w-full bg-slate-900/60 border border-slate-600 rounded-xl py-2.5 px-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Email Address</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="email"
              value={session?.user?.email ?? ''}
              disabled
              className="w-full bg-slate-900/30 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-slate-500 cursor-not-allowed"
            />
          </div>
          <p className="text-slate-500 text-xs mt-1">
            Email cannot be changed here.{' '}
            {isInternal ? 'Contact your administrator.' : 'Managed by Microsoft.'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              <span className="flex items-center gap-1.5"><Phone className="w-3 h-3" /> Phone</span>
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+1 234 567 8900"
              className="w-full bg-slate-900/60 border border-slate-600 rounded-xl py-2.5 px-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              <span className="flex items-center gap-1.5"><Briefcase className="w-3 h-3" /> Job Title</span>
            </label>
            <input
              type="text"
              value={formData.jobTitle}
              onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
              placeholder="e.g. Investment Manager"
              className="w-full bg-slate-900/60 border border-slate-600 rounded-xl py-2.5 px-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            <span className="flex items-center gap-1.5"><Building2 className="w-3 h-3" /> Organization</span>
          </label>
          <input
            type="text"
            value={formData.organization}
            onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
            placeholder="Company or institution name"
            className="w-full bg-slate-900/60 border border-slate-600 rounded-xl py-2.5 px-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            <span className="flex items-center gap-1.5"><Globe className="w-3 h-3" /> Country</span>
          </label>
          <select
            value={formData.country}
            onChange={(e) => setFormData({ ...formData, country: e.target.value })}
            className="w-full bg-slate-900/60 border border-slate-600 rounded-xl py-2.5 px-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select country...</option>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.emailNotifications}
            onChange={(e) => setFormData({ ...formData, emailNotifications: e.target.checked })}
            className="w-4 h-4 accent-blue-500"
          />
          <span className="text-slate-300 text-sm">
            Receive email notifications for project updates and alerts
          </span>
        </label>

        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </form>

      {/* Password Change — internal accounts only */}
      {isInternal && (
        <form
          onSubmit={handlePasswordSubmit}
          className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 space-y-5"
        >
          <div className="flex items-center gap-2 mb-1">
            <Lock className="w-4 h-4 text-slate-400" />
            <h2 className="text-white font-semibold">Change Password</h2>
            <span className="text-xs text-slate-400 bg-slate-700 px-2 py-0.5 rounded-full ml-1">Internal Only</span>
          </div>

          {[
            { key: 'currentPassword' as const, label: 'Current Password', show: showPasswords.current, toggle: () => setShowPasswords((p) => ({ ...p, current: !p.current })) },
            { key: 'newPassword'     as const, label: 'New Password',     show: showPasswords.new,     toggle: () => setShowPasswords((p) => ({ ...p, new:     !p.new     })) },
            { key: 'confirmPassword' as const, label: 'Confirm New Password', show: showPasswords.confirm, toggle: () => setShowPasswords((p) => ({ ...p, confirm: !p.confirm })) },
          ].map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">{field.label}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type={field.show ? 'text' : 'password'}
                  value={passwordData[field.key]}
                  onChange={(e) => setPasswordData({ ...passwordData, [field.key]: e.target.value })}
                  className="w-full bg-slate-900/60 border border-slate-600 rounded-xl py-2.5 pl-10 pr-12 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <button
                  type="button"
                  onClick={field.toggle}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {field.show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}

          <button
            type="submit"
            disabled={passwordLoading}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
          >
            {passwordLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            Change Password
          </button>
        </form>
      )}

      {/* Azure AD users — point to Microsoft */}
      {!isInternal && (
        <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-4 h-4 text-slate-400" />
            <h2 className="text-white font-semibold">Password Management</h2>
          </div>
          <p className="text-slate-400 text-sm mb-4">
            Your account is managed by Microsoft. To change your password, visit your Microsoft account settings.
          </p>
          <a
            href="https://account.microsoft.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#2F2F2F] hover:bg-[#3a3a3a] text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Globe className="w-4 h-4" />
            Manage Microsoft Account →
          </a>
        </div>
      )}
    </div>
  )
}
