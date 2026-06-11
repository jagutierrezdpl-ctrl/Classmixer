import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft, CheckCircle2, Clock, AlertCircle, Users, Download,
  Heart, Briefcase, UsersRound, XCircle,
} from "lucide-react"

type RelationType = "friendship" | "work" | "emotional" | "negative"

const RELATION_META: Record<RelationType, { label: string; color: string; icon: React.ElementType }> = {
  friendship: { label: "Amistad", color: "bg-pink-100 text-pink-700", icon: Heart },
  work:       { label: "Trabajo", color: "bg-blue-100 text-blue-700", icon: Briefcase },
  emotional:  { label: "Apoyo",   color: "bg-purple-100 text-purple-700", icon: UsersRound },
  negative:   { label: "Conflicto", color: "bg-red-100 text-red-700", icon: XCircle },
}

export default async function ResponsesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await getUserProfile()
  if (!profile) notFound()

  const supabase = createServiceClient()

  const { data: process } = await supabase
    .from("processes")
    .select("name, center_id")
    .eq("id", id)
    .eq("center_id", profile.center_id)
    .single()

  if (!process) notFound()

  const [
    { data: students },
    { data: tokens },
    { data: responses },
  ] = await Promise.all([
    supabase.from("students").select("id, first_name, last_name, current_class").eq("process_id", id).eq("active", true).order("last_name"),
    supabase.from("questionnaire_tokens").select("student_id, used, completed_at").eq("process_id", id),
    supabase.from("responses").select("respondent_student_id, target_student_id, relation_type").eq("process_id", id),
  ])

  const tokenMap = new Map((tokens ?? []).map(t => [t.student_id, t]))
  const responsesByStudent = new Map<string, { relation_type: string; target_student_id: string }[]>()
  for (const r of (responses ?? [])) {
    if (!responsesByStudent.has(r.respondent_student_id)) responsesByStudent.set(r.respondent_student_id, [])
    responsesByStudent.get(r.respondent_student_id)!.push(r)
  }

  const totalStudents = students?.length ?? 0
  const completedTokens = (tokens ?? []).filter(t => t.used).length
  const totalTokens = tokens?.length ?? 0
  const totalResponses = responses?.length ?? 0
  const completionPct = totalTokens > 0 ? Math.round((completedTokens / totalTokens) * 100) : 0

  // Response type breakdown
  const typeCount: Record<string, number> = {}
  for (const r of (responses ?? [])) {
    typeCount[r.relation_type] = (typeCount[r.relation_type] ?? 0) + 1
  }

  // Group students by class
  const byClass = new Map<string, typeof students>()
  for (const s of (students ?? [])) {
    if (!byClass.has(s.current_class)) byClass.set(s.current_class, [])
    byClass.get(s.current_class)!.push(s)
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/processes/${id}`}><ArrowLeft className="w-4 h-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Respuestas del cuestionario</h1>
            <p className="text-muted-foreground text-sm">{process.name}</p>
          </div>
        </div>
        {totalResponses > 0 && (
          <Button variant="outline" size="sm" asChild>
            <a href={`/api/processes/${id}/responses/export`} download>
              <Download className="w-4 h-4" />
              Exportar Excel
            </a>
          </Button>
        )}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-tight">{totalStudents}</p>
              <p className="text-xs text-muted-foreground">Alumnos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-tight text-green-600">{completedTokens}</p>
              <p className="text-xs text-muted-foreground">Respondieron</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-tight text-amber-600">{totalTokens - completedTokens}</p>
              <p className="text-xs text-muted-foreground">Pendientes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
              <Heart className="w-4 h-4 text-violet-600" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-tight">{totalResponses}</p>
              <p className="text-xs text-muted-foreground">Elecciones</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress bar */}
      {totalTokens > 0 && (
        <Card className="mb-6">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Participación</span>
              <span className="text-sm font-bold text-primary">{completionPct}%</span>
            </div>
            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${completionPct}%`,
                  background: completionPct === 100 ? "#16a34a" : completionPct >= 70 ? "#2563eb" : "#d97706",
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              {completedTokens} de {totalTokens} alumnos han completado el cuestionario
            </p>

            {/* Type breakdown */}
            {Object.keys(typeCount).length > 0 && (
              <div className="flex gap-2 flex-wrap mt-3 pt-3 border-t">
                {Object.entries(typeCount).map(([type, count]) => {
                  const meta = RELATION_META[type as RelationType]
                  if (!meta) return null
                  const Icon = meta.icon
                  return (
                    <span key={type} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}>
                      <Icon className="w-3 h-3" />
                      {meta.label}: {count}
                    </span>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* No questionnaire warning */}
      {totalTokens === 0 && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800 mb-1">Cuestionario no generado</p>
            <p className="text-sm text-amber-700">
              Todavía no se han generado los enlaces del cuestionario. Ve a la pestaña de Cuestionario para configurarlo y generar los enlaces.
            </p>
            <Link href={`/processes/${id}/questionnaire`} className="text-sm text-amber-800 underline font-medium mt-1 inline-block">
              Ir al cuestionario →
            </Link>
          </div>
        </div>
      )}

      {/* Per-class groups */}
      <div className="space-y-4">
        {[...byClass.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([className, classStudentsRaw]) => {
          const classStudents = classStudentsRaw ?? []
          const classCompleted = classStudents.filter(s => tokenMap.get(s.id)?.used).length
          const classPct = classStudents.length > 0 ? Math.round((classCompleted / classStudents.length) * 100) : 0

          return (
            <Card key={className}>
              <CardHeader className="pb-2 pt-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Badge variant="secondary">{className}</Badge>
                    <span className="font-normal text-muted-foreground">{classStudents.length} alumnos</span>
                  </CardTitle>
                  <span className="text-xs font-semibold text-primary">{classPct}% completado</span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {(classStudents ?? []).map(student => {
                    const token = tokenMap.get(student.id)
                    const studentResponses = responsesByStudent.get(student.id) ?? []
                    const byType = studentResponses.reduce<Record<string, number>>((acc, r) => {
                      acc[r.relation_type] = (acc[r.relation_type] ?? 0) + 1
                      return acc
                    }, {})

                    let statusIcon = <AlertCircle className="w-4 h-4 text-amber-400" />
                    let statusText = "Sin enlace"
                    let statusClass = "text-amber-600"

                    if (token?.used) {
                      statusIcon = <CheckCircle2 className="w-4 h-4 text-green-500" />
                      statusText = token.completed_at
                        ? new Date(token.completed_at).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
                        : "Completado"
                      statusClass = "text-green-600"
                    } else if (token) {
                      statusIcon = <Clock className="w-4 h-4 text-amber-400" />
                      statusText = "Pendiente"
                      statusClass = "text-amber-600"
                    }

                    return (
                      <div key={student.id} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">
                            {student.last_name}, {student.first_name}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          {Object.entries(byType).map(([type, count]) => {
                            const meta = RELATION_META[type as RelationType]
                            return (
                              <span key={type} className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${meta?.color ?? "bg-muted text-muted-foreground"}`}>
                                {meta?.label ?? type} {count}
                              </span>
                            )
                          })}
                        </div>
                        <div className={`flex items-center gap-1.5 text-xs shrink-0 ${statusClass}`}>
                          {statusIcon}
                          <span className="hidden sm:inline">{statusText}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
