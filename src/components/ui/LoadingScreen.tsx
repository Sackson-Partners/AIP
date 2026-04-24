import { Building2 } from "lucide-react"

interface Props {
  message?: string
}

export function LoadingScreen({ message }: Props) {
  return (
    <div className="fixed inset-0 bg-slate-900 flex flex-col items-center justify-center z-50">
      <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 mb-5 shadow-lg shadow-blue-600/30">
        <Building2 className="w-7 h-7 text-white" />
      </div>
      <p className="text-white font-semibold text-lg tracking-tight mb-1">AIP Platform</p>
      {message && <p className="text-slate-400 text-sm mb-6">{message}</p>}
      <div className="w-8 h-8 rounded-full border-2 border-slate-700 border-t-blue-500 animate-spin mt-4" />
    </div>
  )
}
