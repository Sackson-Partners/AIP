const ROLE_CONFIG: Record<string, { label: string; classes: string }> = {
  SUPER_ADMIN:           { label: "Super Admin",          classes: "bg-red-500/10 text-red-400 border-red-500/20" },
  ANALYST:               { label: "Analyst",              classes: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  GOVERNMENT:            { label: "Government",           classes: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  SPONSOR_DEVELOPER:     { label: "Sponsor",              classes: "bg-green-500/10 text-green-400 border-green-500/20" },
  EPC_OPERATOR:          { label: "EPC / Operator",       classes: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  INSTITUTIONAL_INVESTOR:{ label: "Investor",             classes: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" },
}

const SIZE_CLASSES = {
  sm: "text-[10px] px-1.5 py-0.5",
  md: "text-xs px-2 py-0.5",
  lg: "text-sm px-3 py-1",
}

interface Props {
  role: string
  size?: "sm" | "md" | "lg"
}

export function RoleBadge({ role, size = "md" }: Props) {
  const config = ROLE_CONFIG[role]
  if (!config) return null
  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${config.classes} ${SIZE_CLASSES[size]}`}
    >
      {config.label}
    </span>
  )
}
