import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  FolderOpen, Users, BookOpen, CheckCircle2, Plus,
  ArrowRight, Clock, Zap, Network, FileText, Sparkles,
  AlertTriangle, GraduationCap,
} from "lucide-react"
import { getCenterLicense } from "@/lib/license"
import { OnboardingWizard } from "@/components/layout/OnboardingWizard"

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "success" | "warning" | "outline" }> = {
  borrador: { label: "Borrador", variant: "secondary" },
  cuestionario_abierto: { label: "Cuestionario abierto", variant: "success" },
  cuestionario_cerrado: { label: "Cuestionario cerrado", variant: "warning" },
  en_analisis: { label: "En análisis", variant: "warning" },
  propuestas_generadas: { label: "Propuestas generadas", variant: "default" },
  propuesta_seleccionada: { label: "Propuesta seleccionada", variant: "success" },
  cerrado: { label: "Cerrado", variant: "outline" },
  archivado: { label: "Archivado", variant: "outline" },
}

const ACTION_LABELS: Record<string, { label: string; icon: string }> = {
  import_students: { label: "Importó alumnos", icon: "📥" },
  generate_proposals: { label: "Generó propuestas", icon: "⚡" },
  approve_proposal: { label: "Aprobó propuesta", icon: "✅" },
  edit_proposal_assignments: { label: "Editó distribución", icon: "✏️" },
  export_proposal_excel: { label: "Exportó Excel", icon: "📊" },
  export_sociogram_excel: { label: "Exportó sociograma", icon: "🕸️" },
  create_process: { label: "Creó proceso", icon: "📁" },
  generate_tokens: { label: "Generó cuestionario", icon: "📋" },
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Ahora mismo"
  if (mins < 60) return `Hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Hace ${hours}h`
  const days = Math.floor(hours / 24)
  return `Hace ${days}d`
}

