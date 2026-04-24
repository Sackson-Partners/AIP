import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { SessionProvider } from "@/providers/SessionProvider"
import { ToastProvider } from "@/context/ToastContext"
import { ErrorBoundary } from "@/components/ErrorBoundary"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "AIP — Africa Infrastructure Partners",
  description:
    "African Infrastructure Intelligence Platform. Deal-flow, analysis, and pipeline management for infrastructure investors, DFIs, and government stakeholders across Africa.",
  openGraph: {
    title: "AIP — Africa Infrastructure Partners",
    description:
      "African Infrastructure Intelligence Platform for investors, DFIs, and government stakeholders.",
    url: "https://www.africa-infra.com",
    siteName: "AIP Platform",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AIP — Africa Infrastructure Partners",
    description: "African Infrastructure Intelligence Platform.",
  },
  metadataBase: new URL("https://www.africa-infra.com"),
  icons: { icon: "/logo.png", apple: "/logo.png" },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ErrorBoundary>
          <SessionProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </SessionProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}
