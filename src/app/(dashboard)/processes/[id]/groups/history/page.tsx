"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowLeft, Loader2, Users2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface StudentRow {
  id: string
  first_name: string
  last_name: string
  current_class: string
  gender: string
  average_grade: number
  academic_level?: string
}

interface Pair {
  student_a: string
  student_b: string
  count: number
}

interface HistoryData {
  students: StudentRow[]
  pairs: Pair[]
  total_sessions: number
}

interface StudentStats {
  student: StudentRow
  participated: number     // groups participated in (= unique partners > 0 means they were assigned)
  unique_partners: number
  max_repetition: number
  top_partner: StudentRow | null
  partners: Array<{ student: StudentRow; count: number }>
}

function buildStats(data: HistoryData): StudentStats[] {
  const studentMap = new Map(data.students.map(s => [s.id, s]))

  // Per-student: map partner_id → count
  const partnerMap = new Map<string, Map<string, number>>()
  for (const s of data.students) partnerMap.set(s.id, new Map())

  for (const p of data.pairs) {
    partnerMap.get(p.student_a)?.set(p.student_b, p.count)
    partnerMap.get(p.student_b)?.set(p.student_a, p.count)
  }

  return data.students.map(student => {
    const partners = [...(partnerMap.get(student.id)?.entries() ?? [])]
      .map(([id, count]) => ({ student: studentMap.get(id)!, count }))
      .filter(p => p.student)
      .sort((a, b) => b.count - a.count)

    const maxRep = partners[0]?.count ?? 0

    return {
      student,
      participated: partners.length > 0 ? 1 : 0, // ≥1 partner means they participated
      unique_partners: partners.length,
      max_repetition: maxRep,
      top_partner: partners[0]?.student ?? null,
      partners,
    }
  }).sort((a, b) => b.max_repetition - a.max_repetition || b.unique_partners - a.unique_partners)
}

function RepBadge({ count, total }: { count: number; total: number }) {
  if (count <= 1) return <Badge variant="outline" className="text-xs text-green-700 border-green-200 bg-green-50">{count}×</Badge>
  if (total > 1 && count >= total) return <Badge variant="outline" className="text-xs text-red-700 border-red-200 bg-red-50">{count}×</Badge>
  return <Badge variant="outline" className="text-xs text-amber-700 border-amber-200 bg-amber-50">{count}×</Badge>
}

