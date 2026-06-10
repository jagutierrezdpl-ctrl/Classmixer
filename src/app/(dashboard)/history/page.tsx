"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, TrendingDown, TrendingUp, Users, BarChart3, Calendar } from "lucide-react"

interface ProcessHistory {
  id: string
  name: string
  school_year: string
  status: string
  created_at: string
  total_students: number
  total_responses: number
  tokens_total: number
  tokens_completed: number
  response_rate: number
  sociogram_total: number
  sociogram_isolated: number
  sociogram_vulnerable: number
  isolated_pct: number | null
  vulnerable_pct: number | null
}

const STATUS_LABELS: Record<string, string> = {
  borrador: "Borrador",
  cuestionario_abierto: "Cuestionario abierto",
  cuestionario_cerrado: "Cuestionario cerrado",
  en_analisis: "En análisis",
  propuestas_generadas: "Propuestas generadas",
  propuesta_seleccionada: "Propuesta seleccionada",
  cerrado: "Cerrado",
  archivado: "Archivado",
}

const STATUS_COLORS: Record<string, string> = {
  borrador: "bg-gray-100 text-gray-700",
  cuestionario_abierto: "bg-blue-100 text-blue-700",
  cuestionario_cerrado: "bg-yellow-100 text-yellow-700",
  en_analisis: "bg-purple-100 text-purple-700",
  propuestas_generadas: "bg-indigo-100 text-indigo-700",
  propuesta_seleccionada: "bg-teal-100 text-teal-700",
  cerrado: "bg-green-100 text-green-700",
  archivado: "bg-gray-100 text-gray-500",
}

function TrendBadge({ value, inverse = false }: { value: number | null; inverse?: boolean }) {
  if (value === null) return <span className="text-gray-400 text-xs">—</span>
  const isGood = inverse ? value <= 10 : value >= 70
  const isBad = inverse ? value >= 25 : value <= 30
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-semibold ${isGood ? "text-green-600" : isBad ? "text-red-600" : "text-yellow-600"}`}>
      {inverse ? (
        value <= 10 ? <TrendingDown className="w-3.5 h-3.5" /> : value >= 25 ? <TrendingUp className="w-3.5 h-3.5" /> : null
      ) : (
        value >= 70 ? <TrendingUp className="w-3.5 h-3.5" /> : value <= 30 ? <TrendingDown className="w-3.5 h-3.5" /> : null
      )}
      {value}%
    </span>
  )
}

export default function HistoryPage() {
  const [rows, setRows] = useState<ProcessHistory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/history")
      .then(r => r.json())
      .then(data => {
        setRows(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Group by school year
  const byYear: Record<string, ProcessHistory[]> = {}
  rows.forEach(r => {
    if (!byYear[r.school_year]) byYear[r.school_year] = []
    byYear[r.school_year].push(r)
  })
  const years = Object.keys(byYear).sort().reverse()

  // Summary cards for years with sociogram data
  const yearsWithData = rows.filter(r => r.sociogram_total > 0)

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-primary" />
          Histórico inter-anual
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Evolución de los indicadores sociales del centro por curso escolar
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando histórico...
        </div>
      )}

      {!loading && rows.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No hay procesos registrados todavía.</p>
          </CardContent>
        </Card>
      )}

      {/* Trend summary (if multiple years with data) */}
      {yearsWithData.length > 1 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Tendencia del centro</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Curso</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Procesos</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Alumnos</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Participación</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Aislamiento</th>
                    <th className="pb-2 font-medium text-muted-foreground">Vulnerabilidad</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(byYear).sort().reverse().map(year => {
                    const yearRows = byYear[year]
                    const totalStudents = yearRows.reduce((s, r) => s + r.total_students, 0)
                    const avgResponse = yearRows.length > 0
                      ? Math.round(yearRows.reduce((s, r) => s + r.response_rate, 0) / yearRows.length)
                      : 0
                    const smRows = yearRows.filter(r => r.sociogram_total > 0)
                    const avgIsolated = smRows.length > 0
                      ? Math.round(smRows.reduce((s, r) => s + (r.isolated_pct ?? 0), 0) / smRows.length)
                      : null
                    const avgVulnerable = smRows.length > 0
                      ? Math.round(smRows.reduce((s, r) => s + (r.vulnerable_pct ?? 0), 0) / smRows.length)
                      : null
                    return (
                      <tr key={year} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-mono text-xs font-semibold">{year}</td>
                        <td className="py-2 pr-4">{yearRows.length}</td>
                        <td className="py-2 pr-4">{totalStudents}</td>
                        <td className="py-2 pr-4"><TrendBadge value={avgResponse} /></td>
                        <td className="py-2 pr-4"><TrendBadge value={avgIsolated} inverse /></td>
                        <td className="py-2"><TrendBadge value={avgVulnerable} inverse /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-year detail */}
      {years.map(year => (
        <div key={year}>
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            Curso {year}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {byYear[year].map(p => (
              <Card key={p.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-sm font-semibold leading-tight">{p.name}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(p.created_at).toLocaleDateString("es-ES")}
                      </p>
                    </div>
                    <Badge className={`text-xs shrink-0 ${STATUS_COLORS[p.status] ?? "bg-gray-100"}`}>
                      {STATUS_LABELS[p.status] ?? p.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-muted/50 p-2">
                      <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                        <Users className="w-3 h-3" />
                        <span className="text-xs">Alumnos</span>
                      </div>
                      <div className="text-lg font-bold">{p.total_students}</div>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-2">
                      <div className="text-xs text-muted-foreground mb-1">Participación</div>
                      <TrendBadge value={p.tokens_total > 0 ? p.response_rate : null} />
                    </div>
                    <div className="rounded-lg bg-muted/50 p-2">
                      <div className="text-xs text-muted-foreground mb-1">Respuestas</div>
                      <div className="text-sm font-semibold">{p.total_responses}</div>
                    </div>
                  </div>

                  {p.sociogram_total > 0 && (
                    <div className="border-t pt-2 space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sociograma</p>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Aislados</span>
                        <span>
                          {p.sociogram_isolated} <span className="text-muted-foreground text-xs">({p.isolated_pct}%)</span>
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Vulnerables</span>
                        <span>
                          {p.sociogram_vulnerable} <span className="text-muted-foreground text-xs">({p.vulnerable_pct}%)</span>
                        </span>
                      </div>
                    </div>
                  )}

                  {p.sociogram_total === 0 && p.status !== "borrador" && (
                    <p className="text-xs text-muted-foreground text-center border-t pt-2">
                      Sin datos de sociograma calculados
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
