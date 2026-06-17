import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, hasFullAccess, getTutorGroups } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus, FolderOpen, ArrowRight, Users, MessageSquare, GitBranch, CheckCircle2 } from "lucide-react"

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

export default async function ProcessesPage() {
  const profile = await getUserProfile()
  if (!profile || !profile.center_id) redirect("/pending")
  const supabase = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let processes: any[] = []

  if (hasFullAccess(profile.role)) {
    const { data } = await supabase
      .from("processes")
      .select("*")
      .eq("center_id", profile.center_id)
      .order("created_at", { ascending: false })
    processes = data ?? []
  } else {
    const tutorGroups = await getTutorGroups(profile.center_id, profile.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: assignments } = await (supabase as any)
      .from("process_tutors")
      .select("process_id")
      .eq("user_id", profile.id)
    const assignedIds: string[] = (assignments ?? []).map((a: { process_id: string }) => a.process_id)

    const { data: allProcesses } = await supabase
      .from("processes")
      .select("*")
      .eq("center_id", profile.center_id)
      .order("created_at", { ascending: false })

    processes = (allProcesses ?? []).filter((p: { id: string; source_groups: string[] }) => {
      if (assignedIds.includes(p.id)) return true
      return tutorGroups.some(g => (p.source_groups ?? []).includes(g))
    })
  }

  // Fetch stats for all processes in parallel
  const processIds = processes.map(p => p.id)
  const [studentsRes, tokensRes, proposalsRes] = await Promise.all([
    processIds.length > 0
      ? supabase.from("students").select("process_id").in("process_id", processIds).eq("active", true)
      : Promise.resolve({ data: [] }),
    processIds.length > 0
      ? supabase.from("questionnaire_tokens").select("process_id, completed_at").in("process_id", processIds)
      : Promise.resolve({ data: [] }),
    processIds.length > 0
      ? supabase.from("proposals").select("process_id, status").in("process_id", processIds)
      : Promise.resolve({ data: [] }),
  ])

  const studentCounts = new Map<string, number>()
  const tokenCounts = new Map<string, { total: number; completed: number }>()
  const proposalCounts = new Map<string, number>()
  const approvedProposals = new Set<string>()

  ;(studentsRes.data ?? []).forEach((s: { process_id: string }) => {
    studentCounts.set(s.process_id, (studentCounts.get(s.process_id) ?? 0) + 1)
  })
  ;(tokensRes.data ?? []).forEach((t: { process_id: string; completed_at: string | null }) => {
    const cur = tokenCounts.get(t.process_id) ?? { total: 0, completed: 0 }
    tokenCounts.set(t.process_id, { total: cur.total + 1, completed: cur.completed + (t.completed_at ? 1 : 0) })
  })
  ;(proposalsRes.data ?? []).forEach((pr: { process_id: string; status: string }) => {
    proposalCounts.set(pr.process_id, (proposalCounts.get(pr.process_id) ?? 0) + 1)
    if (pr.status === "aprobada") approvedProposals.add(pr.process_id)
  })

  const active = processes.filter(p => !["cerrado", "archivado"].includes(p.status))
  const archived = processes.filter(p => ["cerrado", "archivado"].includes(p.status))

  function ProcessCard({ p, dim = false }: { p: Record<string, unknown>; dim?: boolean }) {
    const id = p.id as string
    const st = STATUS_MAP[p.status as string] ?? { label: p.status as string, variant: "outline" as const }
    const students = studentCounts.get(id) ?? 0
    const tokens = tokenCounts.get(id)
    const proposals = proposalCounts.get(id) ?? 0
    const approved = approvedProposals.has(id)
    const responsePct = tokens && tokens.total > 0 ? Math.round((tokens.completed / tokens.total) * 100) : null

    return (
      <Link href={`/processes/${id}`}>
        <Card className={`transition-all cursor-pointer hover:border-primary/50 hover:shadow-sm ${dim ? "opacity-60 hover:opacity-80" : ""}`}>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <p className="font-semibold">{p.name as string}</p>
                  <Badge variant={st.variant} className="text-xs">{st.label}</Badge>
                  {approved && (
                    <span className="flex items-center gap-0.5 text-xs text-green-600 font-medium">
                      <CheckCircle2 className="w-3 h-3" /> Aprobada
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  {p.source_level as string} → {p.target_level as string} · Curso {p.school_year as string}
                </p>
                {/* Quick stats */}
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {students > 0 && (
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {students} alumnos
                    </span>
                  )}
                  {responsePct !== null && (
                    <span className={`flex items-center gap-1 ${responsePct === 100 ? "text-green-600" : responsePct >= 70 ? "text-amber-600" : "text-muted-foreground"}`}>
                      <MessageSquare className="w-3 h-3" />
                      {responsePct}% respuestas
                      {tokens && <span className="text-muted-foreground">({tokens.completed}/{tokens.total})</span>}
                    </span>
                  )}
                  {proposals > 0 && (
                    <span className="flex items-center gap-1 text-indigo-600">
                      <GitBranch className="w-3 h-3" />
                      {proposals} propuesta{proposals !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                {/* Response bar */}
                {responsePct !== null && tokens && tokens.total > 0 && (
                  <div className="mt-2.5 h-1 bg-muted rounded-full overflow-hidden w-full max-w-xs">
                    <div
                      className={`h-full rounded-full transition-all ${responsePct === 100 ? "bg-green-500" : responsePct >= 70 ? "bg-amber-400" : "bg-blue-400"}`}
                      style={{ width: `${responsePct}%` }}
                    />
                  </div>
                )}
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
            </div>
          </CardContent>
        </Card>
      </Link>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Procesos</h1>
          <p className="text-muted-foreground text-sm mt-1">{processes.length} procesos en total</p>
        </div>
        <Button asChild>
          <Link href="/processes/new">
            <Plus className="w-4 h-4" />
            Nuevo proceso
          </Link>
        </Button>
      </div>

      {processes.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium mb-1">No hay procesos todavía</p>
          <p className="text-sm mb-6">Crea tu primer proceso para empezar a mezclar clases</p>
          <Button asChild>
            <Link href="/processes/new">
              <Plus className="w-4 h-4" />
              Crear primer proceso
            </Link>
          </Button>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <section className="mb-8">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Activos ({active.length})
              </h2>
              <div className="grid gap-3">
                {active.map(p => <ProcessCard key={p.id as string} p={p} />)}
              </div>
            </section>
          )}

          {archived.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Archivados ({archived.length})
              </h2>
              <div className="grid gap-3">
                {archived.map(p => <ProcessCard key={p.id as string} p={p} dim />)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
