"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import LogoBrand from "@/components/ui/LogoBrand"
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
  UserCircle,
  Bell,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import type { UserRole } from "@/types"
import { DemoButton } from "@/components/layout/demo-button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface Notifications {
  pending_tokens: number
  pending_proposals: number
  total: number
}

interface AppNotification {
  id: string
  type: string
  title: string
  message: string
  process_id: string | null
  read: boolean
  created_at: string
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/processes", label: "Procesos", icon: FolderOpen },
  { href: "/history", label: "Histórico", icon: BarChart3 },
]

const adminNavItems = [
  { href: "/alumnado", label: "Alumnado", icon: GraduationCap, roles: ["admin", "superadmin"] as UserRole[] },
  { href: "/orientador", label: "Orientación", icon: UserCircle, roles: ["admin", "superadmin", "orientador"] as UserRole[] },
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

const NOTIF_ICON: Record<string, React.ElementType> = {
  bullying_risk: AlertTriangle,
  proposal_generated: CheckCircle2,
  questionnaire_complete: Zap,
  rule_conflict: AlertTriangle,
  process_status: CheckCircle2,
}

function NotificationBell({
  inbox,
  onMarkRead,
}: {
  inbox: AppNotification[]
  onMarkRead: () => void
}) {
  const [open, setOpen] = useState(false)
  const unread = inbox.filter(n => !n.read).length

  return (
    <Popover
      open={open}
      onOpenChange={(val: boolean) => {
        setOpen(val)
        if (val && unread > 0) onMarkRead()
      }}
    >
      <PopoverTrigger asChild>
        <button
          className="relative p-1.5 rounded-lg text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
          title="Notificaciones"
        >
          <Bell className="w-4 h-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full leading-none">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" sideOffset={8} className="w-80 p-0 rounded-xl shadow-xl" onOpenAutoFocus={e => e.preventDefault()}>
        <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
          <p className="text-xs font-semibold">Notificaciones</p>
          <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {inbox.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">Sin notificaciones</p>
          ) : (
            inbox.map(n => {
              const Icon = NOTIF_ICON[n.type] ?? Bell
              const isBullying = n.type === "bullying_risk"
              return (
                <div
                  key={n.id}
                  className={`px-3 py-2.5 border-b last:border-0 hover:bg-muted/20 transition-colors ${!n.read ? "bg-primary/5" : ""}`}
                >
                  <div className="flex items-start gap-2">
                    <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${isBullying ? "text-red-500" : "text-primary"}`} />
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-medium leading-tight ${isBullying ? "text-red-700" : ""}`}>{n.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{n.message}</p>
                      {n.process_id && (
                        <Link
                          href={`/processes/${n.process_id}`}
                          onClick={() => setOpen(false)}
                          className="text-[10px] text-primary hover:underline"
                        >
                          Ver proceso →
                        </Link>
                      )}
                    </div>
                    {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />}
                  </div>
                  <p className="text-[9px] text-muted-foreground/60 mt-1 text-right">
                    {new Date(n.created_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

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
  badge,
}: {
  href: string
  label: string
  icon: React.ElementType
  active: boolean
  onClick?: () => void
  badge?: number
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
      <span className="flex-1">{label}</span>
      {badge != null && badge > 0 && (
        <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  )
}

export function Sidebar({ processId, userName, centerName, userRole }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notifications | null>(null)
  const [inbox, setInbox] = useState<AppNotification[]>([])

  useEffect(() => {
    async function fetchNotifications() {
      try {
        const [r1, r2] = await Promise.all([
          fetch("/api/notifications"),
          fetch("/api/notifications/inbox"),
        ])
        if (r1.ok) setNotifications(await r1.json())
        if (r2.ok) setInbox(await r2.json())
      } catch {
        // non-critical
      }
    }
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  async function markAllRead() {
    await fetch("/api/notifications/inbox", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{}" })
    setInbox(prev => prev.map(n => ({ ...n, read: true })))
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
    return (
      <>
        <div className="flex items-center gap-2 px-6 py-5 border-b border-sidebar-border">
          <LogoBrand size="sm" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm leading-tight">ClassMixer</p>
            {centerName && (
              <p className="text-xs text-sidebar-foreground/60 truncate">{centerName}</p>
            )}
          </div>
          <NotificationBell inbox={inbox} onMarkRead={markAllRead} />

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
              badge={href === "/processes" && notifications ? notifications.total : undefined}
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

        <div className="px-3 py-4 border-t border-sidebar-border space-y-1">
          <DemoButton />
          <NavLink
            href="/profile"
            label={userName ?? "Mi perfil"}
            icon={UserCircle}
            active={pathname === "/profile"}
            onClick={onNavigate}
          />
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
