import type { LucideIcon } from "lucide-react"

interface Props {
  title: string
  subtitle?: string
  icon?: LucideIcon
  iconColor?: string
  actions?: React.ReactNode
}

export function PageHeader({ title, subtitle, icon: Icon, iconColor = "bg-blue-600", actions }: Props) {
  return (
    <div className="flex items-center justify-between pb-6 mb-6 border-b border-slate-800">
      <div className="flex items-center gap-4">
        {Icon && (
          <div className={`w-10 h-10 rounded-xl ${iconColor} flex items-center justify-center shadow-lg`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold text-white">{title}</h1>
          {subtitle && <p className="text-slate-400 text-sm mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  )
}
