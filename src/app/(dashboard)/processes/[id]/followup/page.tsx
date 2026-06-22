"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft, RefreshCw, Loader2, CheckCircle2,
  ArrowRight, Users, Network, ClipboardList,
  TrendingUp, TrendingDown, Minus, UserCheck, UserX,
} from "lucide-react"

interface FollowupProcess {
  id: string
  name: string
  school_year: string
  status: string
  created_at: string
}

interface StudentDelta {
  student_id: string
  name: string
  current_class_before: string
  current_class_after: string
  received_before: number
  received_after: number
  reciprocal_before: number
  reciprocal_after: number
  status_before: string
  status_after: string
  was_isolated: boolean
  is_isolated_now: boolean
  recovered: boolean
  delta_received: number
  delta_reciprocal: number
}

interface CompareSummary {
  matched_students: number
  isolated_before: number
  isolated_after: number
  recovered_count: number
  avg_received_before: number
  avg_received_after: number
  total_alerts_before: number
  total_alerts_after: number
}

interface CompareData {
  parent: { id: string; name: string; school_year: string }
  followup: { id: string; name: string; school_year: string }
  summary: CompareSummary
  students: StudentDelta[]
}

const STATUS_ES: Record<string, string> = {
  popular: "Popular",
  rechazado: "Rechazado",
  ignorado: "Ignorado",
  controvertido: "Controvertido",
  promedio: "Promedio",
}

const STATUS_COLORS: Record<string, string> = {
  popular: "bg-green-100 text-green-700",
  rechazado: "bg-red-100 text-red-700",
  ignorado: "bg-gray-100 text-gray-600",
  controvertido: "bg-amber-100 text-amber-700",
  promedio: "bg-blue-100 text-blue-700",
}

const STATUS_LABEL: Record<string, string> = {
  borrador: "Borrador",
  cuestionario_abierto: "Cuestionario abierto",
  cuestionario_cerrado: "Cuestionario cerrado",
  en_analisis: "En análisis",
  propuestas_generadas: "Propuestas generadas",
  propuesta_seleccionada: "Completado",
  cerrado: "Cerrado",
}

function DeltaBadge({ delta }: { delta: number }) {
  if (delta > 0) return <span className="text-green-600 text-xs font-semibold flex items-center gap-0.5"><TrendingUp className="w-3 h-3" />+{delta}</span>
  if (delta < 0) return <span className="text-red-500 text-xs font-semibold flex items-center gap-0.5"><TrendingDown className="w-3 h-3" />{delta}</span>
  return <span className="text-gray-400 text-xs flex items-center gap-0.5"><Minus className="w-3 h-3" />0</span>
}

