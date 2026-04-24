const STATUS_CLASSES: Record<string, string> = {
  // User statuses
  ACTIVE:       "bg-green-500/10 text-green-400 border-green-500/20",
  PENDING:      "bg-amber-500/10 text-amber-400 border-amber-500/20",
  SUSPENDED:    "bg-red-500/10 text-red-400 border-red-500/20",
  DEACTIVATED:  "bg-slate-500/10 text-slate-400 border-slate-500/20",
  // Project statuses
  DRAFT:        "bg-slate-500/10 text-slate-400 border-slate-500/20",
  SUBMITTED:    "bg-amber-500/10 text-amber-400 border-amber-500/20",
  UNDER_REVIEW: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  APPROVED:     "bg-green-500/10 text-green-400 border-green-500/20",
  FUNDED:       "bg-blue-500/10 text-blue-400 border-blue-500/20",
  CLOSED:       "bg-slate-500/10 text-slate-400 border-slate-500/20",
  REJECTED:     "bg-red-500/10 text-red-400 border-red-500/20",
}

interface Props {
  status: string
  size?: "sm" | "md"
}

export function StatusBadge({ status, size = "md" }: Props) {
  const classes = STATUS_CLASSES[status] ?? "bg-slate-500/10 text-slate-400 border-slate-500/20"
  const sizeClass = size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-0.5"
  const label = status.replace(/_/g, " ")
  return (
    <span className={`inline-flex items-center font-medium rounded-full border ${classes} ${sizeClass}`}>
      {label}
    </span>
  )
}
