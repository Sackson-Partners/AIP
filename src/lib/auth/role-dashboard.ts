export type AIPRole =
  | "SUPER_ADMIN"
  | "ANALYST"
  | "GOVERNMENT"
  | "SPONSOR_DEVELOPER"
  | "EPC_OPERATOR"
  | "INSTITUTIONAL_INVESTOR"

export interface NavItem {
  label: string
  href: string
  icon: string
  badge?: "pending"
}

export interface RoleDashboardConfig {
  defaultPath: string
  label: string
  color: string
  navItems: NavItem[]
}

export const ROLE_DASHBOARD_CONFIG: Record<AIPRole, RoleDashboardConfig> = {
  SUPER_ADMIN: {
    defaultPath: "/admin",
    label: "Super Admin",
    color: "red",
    navItems: [
      { label: "Overview",  href: "/admin",          icon: "LayoutDashboard" },
      { label: "Users",     href: "/admin/users",     icon: "Users", badge: "pending" },
      { label: "Projects",  href: "/dashboard/projects",  icon: "FolderOpen" },
      { label: "Analytics", href: "/dashboard/analytics", icon: "BarChart3" },
      { label: "Audit Log", href: "/admin/audit",     icon: "ClipboardList" },
      { label: "Settings",  href: "/admin/settings",  icon: "Settings2" },
    ],
  },

  ANALYST: {
    defaultPath: "/analyst",
    label: "Analyst",
    color: "purple",
    navItems: [
      { label: "Dashboard",   href: "/analyst",          icon: "LayoutDashboard" },
      { label: "Projects",    href: "/analyst/projects",  icon: "FolderSearch" },
      { label: "PETFEL",      href: "/analyst/petfel",    icon: "Activity" },
      { label: "EIN Reports", href: "/analyst/ein",       icon: "FileText" },
      { label: "AI Memos",    href: "/analyst/memos",     icon: "Brain" },
    ],
  },

  GOVERNMENT: {
    defaultPath: "/dashboard/government",
    label: "Government",
    color: "blue",
    navItems: [
      { label: "Overview",        href: "/dashboard/government",    icon: "LayoutDashboard" },
      { label: "Submit Project",  href: "/dashboard/projects/new",  icon: "PlusCircle" },
      { label: "My Projects",     href: "/dashboard/projects",      icon: "FolderOpen" },
      { label: "Deal Status",     href: "/dashboard/deals",         icon: "TrendingUp" },
      { label: "Compliance",      href: "/dashboard/compliance",    icon: "Shield" },
      { label: "Investors",       href: "/dashboard/investors",     icon: "Users" },
    ],
  },

  SPONSOR_DEVELOPER: {
    defaultPath: "/dashboard/sponsor",
    label: "Sponsor",
    color: "green",
    navItems: [
      { label: "Dashboard",    href: "/dashboard/sponsor",   icon: "LayoutDashboard" },
      { label: "My Projects",  href: "/dashboard/projects",  icon: "FolderOpen" },
      { label: "PETFEL Tool",  href: "/dashboard/petfel",    icon: "Activity" },
      { label: "EIN Generator",href: "/dashboard/ein",       icon: "FileText" },
      { label: "Deal Room",    href: "/dashboard/dealroom",  icon: "Lock" },
      { label: "Capital Raise",href: "/dashboard/capital",   icon: "DollarSign" },
    ],
  },

  EPC_OPERATOR: {
    defaultPath: "/dashboard/epc",
    label: "EPC/Operator",
    color: "yellow",
    navItems: [
      { label: "Dashboard", href: "/dashboard/epc",       icon: "LayoutDashboard" },
      { label: "Pipeline",  href: "/dashboard/pipeline",  icon: "GitBranch" },
      { label: "Tenders",   href: "/dashboard/tenders",   icon: "FileSearch" },
      { label: "Corridors", href: "/dashboard/corridors", icon: "Map" },
      { label: "Partners",  href: "/dashboard/partners",  icon: "Handshake" },
    ],
  },

  INSTITUTIONAL_INVESTOR: {
    defaultPath: "/dashboard/investor",
    label: "Investor",
    color: "cyan",
    navItems: [
      { label: "Deal Flow",  href: "/dashboard/investor",  icon: "TrendingUp" },
      { label: "Projects",   href: "/dashboard/projects",  icon: "FolderOpen" },
      { label: "Watchlist",  href: "/dashboard/watchlist", icon: "Bookmark" },
      { label: "AI Memos",   href: "/dashboard/memos",     icon: "Brain" },
      { label: "Portfolio",  href: "/dashboard/portfolio", icon: "PieChart" },
    ],
  },
}

export function getDashboardPath(role: string): string {
  return ROLE_DASHBOARD_CONFIG[role as AIPRole]?.defaultPath ?? "/dashboard"
}
