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
  Menu,
  X,
  BarChart3,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useState } from "react"
import type { UserRole } from "@/types"
import { DemoButton } from "@/components/layout/demo-button"

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/processes", label: "Procesos", icon: FolderOpen },
  { href: "/history", label: "Histórico", icon: BarChart3 },
]

const adminNavItems = [
  { href: "/alumnado", label: "Alumnado", icon: GraduationCap, roles: ["admin", "superadmin"] as UserRole[] },
  { href: "/mis-grupos", label: "Mis Grupos", icon: Users, roles: ["tutor", "orientador"] as UserRole[] },
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

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  onClick,
}: {
  href: string
  label: string
  icon: React.ElementType
  active: boolean
  onClick?: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
      )}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {label}
    </Link>
  )
}

export function Sidebar({ processId, userName, centerName, userRole }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
    return (
      <>
        <div className="flex items-center gap-2 px-6 py-5 border-b border-sidebar-border">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm leading-tight">ClassMixer</p>
            {centerName && (
              <p className="text-xs text-sidebar-foreground/60 truncate">{centerName}</p>
            )}
          </div>
          {onNavigate && (
            <button
              onClick={onNavigate}
              className="text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => (
            <NavLink
              key={href}
              href={href}
              label={label}
              icon={Icon}
              active={pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/"))}
              onClick={onNavigate}
            />
          ))}

          {adminNavItems
            .filter(item => userRole && item.roles.includes(userRole))
            .map(({ href, label, icon: Icon }) => (
              <NavLink
                key={href}
                href={href}
                label={label}
                icon={Icon}
                active={pathname === href || pathname.startsWith(href + "/")}
                onClick={onNavigate}
              />
            ))}

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
                  <NavLink
                    key={href}
                    href={fullHref}
                    label={label}
                    icon={Icon}
                    active={pathname.startsWith(fullHref)}
                    onClick={onNavigate}
                  />
                )
              })}
            </>
          )}
        </nav>

        <div className="px-3 py-4 border-t border-sidebar-border space-y-2">
          <DemoButton />
          {userName && (
            <p className="px-3 text-xs text-sidebar-foreground/50 truncate">{userName}</p>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-background border shadow-sm"
        aria-label="Abrir menú"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "lg:hidden fixed top-0 left-0 z-50 flex flex-col h-full w-72 bg-sidebar-background text-sidebar-foreground border-r border-sidebar-border transition-transform duration-200 print:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent onNavigate={() => setMobileOpen(false)} />
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 min-h-screen bg-sidebar-background text-sidebar-foreground border-r border-sidebar-border print:hidden">
        <SidebarContent />
      </aside>
    </>
  )
}