export default function FollowupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [followups, setFollowups] = useState<FollowupProcess[]>([])
  const [loadingFollowups, setLoadingFollowups] = useState(true)
  const [processName, setProcessName] = useState("")
  const [selectedFollowup, setSelectedFollowup] = useState<string | null>(null)
  const [compareData, setCompareData] = useState<CompareData | null>(null)
  const [loadingCompare, setLoadingCompare] = useState(false)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    fetch(`/api/processes/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setProcessName(d.name ?? "") })
    fetch(`/api/processes?parent_id=${id}`)
      .then(r => r.ok ? r.json() : { processes: [] })
      .then(d => {
        const fups: FollowupProcess[] = d.processes?.filter((p: FollowupProcess & { process_type?: string }) => p.process_type === "followup") ?? []
        setFollowups(fups)
        if (fups.length > 0) setSelectedFollowup(fups[0].id)
      })
      .finally(() => setLoadingFollowups(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    if (!selectedFollowup) return
    setLoadingCompare(true)
    fetch(`/api/processes/${id}/followup/compare?followup_id=${selectedFollowup}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setCompareData(d))
      .catch(() => setCompareData(null))
      .finally(() => setLoadingCompare(false))
  }, [id, selectedFollowup])

  async function handleCreate() {
    setLoading(true)
    try {
      const res = await fetch(`/api/processes/${id}/followup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? "Error al crear el seguimiento")
        return
      }
      toast.success("Proceso de seguimiento creado")
      router.push(`/processes/${json.id}`)
    } finally {
      setLoading(false)
    }
  }

  const visibleStudents = compareData
    ? (showAll ? compareData.students : compareData.students.filter(s => s.delta_received !== 0 || s.delta_reciprocal !== 0 || s.recovered || s.is_isolated_now))
    : []

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/processes/${id}`}><ArrowLeft className="w-4 h-4" /></Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold">Seguimiento post-mezcla</h1>
          {processName && <p className="text-muted-foreground text-sm">{processName}</p>}
        </div>
      </div>

      {/* Existing followups */}
      {loadingFollowups ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : followups.length > 0 ? (
        <div className="mb-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold mb-3">Procesos de seguimiento</h2>
            <div className="space-y-2">
              {followups.map(f => (
                <Card
                  key={f.id}
                  className={`border-green-200 cursor-pointer transition-colors ${selectedFollowup === f.id ? "bg-green-50 ring-1 ring-green-400" : "hover:bg-muted/30"}`}
                  onClick={() => setSelectedFollowup(f.id)}
                >
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{f.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {f.school_year} · {STATUS_LABEL[f.status] ?? f.status}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs text-green-700 border-green-300">
                          Seguimiento
                        </Badge>
                        <Button size="sm" variant="outline" asChild onClick={e => e.stopPropagation()}>
                          <Link href={`/processes/${f.id}`}>
                            Ver <ArrowRight className="w-3 h-3 ml-1" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Comparison panel */}
          {selectedFollowup && (
            <div>
              <h2 className="text-base font-semibold mb-3">Evolución social</h2>
              {loadingCompare ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : !compareData ? (
                <Card className="border-amber-200 bg-amber-50">
                  <CardContent className="py-5 text-center text-sm text-amber-700">
                    No hay suficientes datos para comparar. Asegúrate de que el proceso de seguimiento tiene respuestas al cuestionario.
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {/* Summary metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Card>
                      <CardContent className="py-3 px-4">
                        <p className="text-xs text-muted-foreground">Alumnos aislados</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xl font-bold text-red-600">{compareData.summary.isolated_before}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className={`text-xl font-bold ${compareData.summary.isolated_after < compareData.summary.isolated_before ? "text-green-600" : compareData.summary.isolated_after > compareData.summary.isolated_before ? "text-red-600" : "text-gray-700"}`}>
                            {compareData.summary.isolated_after}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">antes → después</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="py-3 px-4">
                        <p className="text-xs text-muted-foreground">Recuperados</p>
                        <div className="flex items-center gap-2 mt-1">
                          <UserCheck className="w-4 h-4 text-green-500" />
                          <span className="text-xl font-bold text-green-600">{compareData.summary.recovered_count}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">dejaron de estar aislados</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="py-3 px-4">
                        <p className="text-xs text-muted-foreground">Media de elecciones recibidas</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xl font-bold">{compareData.summary.avg_received_before}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className={`text-xl font-bold ${compareData.summary.avg_received_after > compareData.summary.avg_received_before ? "text-green-600" : "text-red-500"}`}>
                            {compareData.summary.avg_received_after}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">por alumno</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="py-3 px-4">
                        <p className="text-xs text-muted-foreground">Alertas sociométricas</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xl font-bold text-amber-600">{compareData.summary.total_alerts_before}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className={`text-xl font-bold ${compareData.summary.total_alerts_after < compareData.summary.total_alerts_before ? "text-green-600" : "text-amber-600"}`}>
                            {compareData.summary.total_alerts_after}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">antes → después</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Student table */}
                  {visibleStudents.length > 0 ? (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Evolución por alumno</CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {showAll
                            ? `Mostrando ${compareData.students.length} alumnos.`
                            : `Mostrando ${visibleStudents.length} alumnos con cambios relevantes.`}
                        </p>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b text-xs text-muted-foreground">
                                <th className="text-left py-2 pr-4 font-medium">Alumno</th>
                                <th className="text-center py-2 px-2 font-medium">Estado CDC</th>
                                <th className="text-center py-2 px-2 font-medium">Elecciones</th>
                                <th className="text-center py-2 px-2 font-medium">Recíprocas</th>
                                <th className="text-center py-2 px-2 font-medium">Estado</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {visibleStudents.map(s => (
                                <tr key={s.student_id} className={s.recovered ? "bg-green-50" : s.is_isolated_now && !s.was_isolated ? "bg-red-50" : ""}>
                                  <td className="py-2.5 pr-4">
                                    <p className="font-medium">{s.name}</p>
                                    <p className="text-xs text-muted-foreground">{s.current_class_after || s.current_class_before}</p>
                                  </td>
                                  <td className="text-center py-2.5 px-2">
                                    <div className="flex flex-col items-center gap-1">
                                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_COLORS[s.status_before] ?? "bg-gray-100 text-gray-600"}`}>
                                        {STATUS_ES[s.status_before] ?? s.status_before}
                                      </span>
                                      <span className="text-muted-foreground text-xs">→</span>
                                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_COLORS[s.status_after] ?? "bg-gray-100 text-gray-600"}`}>
                                        {STATUS_ES[s.status_after] ?? s.status_after}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="text-center py-2.5 px-2">
                                    <div className="flex flex-col items-center gap-0.5 text-xs text-muted-foreground">
                                      <span>{s.received_before} → {s.received_after}</span>
                                      <DeltaBadge delta={s.delta_received} />
                                    </div>
                                  </td>
                                  <td className="text-center py-2.5 px-2">
                                    <div className="flex flex-col items-center gap-0.5 text-xs text-muted-foreground">
                                      <span>{s.reciprocal_before} → {s.reciprocal_after}</span>
                                      <DeltaBadge delta={s.delta_reciprocal} />
                                    </div>
                                  </td>
                                  <td className="text-center py-2.5 px-2">
                                    {s.recovered && (
                                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1 justify-center">
                                        <UserCheck className="w-3 h-3" /> Recuperado
                                      </span>
                                    )}
                                    {s.is_isolated_now && !s.was_isolated && (
                                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full flex items-center gap-1 justify-center">
                                        <UserX className="w-3 h-3" /> Nuevo aislamiento
                                      </span>
                                    )}
                                    {s.is_isolated_now && s.was_isolated && (
                                      <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">Sigue aislado</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {!showAll && compareData.students.length > visibleStudents.length && (
                          <button
                            onClick={() => setShowAll(true)}
                            className="mt-3 text-xs text-primary underline"
                          >
                            Ver todos los {compareData.students.length} alumnos
                          </button>
                        )}
                      </CardContent>
                    </Card>
                  ) : compareData.students.length > 0 ? (
                    <Card className="border-green-200 bg-green-50">
                      <CardContent className="py-5 text-center text-sm text-green-700">
                        Sin cambios destacados detectados entre el proceso original y el seguimiento.
                        <button onClick={() => setShowAll(true)} className="block mx-auto mt-2 text-xs underline text-green-600">
                          Ver todos los {compareData.students.length} alumnos
                        </button>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="border-amber-200 bg-amber-50">
                      <CardContent className="py-5 text-center text-sm text-amber-700">
                        No se encontraron alumnos coincidentes entre ambos procesos. Asegúrate de que los alumnos tienen el mismo ID externo en ambos.
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ) : null}

      {/* Explanation */}
      <Card className="mb-6 border-blue-200 bg-blue-50">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-start gap-3">
            <RefreshCw className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <p className="font-semibold text-sm text-blue-900">¿Qué es el seguimiento post-mezcla?</p>
              <p className="text-sm text-blue-800">
                Pasado un trimestre (o un curso completo), puedes lanzar un nuevo cuestionario sociométrico
                en las clases destino para comprobar cómo ha evolucionado la integración social.
              </p>
              <ul className="text-sm text-blue-700 space-y-1 mt-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  Compara el sociograma antes y después de la mezcla
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  Detecta si los alumnos aislados han encontrado vínculos
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  Valida si las reglas docentes aplicadas fueron efectivas
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  Genera un informe de evolución social para orientación
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {followups.length === 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Cómo funciona</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {[
                { n: 1, icon: Network, title: "Se crea un proceso nuevo", desc: "Vinculado a este proceso original. Usa las clases destino como grupos de origen." },
                { n: 2, icon: ClipboardList, title: "Lanzas el cuestionario en las nuevas clases", desc: "El alumnado ahora está mezclado. El cuestionario recoge sus nuevas relaciones." },
                { n: 3, icon: Users, title: "Comparas los sociogramas", desc: "ClassMixer te muestra la evolución: alumnos que encontraron vínculos, nuevas relaciones recíprocas, cambios en el estatus CDC." },
              ].map(step => (
                <div key={step.n} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                    {step.n}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{step.title}</p>
                    <p className="text-xs text-muted-foreground">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Button
        onClick={handleCreate}
        disabled={loading}
        className="w-full"
        size="lg"
        variant={followups.length > 0 ? "outline" : "default"}
      >
        {loading ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creando proceso de seguimiento...</>
        ) : (
          <><RefreshCw className="w-4 h-4 mr-2" /> {followups.length > 0 ? "Crear otro proceso de seguimiento" : "Crear proceso de seguimiento"}</>
        )}
      </Button>
      <p className="text-xs text-muted-foreground text-center mt-2">
        Se creará un nuevo proceso en estado Borrador vinculado a este. Podrás configurarlo y lanzarlo cuando estés listo.
      </p>
    </div>
  )
}
