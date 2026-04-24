"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { motion, AnimatePresence } from "framer-motion"
import { Building2, Loader2, CheckCircle2 } from "lucide-react"
import { getDashboardPath } from "@/lib/auth/role-dashboard"

type Role = "GOVERNMENT" | "SPONSOR_DEVELOPER" | "EPC_OPERATOR" | "INSTITUTIONAL_INVESTOR"

const ROLE_CARDS: {
  role: Role
  emoji: string
  title: string
  subtitle: string
  description: string
}[] = [
  {
    role: "GOVERNMENT",
    emoji: "🏛️",
    title: "Government & PPP Unit",
    subtitle: "Ministry / PPP Authority / IPA",
    description: "Submit projects, attract capital, track deal status and compliance",
  },
  {
    role: "SPONSOR_DEVELOPER",
    emoji: "🏗️",
    title: "Sponsor & Developer",
    subtitle: "Project developer / IPP / SPV / Concessionaire",
    description: "Structure deals, run PETFEL, generate investor-grade EINs",
  },
  {
    role: "EPC_OPERATOR",
    emoji: "⚙️",
    title: "EPC & Operator",
    subtitle: "Engineering / Procurement / Construction / O&M",
    description: "Identify project pipelines, tender opportunities, corridor analysis",
  },
  {
    role: "INSTITUTIONAL_INVESTOR",
    emoji: "💼",
    title: "Institutional Investor",
    subtitle: "PE fund / DFI / Sovereign wealth / Family office / Pension",
    description: "Access curated, scored deals with AI memos and PETFEL ratings",
  },
]

const SECTORS = [
  "ENERGY","TRANSPORT","WATER","DIGITAL","HEALTHCARE",
  "EDUCATION","AGRICULTURE","HOUSING","WASTE_MANAGEMENT","OTHER",
]
const REGIONS = [
  "West Africa","East Africa","Southern Africa","Central Africa",
  "North Africa","Pan-African",
]
const INVESTOR_TYPES = [
  { value: "PE_FUND",            label: "PE Fund" },
  { value: "DFI",                label: "DFI" },
  { value: "SOVEREIGN_WEALTH",   label: "Sovereign Wealth" },
  { value: "FAMILY_OFFICE",      label: "Family Office" },
  { value: "PENSION_FUND",       label: "Pension Fund" },
  { value: "INFRASTRUCTURE_FUND",label: "Infrastructure Fund" },
  { value: "BANK",               label: "Bank" },
  { value: "OTHER",              label: "Other" },
]

function Input({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-sm text-slate-400 mb-1">{label}</label>
      <input
        {...props}
        className="w-full bg-slate-800/60 border border-slate-700 rounded-xl py-2.5 px-3.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition"
      />
    </div>
  )
}

function MultiSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: string[]
  value: string[]
  onChange: (v: string[]) => void
}) {
  const toggle = (opt: string) =>
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt])
  return (
    <div>
      <label className="block text-sm text-slate-400 mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`px-3 py-1 rounded-lg text-xs font-medium border transition ${
              value.includes(opt)
                ? "bg-blue-600/20 border-blue-500/50 text-blue-300"
                : "bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-600"
            }`}
          >
            {opt.replace(/_/g, " ")}
          </button>
        ))}
      </div>
    </div>
  )
}

function ProfileStep({ role, profile, setProfile }: { role: Role; profile: Record<string, unknown>; setProfile: (p: Record<string, unknown>) => void }) {
  const set = (key: string, value: unknown) => setProfile({ ...profile, [key]: value })

  if (role === "GOVERNMENT") return (
    <div className="space-y-4">
      <Input label="Ministry / Authority Name *" placeholder="e.g. Ministry of Infrastructure" value={String(profile.ministry ?? "")} onChange={(e) => set("ministry", e.target.value)} required />
      <Input label="Country *" placeholder="e.g. Kenya" value={String(profile.country ?? "")} onChange={(e) => set("country", e.target.value)} required />
      <Input label="Region" placeholder="e.g. East Africa" value={String(profile.region ?? "")} onChange={(e) => set("region", e.target.value)} />
      <Input label="PPP Unit Name" placeholder="e.g. National PPP Unit" value={String(profile.pppUnitName ?? "")} onChange={(e) => set("pppUnitName", e.target.value)} />
      <Input label="Regulatory Authority" placeholder="e.g. Energy Regulatory Commission" value={String(profile.regulatoryAuth ?? "")} onChange={(e) => set("regulatoryAuth", e.target.value)} />
    </div>
  )

  if (role === "SPONSOR_DEVELOPER") return (
    <div className="space-y-4">
      <Input label="Company Name *" placeholder="e.g. Acme Energy Ltd" value={String(profile.companyName ?? "")} onChange={(e) => set("companyName", e.target.value)} required />
      <Input label="Registration Number" placeholder="e.g. 2024/123456/07" value={String(profile.registrationNo ?? "")} onChange={(e) => set("registrationNo", e.target.value)} />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Years Experience" type="number" min="0" value={String(profile.yearsExperience ?? "")} onChange={(e) => set("yearsExperience", e.target.value)} />
        <Input label="Portfolio Size (USD)" type="number" min="0" placeholder="e.g. 500000000" value={String(profile.portfolioSize ?? "")} onChange={(e) => set("portfolioSize", e.target.value)} />
      </div>
      <MultiSelect label="Sectors" options={SECTORS} value={(profile.sectors as string[]) ?? []} onChange={(v) => set("sectors", v)} />
      <MultiSelect label="Regions of Operation" options={REGIONS} value={(profile.regions as string[]) ?? []} onChange={(v) => set("regions", v)} />
    </div>
  )

  if (role === "EPC_OPERATOR") return (
    <div className="space-y-4">
      <Input label="Company Name *" placeholder="e.g. BuildCo Engineering" value={String(profile.companyName ?? "")} onChange={(e) => set("companyName", e.target.value)} required />
      <MultiSelect label="Capabilities" options={["Engineering","Procurement","Construction","O&M","Project Management"]} value={(profile.capabilities as string[]) ?? []} onChange={(v) => set("capabilities", v)} />
      <MultiSelect label="Sectors" options={SECTORS} value={(profile.sectors as string[]) ?? []} onChange={(v) => set("sectors", v)} />
      <MultiSelect label="Regions" options={REGIONS} value={(profile.regions as string[]) ?? []} onChange={(v) => set("regions", v)} />
    </div>
  )

  // INSTITUTIONAL_INVESTOR
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm text-slate-400 mb-1">Investor Type</label>
        <select
          value={String(profile.investorType ?? "")}
          onChange={(e) => set("investorType", e.target.value)}
          className="w-full bg-slate-800/60 border border-slate-700 rounded-xl py-2.5 px-3.5 text-white text-sm focus:outline-none focus:border-blue-500 transition"
        >
          <option value="">Select type…</option>
          {INVESTOR_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      <Input label="AUM (USD)" type="number" min="0" placeholder="Total assets under management" value={String(profile.aum ?? "")} onChange={(e) => set("aum", e.target.value)} />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Min Ticket (USD)" type="number" min="0" value={String(profile.minTicket ?? "")} onChange={(e) => set("minTicket", e.target.value)} />
        <Input label="Max Ticket (USD)" type="number" min="0" value={String(profile.maxTicket ?? "")} onChange={(e) => set("maxTicket", e.target.value)} />
      </div>
      <Input label="Target IRR (%)" type="number" min="0" max="100" placeholder="e.g. 15" value={String(profile.targetIRR ?? "")} onChange={(e) => set("targetIRR", e.target.value)} />
      <MultiSelect label="Preferred Sectors" options={SECTORS} value={(profile.preferredSectors as string[]) ?? []} onChange={(v) => set("preferredSectors", v)} />
      <MultiSelect label="Preferred Regions" options={REGIONS} value={(profile.preferredRegions as string[]) ?? []} onChange={(v) => set("preferredRegions", v)} />
      <div className="flex items-center gap-3">
        <input type="checkbox" id="esg" checked={Boolean(profile.requiresESG)} onChange={(e) => set("requiresESG", e.target.checked)} className="w-4 h-4 accent-blue-500" />
        <label htmlFor="esg" className="text-sm text-slate-300">ESG compliance required</label>
      </div>
      <div className="flex items-center gap-3">
        <input type="checkbox" id="accredited" checked={Boolean(profile.accredited)} onChange={(e) => set("accredited", e.target.checked)} className="w-4 h-4 accent-blue-500" />
        <label htmlFor="accredited" className="text-sm text-slate-300">Accredited investor</label>
      </div>
    </div>
  )
}

export default function CompleteProfilePage() {
  const { data: session } = useSession()
  const router = useRouter()

  const [step, setStep]         = useState(1)
  const [role, setRole]         = useState<Role | null>(null)
  const [profile, setProfile]   = useState<Record<string, unknown>>({})
  const [accepted, setAccepted] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  async function handleSubmit() {
    if (!role) return
    setLoading(true)
    setError(null)
    const res = await fetch("/api/auth/complete-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, profile }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error ?? "Failed to save profile"); return }
    router.push(getDashboardPath(role))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition ${
                  s < step ? "bg-blue-600 border-blue-600 text-white" :
                  s === step ? "border-blue-500 text-blue-400" :
                  "border-slate-700 text-slate-600"
                }`}>
                  {s < step ? <CheckCircle2 className="w-4 h-4" /> : s}
                </div>
                {s < 3 && <div className={`flex-1 h-0.5 w-16 ${s < step ? "bg-blue-600" : "bg-slate-700"}`} />}
              </div>
            ))}
          </div>
          <p className="text-slate-400 text-sm">
            Step {step} of 3 — {["Select Account Type", "Profile Details", "Confirm"][step - 1]}
          </p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">
                {["Complete Your Profile", "Your Details", "Confirm & Submit"][step - 1]}
              </h1>
              <p className="text-slate-400 text-sm">
                Welcome{session?.user?.name ? `, ${session.user.name}` : ""}
              </p>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-300 text-sm mb-6">
              {error}
            </div>
          )}

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <p className="text-slate-400 text-sm mb-6">Select the account type that best describes your organisation:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {ROLE_CARDS.map((card) => (
                    <button
                      key={card.role}
                      onClick={() => setRole(card.role)}
                      className={`text-left p-5 rounded-xl border-2 transition ${
                        role === card.role
                          ? "border-blue-500 bg-blue-600/10"
                          : "border-slate-700 bg-slate-800/40 hover:border-slate-600"
                      }`}
                    >
                      <div className="text-2xl mb-2">{card.emoji}</div>
                      <div className="font-semibold text-white text-sm">{card.title}</div>
                      <div className="text-slate-500 text-xs mt-0.5 mb-2">{card.subtitle}</div>
                      <div className="text-slate-400 text-xs">{card.description}</div>
                      {role === card.role && (
                        <div className="mt-3 flex items-center gap-1 text-blue-400 text-xs font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Selected
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setStep(2)}
                  disabled={!role}
                  className="mt-6 w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition"
                >
                  Continue
                </button>
              </motion.div>
            )}

            {step === 2 && role && (
              <motion.div key="step2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <ProfileStep role={role} profile={profile} setProfile={setProfile} />
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setStep(1)} className="flex-1 py-3 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 rounded-xl text-sm transition">
                    Back
                  </button>
                  <button onClick={() => setStep(3)} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition">
                    Review &amp; Confirm
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && role && (
              <motion.div key="step3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="bg-slate-800/40 rounded-xl p-5 mb-6">
                  <h3 className="text-slate-300 font-medium mb-3 text-sm">Summary</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Account type</span>
                      <span className="text-white font-medium">{ROLE_CARDS.find((c) => c.role === role)?.title}</span>
                    </div>
                    {Object.entries(profile).filter(([, v]) => v !== "" && v !== null && v !== undefined && !(Array.isArray(v) && !v.length)).map(([k, v]) => (
                      <div key={k} className="flex justify-between text-sm">
                        <span className="text-slate-500 capitalize">{k.replace(/([A-Z])/g, " $1").trim()}</span>
                        <span className="text-slate-300 text-right max-w-[200px] truncate">
                          {Array.isArray(v) ? v.join(", ") : String(v)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-start gap-3 mb-6">
                  <input
                    type="checkbox"
                    id="terms"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-blue-500"
                  />
                  <label htmlFor="terms" className="text-sm text-slate-400 cursor-pointer">
                    I confirm the information above is accurate and I agree to the AIP Platform terms of use and data processing policy.
                  </label>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setStep(2)} className="flex-1 py-3 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 rounded-xl text-sm transition">
                    Back
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!accepted || loading}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Complete Setup
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
