"use client"

import { useState } from "react"
import { Settings2, Loader2, CheckCircle2 } from "lucide-react"

const DEFAULT_SETTINGS: Record<string, string> = {
  platform_name: "AIP - Africa Infrastructure Pipeline",
  support_email: "support@aip.com",
  maintenance_mode: "false",
  auto_approve_azure_users: "false",
  require_kyc: "true",
  session_timeout_hours: "8",
  petfel_min_score: "60",
  ein_expiry_days: "180",
  max_upload_size_mb: "50",
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? "bg-blue-600" : "bg-slate-700"}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  )
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>(DEFAULT_SETTINGS)
  const [saving, setSaving]     = useState<string | null>(null)
  const [saved, setSaved]       = useState<string | null>(null)

  const set = (key: string, value: string) =>
    setSettings((s) => ({ ...s, [key]: value }))

  async function save(section: string, keys: string[]) {
    setSaving(section)
    const payload = Object.fromEntries(keys.map((k) => [k, settings[k]]))
    await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    setSaving(null)
    setSaved(section)
    setTimeout(() => setSaved(null), 2000)
  }

  function SaveBtn({ section, keys }: { section: string; keys: string[] }) {
    return (
      <button
        onClick={() => save(section, keys)}
        disabled={saving === section}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition"
      >
        {saving === section && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        {saved === section && <CheckCircle2 className="w-3.5 h-3.5" />}
        {saved === section ? "Saved" : "Save"}
      </button>
    )
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-8">
        <Settings2 className="w-6 h-6 text-slate-400" />
        <h1 className="text-2xl font-bold text-white">Platform Settings</h1>
      </div>

      <div className="space-y-6">
        {/* General */}
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-white font-semibold">General</h2>
            <SaveBtn section="general" keys={["platform_name","support_email","maintenance_mode"]} />
          </div>
          <div className="space-y-4">
            {[["platform_name","Platform Name"],["support_email","Support Email"]].map(([k,l]) => (
              <div key={k}>
                <label className="block text-sm text-slate-400 mb-1">{l}</label>
                <input value={settings[k]} onChange={(e) => set(k, e.target.value)}
                  className="w-full bg-slate-900/60 border border-slate-700 rounded-xl py-2.5 px-3.5 text-white text-sm focus:outline-none focus:border-blue-500 transition" />
              </div>
            ))}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-300">Maintenance Mode</p>
                <p className="text-xs text-slate-500">Show maintenance page to all users</p>
              </div>
              <Toggle checked={settings.maintenance_mode === "true"} onChange={(v) => set("maintenance_mode", String(v))} />
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-white font-semibold">Security</h2>
            <SaveBtn section="security" keys={["auto_approve_azure_users","require_kyc","session_timeout_hours"]} />
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-300">Auto-approve Azure users</p>
                <p className="text-xs text-slate-500">Automatically activate new Microsoft sign-in users</p>
              </div>
              <Toggle checked={settings.auto_approve_azure_users === "true"} onChange={(v) => set("auto_approve_azure_users", String(v))} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-300">Require KYC for investors</p>
                <p className="text-xs text-slate-500">Mandate KYC verification before deal access</p>
              </div>
              <Toggle checked={settings.require_kyc === "true"} onChange={(v) => set("require_kyc", String(v))} />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Session timeout (hours)</label>
              <input type="number" min="1" max="24" value={settings.session_timeout_hours}
                onChange={(e) => set("session_timeout_hours", e.target.value)}
                className="w-32 bg-slate-900/60 border border-slate-700 rounded-xl py-2.5 px-3.5 text-white text-sm focus:outline-none focus:border-blue-500 transition" />
            </div>
          </div>
        </div>

        {/* Projects */}
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-white font-semibold">Projects</h2>
            <SaveBtn section="projects" keys={["petfel_min_score","ein_expiry_days"]} />
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">
                Min PETFEL score for publication: <span className="text-white font-medium">{settings.petfel_min_score}</span>
              </label>
              <input type="range" min="0" max="100" value={settings.petfel_min_score}
                onChange={(e) => set("petfel_min_score", e.target.value)}
                className="w-full accent-blue-500" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">EIN report validity (days)</label>
              <input type="number" min="1" value={settings.ein_expiry_days}
                onChange={(e) => set("ein_expiry_days", e.target.value)}
                className="w-32 bg-slate-900/60 border border-slate-700 rounded-xl py-2.5 px-3.5 text-white text-sm focus:outline-none focus:border-blue-500 transition" />
            </div>
          </div>
        </div>

        {/* Documents */}
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-white font-semibold">Documents</h2>
            <SaveBtn section="documents" keys={["max_upload_size_mb"]} />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Max upload size (MB)</label>
            <input type="number" min="1" max="500" value={settings.max_upload_size_mb}
              onChange={(e) => set("max_upload_size_mb", e.target.value)}
              className="w-32 bg-slate-900/60 border border-slate-700 rounded-xl py-2.5 px-3.5 text-white text-sm focus:outline-none focus:border-blue-500 transition" />
          </div>
        </div>
      </div>
    </div>
  )
}
