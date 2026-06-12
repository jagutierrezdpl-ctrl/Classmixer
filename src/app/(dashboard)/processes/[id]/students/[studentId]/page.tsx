import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft, Heart, Users, UserCheck, UserX,
  AlertTriangle, BarChart3, Network, BookOpen, FileText,
} from "lucide-react"
import EditStudentDialog from "@/components/students/EditStudentDialog"
import ExcludeStudentDialog from "@/components/students/ExcludeStudentDialog"

const RELATION_LABELS: Record<string, { label: string; color: string }> = {
  friendship: { label: "Amistad", color: "bg-pink-100 text-pink-700" },
  work:       { label: "Trabajo", color: "bg-blue-100 text-blue-700" },
  emotional:  { label: "Apoyo emocional", color: "bg-purple-100 text-purple-700" },
  negative:   { label: "Conflicto", color: "bg-red-100 text-red-700" },
}

const LEVEL_COLORS: Record<string, string> = {
  Alto: "success", "Medio-alto": "secondary", Medio: "secondary",
  "Medio-bajo": "warning", Bajo: "destructive",
}
const BEHAVIOR_COLORS: Record<string, string> = {
  Positiva: "success", Normal: "secondary", Seguimiento: "warning", Conflictiva: "destructive",
}

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string; studentId: string }>
}) {
  const { id: processId, studentId } = await params
  const profile = await getUserProfile()
  if (!profile) notFound()

  const canSeeSensitive = ["admin", "superadmin", "orientador"].includes(profile.role)
  const supabase = createServiceClient()

  // Load all data in parallel
  const [
    { data: student },
    { data: allStudents },
    { data: givenResponses },
    { data: receivedResponses },
    { data: metricsRaw },
    { data: proposals },
  ] = await Promise.all([
    supabase.from("students").select("*").eq("id", studentId).eq("process_id", processId).single(),
    supabase.from("students").select("id, first_name, last_name, current_class").eq("process_id", processId).eq("active", true),
    supabase.from("responses").select("target_student_id, relation_type").eq("process_id", processId).eq("respondent_student_id", studentId),
    supabase.from("responses").select("respondent_student_id, relation_type").eq("process_id", processId).eq("target_student_id", studentId),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("sociogram_metrics").select("*").eq("process_id", processId).eq("student_id", studentId).maybeSingle(),
    supabase.from("proposals")
      .select("id, name, status, proposal_assignments!inner(target_class)")
      .eq("process_id", processId)
      .eq("proposal_assignments.student_id", studentId),
  ])

  if (!student) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const metrics = metricsRaw as any

  const studentMap = new Map((allStudents ?? []).map(s => [s.id, s]))

  // Filter sensitive data for non-privileged roles
  const visibleGiven = (givenResponses ?? []).filter(r =>
    canSeeSensitive ? true : r.relation_type !== "emotional" && r.relation_type !== "negative"
  )
  const visibleReceived = (receivedResponses ?? []).filter(r =>
    canSeeSensitive ? true : r.relation_type !== "emotional" && r.relation_type !== "negative"
  )

  // Compute reciprocal relations
  const givenTargets = new Set(visibleGiven.map(r => r.target_student_id))
  const receivedFrom = new Set(visibleReceived.map(r => r.respondent_student_id))
  const reciprocalIds = [...givenTargets].filter(id => receivedFrom.has(id))

  // Group given by target
  const givenByTarget = new Map<string, string[]>()
  for (const r of visibleGiven) {
    if (!givenByTarget.has(r.target_student_id)) givenByTarget.set(r.target_student_id, [])
    givenByTarget.get(r.target_student_id)!.push(r.relation_type)
  }

  // Group received by respondent
  const receivedByRespondent = new Map<string, string[]>()
  for (const r of visibleReceived) {
    if (!receivedByRespondent.has(r.respondent_student_id)) receivedByRespondent.set(r.respondent_student_id, [])
    receivedByRespondent.get(r.respondent_student_id)!.push(r.relation_type)
  }

  const isIsolated = metrics
    ? metrics.received_count === 0 && metrics.reciprocal_count === 0
    : visibleReceived.length === 0 && reciprocalIds.length === 0

  const isVulnerable = !isIsolated && metrics
    ? metrics.reciprocal_count === 1
    : reciprocalIds.length === 1

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/processes/${processId}/students`}><ArrowLeft className="w-4 h-4" /></Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">{student.first_name} {student.last_name}</h1>
            {isIsolated && (
              <Badge variant="destructive" className="text-xs gap-1">
                <AlertTriangle className="w-3 h-3" /> Aislado
              </Badge>
            )}
            {isVulnerable && !isIsolated && (
              <Badge variant="warning" className="text-xs gap-1">
                <AlertTriangle className="w-3 h-3" /> Vulnerable
              </Badge>
            )}
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(student as any).excluded_from_mix && (
              <Badge variant="destructive" className="text-xs gap-1">
                <UserX className="w-3 h-3" /> Baja
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm mt-0.5">
            {student.current_class} · {student.external_id ?? "Sin ID"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {["admin", "superadmin"].includes(profile.role) && (
            <ExcludeStudentDialog
              processId={processId}
              studentId={studentId}
              studentName={`${student.first_name} ${student.last_name}`}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              currentlyExcluded={(student as any).excluded_from_mix ?? false}
              onChanged={() => {}}
            />
          )}
          <EditStudentDialog
            processId={processId}
            studentId={studentId}
            initial={{
              average_grade: student.average_grade ?? null,
              academic_level: student.academic_level ?? null,
              behavior_level: student.behavior_level ?? null,
              needs_type: student.needs_type ?? null,
              observations: student.observations ?? null,
            }}
          />
          <Button variant="outline" size="sm" asChild>
            <Link href={`/processes/${processId}/students/${studentId}/report`} target="_blank">
              <FileText className="w-4 h-4" />
              Informe PDF
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: datos académicos + propuestas */}
        <div className="space-y-4">
          {/* Datos básicos */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BookOpen className="w-4 h-4" /> Datos académicos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Género</span>
                <span>{student.gender ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nota media</span>
                <span className="font-semibold">{student.average_grade ?? "—"}</span>
              </div>
              {student.academic_level && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Nivel</span>
                  {/* @ts-expect-error variant */}
                  <Badge variant={LEVEL_COLORS[student.academic_level] ?? "secondary"} className="text-xs">
                    {student.academic_level}
                  </Badge>
                </div>
              )}
              {student.behavior_level && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Conducta</span>
                  {/* @ts-expect-error variant */}
                  <Badge variant={BEHAVIOR_COLORS[student.behavior_level] ?? "secondary"} className="text-xs">
                    {student.behavior_level}
                  </Badge>
                </div>
              )}
              {student.needs_type && student.needs_type !== "No" && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nec. educ.</span>
                  <span className="text-xs font-medium text-purple-700">{student.needs_type}</span>
                </div>
              )}
              {student.observations && (
                <div className="pt-1 border-t">
                  <p className="text-xs text-muted-foreground">{student.observations}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Métricas sociales */}
          {metrics && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" /> Métricas sociales
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Elecciones recibidas</span>
                  <span className="font-semibold">{metrics.received_count ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Elecciones realizadas</span>
                  <span className="font-semibold">{metrics.given_count ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pares recíprocos</span>
                  <span className="font-semibold text-green-600">{metrics.reciprocal_count ?? 0}</span>
                </div>
                {metrics.centrality != null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Centralidad</span>
                    <span>{(metrics.centrality as number).toFixed(3)}</span>
                  </div>
                )}
                {metrics.betweenness != null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Intermediación</span>
                    <span>{(metrics.betweenness as number).toFixed(3)}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Propuestas */}
          {(proposals ?? []).length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Network className="w-4 h-4" /> Asignación en propuestas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(proposals ?? []).map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between">
                    <span className="text-muted-foreground">{p.name}</span>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-xs font-mono">
                        {p.proposal_assignments?.[0]?.target_class ?? "—"}
                      </Badge>
                      {p.status === "aprobada" && (
                        <Badge variant="success" className="text-xs">✓</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: relaciones */}
        <div className="lg:col-span-2 space-y-4">
          {/* Elecciones realizadas */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Heart className="w-4 h-4 text-pink-500" />
                Ha elegido
                <span className="text-muted-foreground font-normal">({givenByTarget.size})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {givenByTarget.size === 0 ? (
                <p className="text-sm text-muted-foreground">No ha realizado elecciones</p>
              ) : (
                <div className="space-y-1.5">
                  {[...givenByTarget.entries()].map(([targetId, types]) => {
                    const target = studentMap.get(targetId)
                    const isReciprocal = reciprocalIds.includes(targetId)
                    return (
                      <div key={targetId} className="flex items-center gap-3 py-1 px-2 rounded hover:bg-muted/40">
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium">
                            {target ? `${target.first_name} ${target.last_name}` : targetId}
                          </span>
                          {target && (
                            <span className="text-xs text-muted-foreground ml-1.5">({target.current_class})</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          {types.map(t => {
                            const rel = RELATION_LABELS[t]
                            return (
                              <span key={t} className={`text-xs px-1.5 py-0.5 rounded font-medium ${rel?.color ?? "bg-muted text-muted-foreground"}`}>
                                {rel?.label ?? t}
                              </span>
                            )
                          })}
                          {isReciprocal && (
                            <span title="Relación recíproca">
                              <UserCheck className="w-4 h-4 text-green-500 shrink-0" />
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Ha sido elegido por */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-500" />
                Ha sido elegido por
                <span className="text-muted-foreground font-normal">({receivedByRespondent.size})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {receivedByRespondent.size === 0 ? (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <UserX className="w-4 h-4" />
                  Ningún compañero ha elegido a este alumno
                </div>
              ) : (
                <div className="space-y-1.5">
                  {[...receivedByRespondent.entries()].map(([respondentId, types]) => {
                    const respondent = studentMap.get(respondentId)
                    const isReciprocal = reciprocalIds.includes(respondentId)
                    return (
                      <div key={respondentId} className="flex items-center gap-3 py-1 px-2 rounded hover:bg-muted/40">
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium">
                            {respondent ? `${respondent.first_name} ${respondent.last_name}` : respondentId}
                          </span>
                          {respondent && (
                            <span className="text-xs text-muted-foreground ml-1.5">({respondent.current_class})</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          {types.map(t => {
                            const rel = RELATION_LABELS[t]
                            return (
                              <span key={t} className={`text-xs px-1.5 py-0.5 rounded font-medium ${rel?.color ?? "bg-muted text-muted-foreground"}`}>
                                {rel?.label ?? t}
                              </span>
                            )
                          })}
                          {isReciprocal && (
                            <span title="Relación recíproca">
                              <UserCheck className="w-4 h-4 text-green-500 shrink-0" />
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Relaciones recíprocas destacadas */}
          {reciprocalIds.length > 0 && (
            <Card className="border-green-200 bg-green-50/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-green-700">
                  <UserCheck className="w-4 h-4" />
                  Relaciones recíprocas ({reciprocalIds.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {reciprocalIds.map(id => {
                    const s = studentMap.get(id)
                    return (
                      <Link key={id} href={`/processes/${processId}/students/${id}`}>
                        <Badge variant="outline" className="hover:bg-green-100 cursor-pointer text-xs">
                          {s ? `${s.first_name} ${s.last_name}` : id}
                        </Badge>
                      </Link>
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
