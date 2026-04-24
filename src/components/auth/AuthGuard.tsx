"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { LoadingScreen } from "@/components/ui/LoadingScreen"

interface Props {
  children: React.ReactNode
  requiredRole?: string
}

export function AuthGuard({ children, requiredRole }: Props) {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "loading") return
    if (status === "unauthenticated") {
      router.push("/auth/signin")
      return
    }
    if (requiredRole && session?.user?.role !== requiredRole) {
      router.push("/unauthorized")
    }
  }, [status, session, requiredRole, router])

  if (status === "loading") return <LoadingScreen />
  if (status === "unauthenticated") return null
  if (requiredRole && session?.user?.role !== requiredRole) return null

  return <>{children}</>
}
