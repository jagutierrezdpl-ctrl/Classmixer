"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  ArrowLeft, Loader2, Users, Heart, UserX, UserCheck,
  TrendingUp, TrendingDown, Minus,
} from "lucide-react"
import type { Proposal, ProposalMetric } from "@/types"

function buildMetricsMap(metrics: ProposalMetric[]): Record<string, Record<string, number>> {
  const result: Record<string, Record<string, number>> = {}
  for (const m of metrics ?? []) {
    if (m.target_class) {
      if (!result[m.target_class]) result[m.target_class] = {}
      result[m.target_class][m.metric_key] = m.metric_value
    }
  }
  return result
}

function ScoreCompareCell({ a, b, label, higherIsBetter = true }: {
  a: number; b: number; label: string; higherIsBetter?: boolean
}) {
  const diff = b - a
  const improved = higherIsBetter ? diff > 0.5 : diff < -0.5
  const worsened = higherIsBetter ? diff < -0.5 : diff > 0.5
  const icon = improved
    ? <TrendingUp className="w-3 h-3 text-green-600" />
    : worsened
    ? <TrendingDown className="w-3 h-3 text-red-500" />
    : <Minus className="w-3 h-3 text-gray-400" />

  return (
    <tr className="border-b hover:bg-muted/10">
      <td className="px-4 py-2 text-sm text-muted-foreground w-48">{label}</td>
      <td className="px-4 py-2 text-center font-semibold text-sm">
        <span className={a >= b ? (higherIsBetter ? "text-green-600" : "text-red-500") : ""}>
          {a.toFixed(1)}
        </span>
      </td>
      <td className="px-4 py-2 text-center">
        <div className="flex items-center justify-center">{icon}</div>
      </td>
      <td className="px-4 py-2 text-center font-semibold text-sm">
        <span className={b >= a ? (higherIsBetter ? "text-green-600" : "text-red-500") : ""}>
          {b.toFixed(1)}
        </span>
      </td>
    </tr>
  )
}