export default function HistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData] = useState<HistoryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState<string[]>([])
  const [selectedClass, setSelectedClass] = useState<string>("all")
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    async function loadClasses() {
      const res = await fetch(`/api/processes/${id}/students`)
      if (res.ok) {
        const students: { current_class: string }[] = await res.json()
        const unique = [...new Set(students.map(s => s.current_class))].sort()
        setClasses(unique)
        if (unique.length > 0) setSelectedClass(unique[0])
      }
    }
    loadClasses()
  }, [id])

  useEffect(() => {
    if (!selectedClass || selectedClass === "all") return
    load(selectedClass)
  }, [selectedClass]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load(cls: string) {
    setLoading(true)
    setExpanded(null)
    try {
      const res = await fetch(`/api/processes/${id}/groups/history?class_name=${encodeURIComponent(cls)}`)
      if (!res.ok) { toast.error("Error al cargar historial"); return }
      setData(await res.json())
    } catch {
      toast.error("Error inesperado")
    } finally {
      setLoading(false)
    }
  }

  const stats = data ? buildStats(data) : []
  const highRepStudents = stats.filter(s => data && s.max_repetition >= data.total_sessions && data.total_sessions > 1)

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between mb-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/processes/${id}/groups`}><ArrowLeft className="w-4 h-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Historial de rotación</h1>
            <p className="text-muted-foreground text-sm">
              Con quién ha coincidido cada alumno en grupos cooperativos
            </p>
          </div>
        </div>
        {classes.length > 1 && (
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {classes.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : !data || data.students.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Users2 className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="font-medium">Sin datos para esta clase</p>
            <p className="text-sm text-muted-foreground mt-1">
              Genera grupos cooperativos para ver el historial de rotación
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Summary */}
          <div className="flex flex-wrap gap-4">
            <div className="rounded-lg border px-4 py-3 bg-card">
              <p className="text-xs text-muted-foreground">Sesiones analizadas</p>
              <p className="text-2xl font-bold">{data.total_sessions}</p>
            </div>
            <div className="rounded-lg border px-4 py-3 bg-card">
              <p className="text-xs text-muted-foreground">Alumnos en clase</p>
              <p className="text-2xl font-bold">{data.students.length}</p>
            </div>
            <div className="rounded-lg border px-4 py-3 bg-card">
              <p className="text-xs text-muted-foreground">Pares únicos</p>
              <p className="text-2xl font-bold">{data.pairs.length}</p>
            </div>
            {highRepStudents.length > 0 && (
              <div className="rounded-lg border border-amber-200 px-4 py-3 bg-amber-50">
                <p className="text-xs text-amber-700">Alumnos siempre juntos</p>
                <p className="text-2xl font-bold text-amber-800">{highRepStudents.length}</p>
              </div>
            )}
          </div>

          {/* Alert for always-together pairs */}
          {highRepStudents.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <strong>{highRepStudents.length} alumno{highRepStudents.length !== 1 ? "s" : ""}</strong> ha{highRepStudents.length !== 1 ? "n" : ""} coincidido con el mismo compañero en todas las sesiones.
                Considera separarlos en la próxima generación.
              </span>
            </div>
          )}

          {/* Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Detalle por alumno — {selectedClass}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Alumno</th>
                      <th className="text-center px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Compañeros únicos</th>
                      <th className="text-center px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Máx. repetición</th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Más frecuente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.map(stat => (
                      <>
                        <tr
                          key={stat.student.id}
                          className={`border-b hover:bg-muted/20 cursor-pointer transition-colors ${
                            expanded === stat.student.id ? "bg-muted/10" : ""
                          }`}
                          onClick={() => setExpanded(expanded === stat.student.id ? null : stat.student.id)}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div>
                                <p className="font-medium">
                                  {stat.student.first_name} {stat.student.last_name}
                                </p>
                                <p className="text-xs text-muted-foreground">{stat.student.gender}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className="font-medium">{stat.unique_partners}</span>
                            <span className="text-muted-foreground text-xs"> / {data.students.length - 1}</span>
                          </td>
                          <td className="px-3 py-3 text-center">
                            {stat.max_repetition > 0 ? (
                              <RepBadge count={stat.max_repetition} total={data.total_sessions} />
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            {stat.top_partner ? (
                              <div className="flex items-center gap-2">
                                <span className="truncate">{stat.top_partner.first_name} {stat.top_partner.last_name}</span>
                                {stat.max_repetition > 1 && (
                                  <RepBadge count={stat.max_repetition} total={data.total_sessions} />
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Sin grupos todavía</span>
                            )}
                          </td>
                        </tr>
                        {expanded === stat.student.id && stat.partners.length > 0 && (
                          <tr key={`${stat.student.id}-expanded`} className="border-b bg-muted/5">
                            <td colSpan={4} className="px-6 py-3">
                              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                                Todos los compañeros de {stat.student.first_name}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {stat.partners.map(p => (
                                  <div
                                    key={p.student.id}
                                    className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                                      p.count >= data.total_sessions && data.total_sessions > 1
                                        ? "border-red-200 bg-red-50 text-red-700"
                                        : p.count > 1
                                        ? "border-amber-200 bg-amber-50 text-amber-700"
                                        : "border-gray-200 bg-gray-50 text-gray-700"
                                    }`}
                                  >
                                    <span>{p.student.first_name} {p.student.last_name}</span>
                                    <span className="font-semibold">{p.count}×</span>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full bg-green-100 border border-green-300" />
              1× — sin repetición
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full bg-amber-100 border border-amber-300" />
              2+ — coincidencia parcial
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full bg-red-100 border border-red-300" />
              Siempre juntos — máxima repetición
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