export default async function DashboardPage() {
  const profile = await getUserProfile()
  const supabase = createServiceClient()

  const [
    { data: processes },
    { data: recentLogs },
  ] = await Promise.all([
    supabase
      .from("processes")
      .select("*")
      .eq("center_id", profile!.center_id)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("audit_logs")
      .select("*, users(name)")
      .eq("center_id", profile!.center_id)
      .order("created_at", { ascending: false })
      .limit(8),
  ])

  const allProcessIds = (processes ?? []).map(p => p.id)

  const pIds = allProcessIds.length > 0 ? allProcessIds : ["__none__"]

  const [
    { count: totalStudents },
    { count: openQuestionnaires },
    { count: pendingTokens },
    { count: approvedProposals },
    { count: isolatedStudents },
    { count: totalProfiles },
    { data: openProcessTokenStats },
  ] = await Promise.all([
    supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .in("process_id", pIds),
    supabase
      .from("processes")
      .select("id", { count: "exact", head: true })
      .eq("center_id", profile!.center_id)
      .eq("status", "cuestionario_abierto"),
    supabase
      .from("questionnaire_tokens")
      .select("id", { count: "exact", head: true })
      .in("process_id", pIds)
      .eq("used", false),
    supabase
      .from("proposals")
      .select("id", { count: "exact", head: true })
      .in("process_id", pIds)
      .eq("status", "aprobada"),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("sociogram_metrics")
      .select("id", { count: "exact", head: true })
      .in("process_id", pIds)
      .eq("received_count", 0),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("student_profiles")
      .select("id", { count: "exact", head: true })
      .eq("center_id", profile!.center_id),
    // Questionnaire progress per open process
    supabase
      .from("questionnaire_tokens")
      .select("process_id, used")
      .in("process_id", pIds),
  ])

  const activeProcesses = (processes ?? []).filter(p => !["cerrado", "archivado"].includes(p.status))
  const license = await getCenterLicense(supabase, profile!.center_id)

  // Build questionnaire completion map
  const tokenMap: Record<string, { total: number; completed: number }> = {}
  for (const t of (openProcessTokenStats ?? [])) {
    if (!tokenMap[t.process_id]) tokenMap[t.process_id] = { total: 0, completed: 0 }
    tokenMap[t.process_id].total++
    if (t.used) tokenMap[t.process_id].completed++
  }
  const openProcesses = (processes ?? []).filter(p => p.status === "cuestionario_abierto")

  const isAdmin = ["admin", "superadmin"].includes(profile?.role ?? "")

  return (
    <div className="p-8">
      <OnboardingWizard userRole={profile?.role ?? ""} />
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Bienvenido, {profile?.name}
          </p>
        </div>
        {isAdmin && (
          <Button asChild>
            <Link href="/processes/new">
              <Plus className="w-4 h-4" />
              Nuevo proceso
            </Link>
          </Button>
        )}
      </div>

      {/* License banner — only warn when at/near limit */}
      {license.max_processes !== null && activeProcesses.length >= license.max_processes && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>
            Has alcanzado el límite de procesos activos del plan <strong>{license.plan}</strong> ({license.max_processes}).
            Archiva procesos anteriores o actualiza tu licencia para crear más.
          </span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Procesos activos</CardTitle>
            <FolderOpen className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-3xl font-bold">{activeProcesses.length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {(processes ?? []).length} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Alumnos registrados</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-3xl font-bold">{totalStudents ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">en todos los procesos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Respuestas pendientes</CardTitle>
            <BookOpen className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-3xl font-bold">{pendingTokens ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {openQuestionnaires ?? 0} cuestionario{openQuestionnaires !== 1 ? "s" : ""} abierto{openQuestionnaires !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Propuestas aprobadas</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-3xl font-bold">{approvedProposals ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">distribucion{approvedProposals !== 1 ? "es" : ""} final{approvedProposals !== 1 ? "es" : ""}</p>
          </CardContent>
        </Card>

        {isAdmin && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">Perfiles alumnado</CardTitle>
              <GraduationCap className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-3xl font-bold">{totalProfiles ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-1">en el registro central</p>
            </CardContent>
          </Card>
        )}

        {(isolatedStudents ?? 0) > 0 && (
          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-400">Alumnos aislados</CardTitle>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-3xl font-bold text-amber-700 dark:text-amber-400">{isolatedStudents}</p>
              <p className="text-xs text-amber-600 mt-1">sin elecciones recibidas</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Questionnaire progress */}
      {openProcesses.length > 0 && (
        <div className="mb-6 space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Progreso cuestionarios abiertos</h2>
          {openProcesses.map(p => {
            const stats = tokenMap[p.id] ?? { total: 0, completed: 0 }
            const pct = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
            return (
              <Card key={p.id}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {stats.completed} / {stats.total} respuestas
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-sm font-bold ${pct >= 80 ? "text-green-600" : pct >= 50 ? "text-amber-600" : "text-red-600"}`}>
                        {pct}%
                      </span>
                      <Button variant="outline" size="sm" className="text-xs" asChild>
                        <a href={`/processes/${p.id}/questionnaire`}>Ver</a>
                      </Button>
                    </div>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${pct >= 80 ? "bg-green-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent processes */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Procesos recientes</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/processes" className="text-xs gap-1">
                  Ver todos <ArrowRight className="w-3 h-3" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {(processes ?? []).length === 0 ? (
                <div className="text-center py-10 text-muted-foreground px-4">
                  <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm mb-4">No hay procesos todavía.</p>
                  <Button asChild size="sm">
                    <Link href="/processes/new">Crear primer proceso</Link>
                  </Button>
                </div>
              ) : (
                <div className="divide-y">
                  {(processes ?? []).map(p => {
                    const st = STATUS_MAP[p.status] ?? { label: p.status, variant: "outline" as const }
                    return (
                      <Link
                        key={p.id}
                        href={`/processes/${p.id}`}
                        className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{p.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {p.source_level} → {p.target_level} · {p.school_year}
                          </p>
                        </div>
                        <Badge variant={st.variant} className="ml-3 shrink-0 text-xs">{st.label}</Badge>
                      </Link>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Quick actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Accesos rápidos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {activeProcesses.slice(0, 1).map(p => (
                <div key={p.id} className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide truncate">{p.name}</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button variant="outline" size="sm" className="text-xs h-8 justify-start" asChild>
                      <Link href={`/processes/${p.id}/sociogram`}>
                        <Network className="w-3 h-3 mr-1.5" /> Sociograma
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs h-8 justify-start" asChild>
                      <Link href={`/processes/${p.id}/algorithm`}>
                        <Zap className="w-3 h-3 mr-1.5" /> Algoritmo
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs h-8 justify-start" asChild>
                      <Link href={`/processes/${p.id}/proposals`}>
                        <FileText className="w-3 h-3 mr-1.5" /> Propuestas
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs h-8 justify-start" asChild>
                      <Link href={`/processes/${p.id}/students`}>
                        <Users className="w-3 h-3 mr-1.5" /> Alumnos
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
              {isAdmin && (
                <Button className="w-full mt-1 text-xs" size="sm" asChild>
                  <Link href="/processes/new">
                    <Plus className="w-3 h-3 mr-1.5" /> Nuevo proceso
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Recent activity */}
          {isAdmin && (recentLogs ?? []).length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base">Actividad reciente</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/audit" className="text-xs gap-1">
                    Ver todo <ArrowRight className="w-3 h-3" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(recentLogs as any[] ?? []).slice(0, 6).map((log: any) => {
                    const meta = ACTION_LABELS[log.action] ?? { label: log.action, icon: "•" }
                    return (
                      <div key={log.id} className="flex items-start gap-3 px-4 py-2.5">
                        <span className="text-base leading-none mt-0.5">{meta.icon}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate">
                            {log.users?.name ?? "Usuario"} — {meta.label}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            {timeAgo(log.created_at)}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