function ClassColumn({ className, metrics, assignments, label }: {
  className: string
  metrics: Record<string, number>
  assignments: { student?: { first_name: string; last_name: string; current_class: string } | null }[]
  label: "A" | "B"
}) {
  const cnt = metrics.count ?? assignments.length
  const withFriend = metrics.students_with_friend ?? 0
  const isolated = cnt - withFriend
  const health = cnt > 0 && isolated === 0 ? "green" : isolated <= 1 ? "amber" : "red"
  const healthColor = health === "green" ? "border-green-300 bg-green-50" : health === "amber" ? "border-amber-300 bg-amber-50" : "border-red-300 bg-red-50"
  const dotColor = health === "green" ? "bg-green-500" : health === "amber" ? "bg-amber-500" : "bg-red-500"

  return (
    <div className={`rounded-xl border-2 p-3 ${healthColor}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${dotColor}`} />
          <span className="font-semibold text-sm">{className}</span>
          <Badge variant="outline" className="text-xs px-1">{label}</Badge>
        </div>
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Users className="w-3 h-3" /> {cnt}
        </span>
      </div>
      <div className="flex flex-wrap gap-1 text-xs mb-2">
        {metrics.average_grade != null && metrics.average_grade > 0 && (
          <span className="bg-white/60 rounded px-1.5 py-0.5">
            Nota: <strong>{metrics.average_grade.toFixed(1)}</strong>
          </span>
        )}
        {metrics.female != null && metrics.male != null && (
          <span className="bg-white/60 rounded px-1.5 py-0.5">
            {metrics.female}F/{metrics.male}M
          </span>
        )}
        {withFriend > 0 && (
          <span className="bg-white/60 rounded px-1.5 py-0.5 flex items-center gap-0.5">
            <Heart className="w-2.5 h-2.5 text-pink-500" />
            {withFriend}/{cnt}
          </span>
        )}
      </div>
      {isolated > 0 && (
        <div className="flex items-center gap-1 text-xs text-red-600 font-medium mb-2">
          <UserX className="w-3 h-3" /> {isolated} sin amigo
        </div>
      )}
      <div className="space-y-0.5 max-h-48 overflow-y-auto">
        {assignments.map((a, i) => a.student && (
          <div key={i} className="text-xs text-gray-700 flex items-center justify-between">
            <span>{a.student.first_name} {a.student.last_name}</span>
            <span className="text-gray-400 text-[10px]">{a.student.current_class}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ComparePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)
  const [leftId, setLeftId] = useState<string>("")
  const [rightId, setRightId] = useState<string>("")

  useEffect(() => {
    fetch(`/api/processes/${id}/proposals`)
      .then(r => r.ok ? r.json() : [])
      .then((data: Proposal[]) => {
        setProposals(data)
        if (data.length >= 1) setLeftId(data[0].id)
        if (data.length >= 2) setRightId(data[1].id)
        setLoading(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const left = proposals.find(p => p.id === leftId)
  const right = proposals.find(p => p.id === rightId)

  const leftMetrics = left ? buildMetricsMap(left.metrics ?? []) : {}
  const rightMetrics = right ? buildMetricsMap(right.metrics ?? []) : {}

  const allClasses = Array.from(
    new Set([...Object.keys(leftMetrics), ...Object.keys(rightMetrics)])
  ).sort()

  const leftTotal = left ? Object.values(leftMetrics).reduce((s, m) => s + (m.students_with_friend ?? 0), 0) : 0
  const leftCount = left ? Object.values(leftMetrics).reduce((s, m) => s + (m.count ?? 0), 0) : 0
  const rightTotal = right ? Object.values(rightMetrics).reduce((s, m) => s + (m.students_with_friend ?? 0), 0) : 0
  const rightCount = right ? Object.values(rightMetrics).reduce((s, m) => s + (m.count ?? 0), 0) : 0

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/processes/${id}/proposals`}><ArrowLeft className="w-4 h-4" /></Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold">Comparador de propuestas</h1>
          <p className="text-muted-foreground text-sm">Vista lado a lado — compara distribuciones clase a clase</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : proposals.length < 2 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="font-medium mb-1">Se necesitan al menos 2 propuestas para comparar</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href={`/processes/${id}/algorithm`}>Generar propuestas</Link>
          </Button>
        </div>
      ) : (
        <>
          {/* Selectors */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground mb-1 font-medium">Propuesta izquierda</p>
              <Select value={leftId} onValueChange={setLeftId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {proposals.map((p, i) => (
                    <SelectItem key={p.id} value={p.id} disabled={p.id === rightId}>
                      {p.name} — {p.score_total.toFixed(1)} pts
                      {p.status === "aprobada" ? " ✓ Aprobada" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="mt-5 text-muted-foreground font-bold text-sm">VS</div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground mb-1 font-medium">Propuesta derecha</p>
              <Select value={rightId} onValueChange={setRightId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {proposals.map((p, i) => (
                    <SelectItem key={p.id} value={p.id} disabled={p.id === leftId}>
                      {p.name} — {p.score_total.toFixed(1)} pts
                      {p.status === "aprobada" ? " ✓ Aprobada" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {left && right && (
            <>
              {/* Summary comparison table */}
              <Card className="mb-6">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Métricas globales</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground">
                        <th className="px-4 py-2 text-left">Métrica</th>
                        <th className="px-4 py-2 text-center">{left.name}</th>
                        <th className="px-4 py-2 text-center w-8"></th>
                        <th className="px-4 py-2 text-center">{right.name}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <ScoreCompareCell a={left.score_total} b={right.score_total} label="Puntuación total" />
                      <ScoreCompareCell a={left.score_social} b={right.score_social} label="Social" />
                      <ScoreCompareCell a={left.score_academic} b={right.score_academic} label="Académico" />
                      <ScoreCompareCell a={left.score_gender} b={right.score_gender} label="Equilibrio de género" />
                      <ScoreCompareCell a={left.score_behavior} b={right.score_behavior} label="Convivencia" />
                      <tr className="border-b hover:bg-muted/10">
                        <td className="px-4 py-2 text-sm text-muted-foreground">Alumnos con amigo</td>
                        <td className="px-4 py-2 text-center font-semibold text-sm">
                          <span className={leftTotal >= rightTotal ? "text-green-600" : ""}>
                            {leftCount > 0 ? `${Math.round(leftTotal / leftCount * 100)}%` : "—"}
                          </span>
                          <span className="text-xs text-muted-foreground ml-1">({leftTotal}/{leftCount})</span>
                        </td>
                        <td className="px-4 py-2 text-center">
                          {leftTotal > rightTotal
                            ? <TrendingDown className="w-3 h-3 text-red-500 mx-auto" />
                            : leftTotal < rightTotal
                            ? <TrendingUp className="w-3 h-3 text-green-600 mx-auto" />
                            : <Minus className="w-3 h-3 text-gray-400 mx-auto" />}
                        </td>
                        <td className="px-4 py-2 text-center font-semibold text-sm">
                          <span className={rightTotal >= leftTotal ? "text-green-600" : ""}>
                            {rightCount > 0 ? `${Math.round(rightTotal / rightCount * 100)}%` : "—"}
                          </span>
                          <span className="text-xs text-muted-foreground ml-1">({rightTotal}/{rightCount})</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              {/* Side-by-side class columns */}
              <div className="space-y-4">
                {allClasses.map(cls => {
                  const lm = leftMetrics[cls] ?? {}
                  const rm = rightMetrics[cls] ?? {}
                  const lAssign = (left.assignments ?? []).filter(a => a.target_class === cls)
                    .sort((a, b) => (a.student?.last_name ?? "").localeCompare(b.student?.last_name ?? ""))
                  const rAssign = (right.assignments ?? []).filter(a => a.target_class === cls)
                    .sort((a, b) => (a.student?.last_name ?? "").localeCompare(b.student?.last_name ?? ""))

                  // Find students that differ between proposals
                  const lIds = new Set(lAssign.map(a => a.student_id))
                  const rIds = new Set(rAssign.map(a => a.student_id))
                  const onlyInLeft = lAssign.filter(a => !rIds.has(a.student_id))
                  const onlyInRight = rAssign.filter(a => !lIds.has(a.student_id))

                  return (
                    <div key={cls}>
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-sm">Clase {cls}</h3>
                        {(onlyInLeft.length > 0 || onlyInRight.length > 0) && (
                          <Badge variant="outline" className="text-xs text-amber-700 border-amber-300">
                            {onlyInLeft.length + onlyInRight.length} diferencias
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <ClassColumn
                          className={cls}
                          metrics={lm}
                          assignments={lAssign}
                          label="A"
                        />
                        <ClassColumn
                          className={cls}
                          metrics={rm}
                          assignments={rAssign}
                          label="B"
                        />
                      </div>
                      {(onlyInLeft.length > 0 || onlyInRight.length > 0) && (
                        <div className="mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                          <strong>Diferencias en {cls}:</strong>{" "}
                          {onlyInLeft.length > 0 && (
                            <span>Solo en {left.name}: {onlyInLeft.map(a => a.student ? `${a.student.first_name} ${a.student.last_name}` : "—").join(", ")}. </span>
                          )}
                          {onlyInRight.length > 0 && (
                            <span>Solo en {right.name}: {onlyInRight.map(a => a.student ? `${a.student.first_name} ${a.student.last_name}` : "—").join(", ")}.</span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Quick verdict */}
              <Card className="mt-6 bg-muted/30">
                <CardContent className="py-4 px-5">
                  <p className="text-sm font-medium text-gray-800 mb-1">Resumen comparativo</p>
                  <p className="text-sm text-muted-foreground">
                    {left.score_total > right.score_total
                      ? `${left.name} tiene mayor puntuación global (${left.score_total.toFixed(1)} vs ${right.score_total.toFixed(1)}).`
                      : right.score_total > left.score_total
                      ? `${right.name} tiene mayor puntuación global (${right.score_total.toFixed(1)} vs ${left.score_total.toFixed(1)}).`
                      : "Ambas propuestas tienen la misma puntuación global."}{" "}
                    {leftTotal > rightTotal
                      ? `${left.name} conserva más vínculos sociales (${leftTotal} vs ${rightTotal} alumnos con amigo).`
                      : rightTotal > leftTotal
                      ? `${right.name} conserva más vínculos sociales (${rightTotal} vs ${leftTotal} alumnos con amigo).`
                      : "Ambas conservan el mismo número de vínculos sociales."}
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  )
}
