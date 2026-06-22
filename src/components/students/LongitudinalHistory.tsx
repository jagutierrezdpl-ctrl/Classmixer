"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2 } from "lucide-react"
import type { LongitudinalPoint } from "@/app/api/history/student/[profileId]/route"

const STATUS_COLORS: Record<string, string> = {
  popular:       "bg-green-100 text-green-800 border-green-200",
  promedio:      "bg-gray-100 text-gray-700 border-gray-200",
  ignorado:      "bg-blue-100 text-blue-700 border-blue-200",
  vulnerable:    "bg-yellow-100 text-yellow-700 border-yellow-200",
  rechazado:     "bg-red-100 text-red-800 border-red-200",
  controvertido: "bg-purple-100 text-purple-700 border-purple-200",
}

const STATUS_LABELS: Record<string, string> = {
  popular:       "Popular",
  promedio:      "Promedio",
  ignorado:      "Ignorado",
  vulnerable:    "Vulnerable",
  rechazado:     "Rechazado",
  controvertido: "Controvertido",
}

function MetricBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function TrendIcon({ prev, curr }: { prev: number | null; curr: number | null }) {
  if (prev === null || curr === null) return <Minus className="w-3 h-3 text-gray-400" />
  if (curr > prev) return <TrendingUp className="w-3 h-3 text-green-500" />
  if (curr < prev) return <TrendingDown className="w-3 h-3 text-red-500" />
  return <Minus className="w-3 h-3 text-gray-400" />
}

export function LongitudinalHistory({ profileId }: { profileId: string }) {
  const [data, setData] = useState<{ points: LongitudinalPoint[] } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/history/student/${profileId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d) })
      .finally(() => setLoading(false))
  }, [profileId])

  if (loading) return (
    <div className="flex justify-center py-8">
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
    </div>
  )

  if (!data?.points.length) return (
    <div className="text-center py-8 text-muted-foreground text-sm">
      Sin historial sociométrico anterior. El alumno aparecerá aquí cuando esté vinculado a más de un proceso.
    </div>
  )

  const points = data.points
  const maxReceived = Math.max(...points.map(p => p.received_count), 1)

  // Detect chronic isolation (2+ consecutive isolated/vulnerable entries)
  const chronicRisk = points.length >= 2 &&
    points.slice(-2).every(p => p.is_isolated || p.is_vulnerable || p.sociometric_status === "rechazado")

  return (
    <div className="space-y-4">
      {chronicRisk && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Alerta: el alumno muestra dinámicas de exclusión en varios cursos consecutivos.</span>
        </div>
      )}

      {/* Timeline */}
      <div className="relative">
        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200" />
        <div className="space-y-4">
          {points.map((point, i) => {
            const prev = i > 0 ? points[i - 1] : null
            const statusColor = point.sociometric_status
              ? (STATUS_COLORS[point.sociometric_status] ?? STATUS_COLORS.promedio)
              : (point.is_isolated ? STATUS_COLORS.ignorado : point.is_vulnerable ? STATUS_COLORS.vulnerable : STATUS_COLORS.promedio)
            const statusLabel = point.sociometric_status
              ? (STATUS_LABELS[point.sociometric_status] ?? "Promedio")
              : (point.is_isolated ? "Aislado" : point.is_vulnerable ? "Vulnerable" : "—")

            return (
              <div key={point.process_id} className="relative flex gap-4">
                <div className={`w-10 h-10 rounded-full flex-none flex items-center justify-center z-10 border-2 ${
                  point.is_isolated || point.sociometric_status === "rechazado"
                    ? "bg-red-100 border-red-300"
                    : point.sociometric_status === "popular"
                    ? "bg-green-100 border-green-300"
                    : "bg-white border-gray-300"
                }`}>
                  {point.is_isolated || point.sociometric_status === "rechazado"
                    ? <AlertTriangle className="w-4 h-4 text-red-500" />
                    : point.sociometric_status === "popular"
                    ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                    : <span className="text-xs font-bold text-gray-500">{i + 1}</span>
                  }
                </div>
                <Card className="flex-1">
                  <CardContent className="pt-3 pb-3">
                    <div className="flex items-start justify-between gap-2 flex-wrap mb-2">
                      <div>
                        <p className="font-semibold text-sm">{point.process_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {point.school_year} · {point.current_class ?? "—"}
                        </p>
                      </div>
                      <Badge className={`text-xs border ${statusColor}`} variant="outline">
                        {statusLabel}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                      <div>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-muted-foreground">Elecciones recibidas</span>
                          <span className="font-semibold flex items-center gap-1">
                            <TrendIcon prev={prev?.received_count ?? null} curr={point.received_count} />
                            {point.received_count}
                          </span>
                        </div>
                        <MetricBar value={point.received_count} max={maxReceived} color="bg-blue-400" />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-muted-foreground">Recíprocas</span>
                          <span className="font-semibold flex items-center gap-1">
                            <TrendIcon prev={prev?.reciprocal_count ?? null} curr={point.reciprocal_count} />
                            {point.reciprocal_count}
                          </span>
                        </div>
                        <MetricBar value={point.reciprocal_count} max={maxReceived} color="bg-green-400" />
                      </div>
                      {point.social_preference_z !== null && (
                        <div className="col-span-2 flex items-center gap-4 mt-1">
                          <span className="text-muted-foreground">zSP:</span>
                          <span className={`font-mono font-semibold ${(point.social_preference_z ?? 0) < -1 ? "text-red-600" : (point.social_preference_z ?? 0) > 1 ? "text-green-600" : "text-gray-700"}`}>
                            {point.social_preference_z?.toFixed(2) ?? "—"}
                          </span>
                          {point.social_impact_z !== null && <>
                            <span className="text-muted-foreground">zSI:</span>
                            <span className="font-mono font-semibold text-gray-700">{point.social_impact_z?.toFixed(2) ?? "—"}</span>
                          </>}
                          {point.rejection_received_count > 0 && (
                            <span className="text-red-600 font-semibold">{point.rejection_received_count} rechazos</span>
                          )}
                        </div>
                      )}
                      {point.average_grade && (
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">Nota:</span>
                          <span className="font-semibold">{point.average_grade.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
