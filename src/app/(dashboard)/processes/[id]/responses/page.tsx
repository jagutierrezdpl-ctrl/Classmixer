import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, CheckCircle2, Clock, AlertCircle, Users } from "lucide-react"

type RelationType = "friendship" | "work" | "emotional" | "negative"

const RELATION_LABELS: Record<RelationType, { label: string; color: string }> = {
  friendship: { label: "Amistad", color: "bg-pink-100 text-pink-700" },
  work:       { label: "Trabajo", color: "bg-blue-100 text-blue-700" },
  emotional:  { label: "Apoyo", color: "bg-purple-100 text-purple-700" },
  negative:   { label: "Conflicto", color: "bg-red-100 text-red-700" },
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

  // Count respondents who have no token (no questionnaire generated)


  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/processes/${id}`}><ArrowLeft className="w-4 h-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Respuestas del cuestionario</h1>
          <p className="text-muted-foreground text-sm">{process.name}</p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-bold">{totalStudents}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Alumnos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-bold text-green-600">{completedTokens}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Han respondido</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-bold text-amber-600">{totalTokens - completedTokens}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Pendientes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-bold">{totalResponses}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Elecciones totales</p>
          </CardContent>
        </Card>
      </div>

      {/* Progress bar */}
      {totalTokens > 0 && (
        <Card className="mb-8">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Participación</span>
              <span className="text-sm font-bold text-primary">{completionPct}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all"
                style={{ width: `${completionPct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              {completedTokens} de {totalTokens} alumnos han completado el cuestionario
            </p>
          </CardContent>
        </Card>
      )}

      {/* No questionnaire generated warning */}
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

      {/* Per-student table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" />
              Estado por alumno
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {(students ?? []).map(student => {
              const token = tokenMap.get(student.id)
              const studentResponses = responsesByStudent.get(student.id) ?? []
              const byType = studentResponses.reduce<Record<string, number>>((acc, r) => {
                acc[r.relation_type] = (acc[r.relation_type] ?? 0) + 1
                return acc
              }, {})

              let statusIcon = <Clock className="w-4 h-4 text-muted-foreground" />
              let statusText = "Sin enlace"
              let statusClass = "text-muted-foreground"

              if (!token) {
                statusIcon = <AlertCircle className="w-4 h-4 text-amber-400" />
                statusText = "Sin enlace"
                statusClass = "text-amber-600"
              } else if (token.used) {
                statusIcon = <CheckCircle2 className="w-4 h-4 text-green-500" />
                statusText = token.completed_at
                  ? new Date(token.completed_at).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
                  : "Completado"
                statusClass = "text-green-600"
              } else {
                statusIcon = <Clock className="w-4 h-4 text-amber-400" />
                statusText = "Pendiente"
                statusClass = "text-amber-600"
              }

              return (
                <div key={student.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {student.last_name}, {student.first_name}
                    </p>
                    <p className="text-xs text-muted-foreground">{student.current_class}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {Object.entries(byType).map(([type, count]) => {
                      const rel = RELATION_LABELS[type as RelationType]
                      return (
                        <span key={type} className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${rel?.color ?? "bg-muted text-muted-foreground"}`}>
                          {rel?.label ?? type}: {count}
                        </span>
                      )
                    })}
                  </div>
                  <div className={`flex items-center gap-1.5 text-xs shrink-0 min-w-24 justify-end ${statusClass}`}>
                    {statusIcon}
                    <span>{statusText}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
