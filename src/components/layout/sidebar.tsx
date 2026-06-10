"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  FolderOpen,
  Users,
  Network,
  BookOpen,
  LogOut,
  GraduationCap,
  Zap,
  ClipboardList,
  Settings,
  Shield,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import type { UserRole } from "@/types"

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: null },
  { href: "/processes", label: "Procesos", icon: FolderOpen, roles: null },
]

const adminNavItems = [
  { href: "/users", label: "Usuarios", icon: Users, roles: ["admin", "superadmin"] as UserRole[] },
  { href: "/audit", label: "Auditoría", icon: ClipboardList, roles: ["admin", "superadmin"] as UserRole[] },
  { href: "/settings", label: "Configuración", icon: Settings, roles: ["admin", "superadmin"] as UserRole[] },
  { href: "/admin", label: "Super Admin", icon: Shield, roles: ["superadmin"] as UserRole[] },
]

const processNavItems = [
  { href: "students", label: "Alumnos", icon: Users },
  { href: "questionnaire", label: "Cuestionario", icon: BookOpen },
  { href: "sociogram", label: "Sociograma", icon: Network },
  { href: "rules", label: "Reglas", icon: GraduationCap },
  { href: "algorithm", label: "Algoritmo", icon: Zap },
  { href: "proposals", label: "Propuestas", icon: LayoutDashboard },
]

interface SidebarProps {
  processId?: string
  userName?: string
  centerName?: string
  userRole?: UserRole
}

export function Sidebar({ processId, userName, centerName, userRole }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-sidebar-background text-sidebar-foreground border-r border-sidebar-border print:hidden">
      {/* Logo */}
      <div className="flex items-center gap-2 px-6 py-5 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <GraduationCap className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-bold text-sm leading-tight">ClassMixer</p>
          {centerName && (
            <p className="text-xs text-sidebar-foreground/60 truncate max-w-[140px]">{centerName}</p>
          )}
        </div>
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
              pathname === href || pathname.startsWith(href + "/")
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </Link>
        ))}

        {/* Admin nav */}
        {adminNavItems
          .filter(item => !item.roles || (userRole && item.roles.includes(userRole)))
          .map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                pathname === href || pathname.startsWith(href + "/")
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          ))}

        {/* Process sub-nav */}
        {processId && (
          <>
            <div className="pt-4 pb-1 px-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                Proceso actual
              </p>
            </div>
            {processNavItems.map(({ href, label, icon: Icon }) => {
              const fullHref = `/processes/${processId}/${href}`
              return (
                <Link
                  key={href}
                  href={fullHref}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                    pathname.startsWith(fullHref)
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </Link>
              )
            })}
          </>
        )}
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 border-t border-sidebar-border">
        {userName && (
          <p className="px-3 text-xs text-sidebar-foreground/50 mb-2 truncate">{userName}</p>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
