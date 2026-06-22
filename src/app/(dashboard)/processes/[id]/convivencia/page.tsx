import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, logAudit } from "@/lib/auth"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, ShieldAlert, AlertTriangle, Download, Users } from "lucide-react"

interface FlaggedStudent {
  name: string
  current_class: string
  signals: number
}

interface BullyingCategory {
  code: string
  label: string
  total: number
  topMentions: { name: string; current_class: string; count: number }[]
}

interface ConvivenciaData {
  totalResponses: number
  flagged: FlaggedStudent[]
  categories: BullyingCategory[]
}

export default async function ConvivenciaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const profile = await getUserProfile()
  if (!profile) notFound()
  if (!["admin", "superadmin", "orientador"].includes(profile.role)) notFound()

  const supabase = createServiceClient()
  const { data: process } = await supabase
    .from("processes")
    .select("name, school_year, center_id")
    .eq("id", id)
    .single()

  if (!process || process.center_id !== profile.center_id) notFound()

  // Fetch convivencia data inline (same logic as the API)
  const { data: bullyingTypes } = await supabase
    .from("question_types")
    .select("code, label")
    .eq("category", "bullying")
    .eq("active", true)
    .or(`center_id.is.null,center_id.eq.${profile.center_id}`)

  const codes = (bullyingTypes ?? []).map((t: { code: string }) => t.code)

  const [{ data: students }, { data: responsesRaw }] = await Promise.all([
    supabase.from("students").select("id, first_name, last_name, current_class").eq("process_id", id).eq("active", true),
    codes.length > 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (supabase as any).from("responses").select("respondent_student_id, target_student_id, relation_type").eq("process_id", id).in("relation_type", codes)
      : Promise.resolve({ data: [] as { respondent_student_id: string; target_student_id: string; relation_type: string }[] }),
  ])

  const studentMap = new Map((students ?? []).map((s) => [s.id, s]))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const responses = (responsesRaw ?? []) as { respondent_student_id: string; target_student_id: string; relation_type: string }[]

  // Also fetch students for linking to intervention ficha
  const { data: allStudents } = await supabase
    .from("students")
    .select("id, first_name, last_name, current_class")
    .eq("process_id", id)
    .eq("active", true)

  const studentIdByName = new Map(
    (allStudents ?? []).map((s) => [`${s.first_name} ${s.last_name}`, s.id])
  )

  const FLAG_THRESHOLD = 2
  const signalsByStudent = new Map<string, number>()

  const categories: BullyingCategory[] = (bullyingTypes ?? []).map((t: { code: string; label: string }) => {
    const ofType = responses.filter((r) => r.relation_type === t.code)
    const countByTarget = new Map<string, number>()
    for (const r of ofType) {
      countByTarget.set(r.target_student_id, (countByTarget.get(r.target_student_id) ?? 0) + 1)
      signalsByStudent.set(r.target_student_id, (signalsByStudent.get(r.target_student_id) ?? 0) + 1)
    }
    const topMentions = [...countByTarget.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([studentId, count]) => {
        const s = studentMap.get(studentId)
        return {
          name: s ? `${s.first_name} ${s.last_name}` : "Desconocido",
          current_class: s?.current_class ?? "",
          count,
        }
      })
    return { code: t.code, label: t.label, total: ofType.length, topMentions }
  })

  const flagged: (FlaggedStudent & { student_id: string })[] = [...signalsByStudent.entries()]
    .filter(([, count]) => count >= FLAG_THRESHOLD)
    .sort((a, b) => b[1] - a[1])
    .map(([studentId, signals]) => {
      const s = studentMap.get(studentId)
      return {
        student_id: studentId,
        name: s ? `${s.first_name} ${s.last_name}` : "Desconocido",
        current_class: s?.current_class ?? "",
        signals,
      }
    })

  const convivenciaData: ConvivenciaData = {
    totalResponses: responses.length,
    flagged,
    categories,
  }

  await logAudit(profile.id, profile.center_id, "view_convivencia_dashboard", "process", {
    processId: id,
    metadata: { flagged_count: flagged.length },
  })

  const hasData = codes.length > 0 && convivenciaData.totalResponses > 0

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/processes/${id}`}><ArrowLeft className="w-4 h-4" /></Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">Informe de Convivencia</h1>
            <Badge variant="outline" className="text-red-700 border-red-300 text-xs">Muy sensible</Badge>
          </div>
          <p className="text-muted-foreground text-sm">{process.name} · Curso {process.school_year}</p>
        </div>
        {hasData && (
          <Button variant="outline" size="sm" asChild>
            <a href={`/api/processes/${id}/sociogram/export/pdf/convivencia`} target="_blank" rel="noreferrer">
              <Download className="w-4 h-4 mr-1.5" />
              Exportar PDF
            </a>
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground mb-8 ml-12">
        Acceso restringido a orientación y dirección. Toda consulta queda registrada en el registro de auditoría.
      </p>

      {!hasData && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-8 text-center">
            <ShieldAlert className="w-10 h-10 text-amber-500 mx-auto mb-3" />
            <p className="font-semibold text-amber-900">Sin datos de convivencia</p>
            <p className="text-sm text-amber-700 mt-1">
              {codes.length === 0
                ? "El cuestionario de este proceso no tiene activadas preguntas de convivencia/acoso."
                : "Aún no hay respuestas al módulo de convivencia."}
            </p>
            <Button variant="outline" size="sm" className="mt-4" asChild>
              <Link href={`/processes/${id}/questionnaire`}>Configurar cuestionario</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {hasData && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="py-4 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                <div>
                  <p className="text-2xl font-bold text-red-700">{flagged.length}</p>
                  <p className="text-xs text-muted-foreground">Alumnos con señales (≥{FLAG_THRESHOLD})</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 flex items-center gap-3">
                <Users className="w-5 h-5 text-amber-500 shrink-0" />
                <div>
                  <p className="text-2xl font-bold">{convivenciaData.totalResponses}</p>
                  <p className="text-xs text-muted-foreground">Respuestas recogidas</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 flex items-center gap-3">
                <ShieldAlert className="w-5 h-5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-2xl font-bold">{convivenciaData.categories.length}</p>
                  <p className="text-xs text-muted-foreground">Categorías analizadas</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Flagged students */}
          {flagged.length > 0 && (
            <Card className="border-red-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  Alumnos con señales de riesgo
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Alumnos mencionados en ≥{FLAG_THRESHOLD} respuestas del módulo de convivencia. Requieren atención prioritaria.
                  Esta información NO debe compartirse con alumnos ni familia sin evaluación profesional previa.
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {flagged.map((s) => (
                    <div key={s.student_id} className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-100">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                          <AlertTriangle className="w-4 h-4 text-red-600" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{s.name}</p>
                          <p className="text-xs text-muted-foreground">{s.current_class}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-red-700 border-red-300 font-bold">
                          {s.signals} señales
                        </Badge>
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/processes/${id}/students/${s.student_id}/intervention`}>
                            Ver ficha
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {flagged.length === 0 && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="py-6 text-center">
                <p className="font-semibold text-green-800">Sin alumnos con señales de riesgo detectadas</p>
                <p className="text-sm text-green-700 mt-1">
                  Ningún alumno supera el umbral de {FLAG_THRESHOLD} menciones en las respuestas de convivencia.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Category breakdown */}
          <div className="space-y-4">
            <h2 className="font-semibold text-base">Desglose por categoría</h2>
            {convivenciaData.categories.filter(c => c.total > 0).map((cat) => (
              <Card key={cat.code}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span>{cat.label}</span>
                    <Badge variant="secondary">{cat.total} respuestas</Badge>
                  </CardTitle>
                </CardHeader>
                {cat.topMentions.length > 0 && (
                  <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground mb-2">Alumnos más mencionados en esta categoría:</p>
                    <div className="space-y-1.5">
                      {cat.topMentions.map((m, i) => {
                        const studentId = studentIdByName.get(m.name)
                        return (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}.</span>
                              {studentId ? (
                                <Link
                                  href={`/processes/${id}/students/${studentId}/intervention`}
                                  className="hover:underline font-medium"
                                >
                                  {m.name}
                                </Link>
                              ) : (
                                <span className="font-medium">{m.name}</span>
                              )}
                              <span className="text-xs text-muted-foreground">{m.current_class}</span>
                            </div>
                            <span className="text-xs font-semibold text-muted-foreground">{m.count}×</span>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
            {convivenciaData.categories.every(c => c.total === 0) && (
              <p className="text-sm text-muted-foreground">Sin respuestas en ninguna categoría todavía.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
