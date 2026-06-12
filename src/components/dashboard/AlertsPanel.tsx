import { createServiceClient } from "@/lib/supabase/server"
import { AlertTriangle, Clock, ArrowRight } from "lucide-react"
import Link from "next/link"

interface Alert {
  type: "error" | "warning" | "info"
  message: string
  detail?: string
  href?: string
}

interface Props {
  centerId: string
}

export default async function AlertsPanel({ centerId }: Props) {
  const supabase = createServiceClient()

  // Load open/active processes with basic stats
  const { data: processes } = await supabase
    .from("processes")
    .select("id, name, status, created_at")
    .eq("center_id", centerId)
    .not("status", "in", '("cerrado","archivado")')
    .order("created_at", { ascending: false })

  if (!processes?.length) return null

  const pIds = processes.map(p => p.id)

  const [
    { data: tokens },
    { data: studentsWithoutEmail },
  ] = await Promise.all([
    supabase
      .from("questionnaire_tokens")
      .select("process_id, student_id, used")
      .in("process_id", pIds),
    supabase
      .from("students")
      .select("id, process_id")
      .in("process_id", pIds)
      .eq("active", true)
      .is("email", null),
  ])

  const alerts: Alert[] = []

  // Build completion map per process
  const tokenMap: Record<string, { total: number; completed: number; firstUsed?: string }> = {}
  for (const t of (tokens ?? [])) {
    if (!tokenMap[t.process_id]) tokenMap[t.process_id] = { total: 0, completed: 0 }
    tokenMap[t.process_id].total++
    if (t.used) tokenMap[t.process_id].completed++
  }

  for (const p of processes) {
    const stats = tokenMap[p.id]
    const ageInDays = Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86400000)

    // Open questionnaire with <40% participation and tokens generated
    if (p.status === "cuestionario_abierto" && stats && stats.total > 0) {
      const pct = Math.round((stats.completed / stats.total) * 100)
      if (pct < 40) {
        alerts.push({
          type: "warning",
          message: `«${p.name}» tiene baja participación`,
          detail: `Solo el ${pct}% de los alumnos ha respondido el cuestionario`,
          href: `/processes/${p.id}/questionnaire`,
        })
      }
    }

    // Borrador > 7 days with no questionnaire yet
    if (p.status === "borrador" && ageInDays >= 7) {
      alerts.push({
        type: "info",
        message: `«${p.name}» lleva ${ageInDays} días sin actividad`,
        detail: "El proceso está en borrador. Configura el cuestionario para avanzar.",
        href: `/processes/${p.id}`,
      })
    }
  }

  // Students who responded (token used) but have no email — truly unreachable by reminder
  const respondedWithoutEmail = (() => {
    const usedStudentIds = new Set(
      (tokens ?? []).filter(t => t.used).map(t => t.student_id)
    )
    return (studentsWithoutEmail ?? []).filter(s => usedStudentIds.has(s.id)).length
  })()
  if (respondedWithoutEmail > 0) {
    alerts.push({
      type: "info",
      message: `${respondedWithoutEmail} alumno${respondedWithoutEmail > 1 ? "s" : ""} respondieron sin identificarse`,
      detail: "Su email no quedó registrado y no podrán recibir comunicaciones",
      href: undefined,
    })
  }

  if (alerts.length === 0) return null

  const colors = {
    error:   { bg: "bg-red-50 border-red-200",   icon: "text-red-500",    text: "text-red-800",   detail: "text-red-600" },
    warning: { bg: "bg-amber-50 border-amber-200", icon: "text-amber-500", text: "text-amber-800", detail: "text-amber-600" },
    info:    { bg: "bg-blue-50 border-blue-200",  icon: "text-blue-500",   text: "text-blue-800",  detail: "text-blue-600" },
  }

  const icons = {
    error:   AlertTriangle,
    warning: AlertTriangle,
    info:    Clock,
  }

  return (
    <div className="mb-6 space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5" />
        Alertas ({alerts.length})
      </h2>
      {alerts.map((alert, i) => {
        const c = colors[alert.type]
        const Icon = icons[alert.type]
        const inner = (
          <div className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${c.bg}`}>
            <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${c.icon}`} />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${c.text}`}>{alert.message}</p>
              {alert.detail && <p className={`text-xs mt-0.5 ${c.detail}`}>{alert.detail}</p>}
            </div>
            {alert.href && <ArrowRight className={`w-4 h-4 shrink-0 ${c.icon} opacity-60`} />}
          </div>
        )
        return alert.href ? (
          <Link key={i} href={alert.href} className="block hover:opacity-90 transition-opacity">
            {inner}
          </Link>
        ) : (
          <div key={i}>{inner}</div>
        )
      })}
    </div>
  )
}

