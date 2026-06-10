"use client"

import { use, useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft, Zap, Download, Users, Loader2,
  ChevronDown, ChevronUp, CheckCircle, Settings2,
  UserX, UserCheck, Heart, Pencil, FileText, Sparkles, X, Network, GraduationCap,
} from "lucide-react"
import Link from "next/link"
import type { Proposal, ProposalMetric } from "@/types"

function ScoreBar({ label, value, color = "bg-primary" }: { label: string; value: number; color?: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value.toFixed(1)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

function getScoreColor(score: number) {
  if (score >= 80) return "text-green-600"
  if (score >= 60) return "text-yellow-600"
  return "text-red-600"
}

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

const COMPARATOR_METRICS: { key: string; label: string; higherIsBetter?: boolean; format?: (v: number) => string }[] = [
  { key: "score_total", label: "Puntuación total", higherIsBetter: true },
  { key: "score_social", label: "Puntuación social", higherIsBetter: true },
  { key: "score_academic", label: "Puntuación académica", higherIsBetter: true },
  { key: "score_gender", label: "Equilibrio de género", higherIsBetter: true },
  { key: "score_behavior", label: "Convivencia", higherIsBetter: true },
]

export default function ProposalsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [aiSummaries, setAiSummaries] = useState<Record<string, string>>({})
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({})

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadProposals() }, [id])

  async function loadProposals() {
    setLoading(true)
    const res = await fetch(`/api/processes/${id}/proposals`)
    if (res.ok) setProposals(await res.json())
    setLoading(false)
  }

  async function handleExport(proposalId: string, proposalName: string) {
    const res = await fetch(`/api/proposals/${proposalId}/export`)
    if (!res.ok) { toast.error("Error al exportar"); return }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${proposalName.replace(/\s+/g, "_")}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Excel exportado")
  }

  async function handleApprove(proposalId: string) {
    if (!confirm("¿Aprobar esta propuesta como distribución final? Esta acción quedará registrada.")) return
    const res = await fetch(`/api/proposals/${proposalId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "aprobada" }),
    })
    if (res.ok) {
      toast.success("Propuesta aprobada")
      await loadProposals()
    } else {
      toast.error("Error al aprobar")
    }
  }

  async function handleAISummary(proposalId: string) {
    setAiLoading(prev => ({ ...prev, [proposalId]: true }))
    try {
      const res = await fetch(`/api/proposals/${proposalId}/explain`, { method: "POST" })
      const json = await res.json()
      setAiSummaries(prev => ({ ...prev, [proposalId]: res.ok ? json.summary : `Error: ${json.error}` }))
    } catch {
      setAiSummaries(prev => ({ ...prev, [proposalId]: "Error al conectar con la IA" }))
    } finally {
      setAiLoading(prev => ({ ...prev, [proposalId]: false }))
    }
  }

  // Build comparator data: score values per proposal
  const getProposalValue = (proposal: Proposal, key: string): number => {
    const direct = proposal[key as keyof Proposal]
    if (typeof direct === "number") return direct
    return 0
  }

  const getBest = (key: string): number => {
    return Math.max(...proposals.map(p => getProposalValue(p, key)))
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/processes/${id}`}><ArrowLeft className="w-4 h-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Propuestas de mezcla</h1>
            <p className="text-muted-foreground text-sm">{proposals.length} propuestas generadas</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/processes/${id}/algorithm`}>
              <Settings2 className="w-4 h-4" />
              Configurar algoritmo
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/processes/${id}/algorithm`}>
              <Zap className="w-4 h-4" />
              {proposals.length > 0 ? "Regenerar" : "Generar propuestas"}
            </Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : proposals.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Zap className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium mb-1">No hay propuestas todavía</p>
          <p className="text-sm mb-6">
            Importa alumnos, configura las reglas y luego ejecuta el algoritmo.
          </p>
          <Button asChild>
            <Link href={`/processes/${id}/algorithm`}>
              <Zap className="w-4 h-4" />
              Configurar y ejecutar algoritmo
            </Link>
          </Button>
        </div>
      ) : (
        <>
          {/* Comparator table */}
          {proposals.length > 1 && (
            <Card className="mb-6 overflow-x-auto">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Comparativa de propuestas</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left px-4 py-2 text-muted-foreground font-medium w-48">Métrica</th>
                      {proposals.map((p, i) => (
                        <th key={p.id} className="px-4 py-2 text-center font-semibold">
                          <span className={p.status === "aprobada" ? "text-green-600" : i === 0 ? "text-primary" : ""}>
                            {p.name}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARATOR_METRICS.map(metric => {
                      const best = getBest(metric.key)
                      return (
                        <tr key={metric.key} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="px-4 py-2 text-muted-foreground">{metric.label}</td>
                          {proposals.map(p => {
                            const val = getProposalValue(p, metric.key)
                            const isBest = val === best
                            return (
                              <td key={p.id} className="px-4 py-2 text-center">
                                <span className={`font-semibold ${isBest ? "text-green-600" : getScoreColor(val)}`}>
                                  {val.toFixed(1)}
                                  {isBest && " ★"}
                                </span>
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                    {/* Students with friend row — sum across classes */}
                    <tr className="border-b hover:bg-muted/20">
                      <td className="px-4 py-2 text-muted-foreground">Alumnos con amigo</td>
                      {proposals.map(p => {
                        const mm = buildMetricsMap(p.metrics ?? [])
                        const total = Object.values(mm).reduce((sum, cls) => sum + (cls.students_with_friend ?? 0), 0)
                        const grandTotal = Object.values(mm).reduce((sum, cls) => sum + (cls.count ?? 0), 0)
                        const pct = grandTotal > 0 ? Math.round((total / grandTotal) * 100) : 0
                        return (
                          <td key={p.id} className="px-4 py-2 text-center">
                            <span className="font-semibold">{pct}%</span>
                            <span className="text-muted-foreground text-xs ml-1">({total}/{grandTotal})</span>
                          </td>
                        )
                      })}
                    </tr>
                    <tr className="border-b hover:bg-muted/20">
                      <td className="px-4 py-2 text-muted-foreground">Pares recíprocos preservados</td>
                      {proposals.map(p => {
                        const mm = buildMetricsMap(p.metrics ?? [])
                        const total = Object.values(mm).reduce((sum, cls) => sum + (cls.reciprocal_preserved ?? 0), 0)
                        const best = Math.max(...proposals.map(pp => {
                          const m = buildMetricsMap(pp.metrics ?? [])
                          return Object.values(m).reduce((s, c) => s + (c.reciprocal_preserved ?? 0), 0)
                        }))
                        return (
                          <td key={p.id} className="px-4 py-2 text-center">
                            <span className={`font-semibold ${total === best ? "text-green-600" : ""}`}>{total}</span>
                          </td>
                        )
                      })}
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* Proposal cards */}
          <div className="space-y-4">
            {proposals.map((proposal, idx) => {
              const isExpanded = expandedId === proposal.id
              const isApproved = proposal.status === "aprobada"
              const metricsMap = buildMetricsMap(proposal.metrics ?? [])
              const classNames = Object.keys(metricsMap).sort()

              const totalStudents = classNames.reduce((sum, cls) => sum + (metricsMap[cls]?.count ?? 0), 0)
              const totalWithFriend = classNames.reduce((sum, cls) => sum + (metricsMap[cls]?.students_with_friend ?? 0), 0)
              const totalIsolated = totalStudents - totalWithFriend

              return (
                <Card key={proposal.id} className={isApproved ? "border-green-400" : idx === 0 ? "border-primary/40" : ""}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                          isApproved ? "bg-green-500" : idx === 0 ? "bg-primary" : "bg-muted-foreground"
                        }`}>
                          {String.fromCharCode(65 + idx)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-base">{proposal.name}</CardTitle>
                            {isApproved && (
                              <Badge variant="success" className="text-xs">
                                <CheckCircle className="w-3 h-3 mr-1" /> Aprobada
                              </Badge>
                            )}
                            {idx === 0 && !isApproved && (
                              <Badge variant="default" className="text-xs">Mejor puntuación</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className={`text-2xl font-bold ${getScoreColor(proposal.score_total)}`}>
                              {proposal.score_total.toFixed(1)}
                            </span>
                            <span className="text-muted-foreground text-sm">/100</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/processes/${id}/proposals/${proposal.id}/simulation`}>
                            <Network className="w-4 h-4" />
                            Simulación
                          </Link>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/processes/${id}/proposals/${proposal.id}/tutors`}>
                            <GraduationCap className="w-4 h-4" />
                            Tutores
                          </Link>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/processes/${id}/proposals/${proposal.id}/report`} target="_blank">
                            <FileText className="w-4 h-4" />
                            Informe
                          </Link>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/processes/${id}/proposals/${proposal.id}/edit`}>
                            <Pencil className="w-4 h-4" />
                            Editar
                          </Link>
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleExport(proposal.id, proposal.name)}>
                          <Download className="w-4 h-4" />
                          Excel
                        </Button>
                        {!isApproved && (
                          <Button size="sm" onClick={() => handleApprove(proposal.id)}>
                            <CheckCircle className="w-4 h-4" />
                            Aprobar
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAISummary(proposal.id)}
                          disabled={aiLoading[proposal.id]}
                          title="Análisis IA"
                        >
                          {aiLoading[proposal.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setExpandedId(isExpanded ? null : proposal.id)}
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0">
                    {/* AI Summary */}
                    {aiSummaries[proposal.id] && (
                      <div className="mb-4 rounded-lg bg-violet-50 border border-violet-200 p-3 text-sm text-violet-900">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2">
                            <Sparkles className="w-4 h-4 mt-0.5 shrink-0 text-violet-600" />
                            <div className="whitespace-pre-line leading-relaxed">{aiSummaries[proposal.id]}</div>
                          </div>
                          <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0"
                            onClick={() => setAiSummaries(prev => { const n = { ...prev }; delete n[proposal.id]; return n })}>
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                    {/* Score bars */}
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 mb-4">
                      <ScoreBar label="Social" value={proposal.score_social} color="bg-pink-400" />
                      <ScoreBar label="Académico" value={proposal.score_academic} color="bg-blue-400" />
                      <ScoreBar label="Género" value={proposal.score_gender} color="bg-purple-400" />
                      <ScoreBar label="Convivencia" value={proposal.score_behavior} color="bg-green-400" />
                    </div>

                    {/* Social summary chips */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {classNames.map(cls => (
                        <div key={cls} className="flex items-center gap-1.5 text-xs">
                          <Badge variant="outline">{cls}</Badge>
                          <span className="text-muted-foreground flex items-center gap-0.5">
                            <Users className="w-3 h-3" /> {metricsMap[cls]?.count ?? 0}
                          </span>
                        </div>
                      ))}
                      {totalStudents > 0 && (
                        <>
                          <div className="flex items-center gap-1 text-xs text-green-600">
                            <UserCheck className="w-3.5 h-3.5" />
                            {totalWithFriend} con amigo
                          </div>
                          {totalIsolated > 0 && (
                            <div className="flex items-center gap-1 text-xs text-red-500">
                              <UserX className="w-3.5 h-3.5" />
                              {totalIsolated} sin amigo
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t space-y-6">
                        {classNames.map(cls => {
                          const m = metricsMap[cls] ?? {}
                          const classStudents = (proposal.assignments ?? [])
                            .filter(a => a.target_class === cls)
                            .sort((a, b) => (a.student?.last_name ?? "").localeCompare(b.student?.last_name ?? ""))

                          return (
                            <div key={cls}>
                              <div className="flex items-center gap-3 mb-3">
                                <p className="font-semibold text-sm">{cls}</p>
                                <div className="flex gap-2 flex-wrap">
                                  {m.count > 0 && (
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                      <Users className="w-3 h-3" /> {m.count} alumnos
                                    </span>
                                  )}
                                  {m.average_grade > 0 && (
                                    <span className="text-xs text-muted-foreground">
                                      Nota media: <strong>{m.average_grade.toFixed(2)}</strong>
                                    </span>
                                  )}
                                  {m.female !== undefined && m.male !== undefined && (
                                    <span className="text-xs text-muted-foreground">
                                      {m.female}F / {m.male}M
                                    </span>
                                  )}
                                  {m.students_with_friend !== undefined && (
                                    <span className="text-xs text-green-600 flex items-center gap-0.5">
                                      <Heart className="w-3 h-3" />
                                      {m.students_with_friend}/{m.count} con amigo
                                    </span>
                                  )}
                                  {m.reciprocal_preserved !== undefined && m.reciprocal_preserved > 0 && (
                                    <span className="text-xs text-blue-600">
                                      {m.reciprocal_preserved} pares recíprocos
                                    </span>
                                  )}
                                  {m.with_behavior_issues > 0 && (
                                    <span className="text-xs text-orange-500">
                                      {m.with_behavior_issues} con seguimiento
                                    </span>
                                  )}
                                  {m.with_needs > 0 && (
                                    <span className="text-xs text-purple-500">
                                      {m.with_needs} con nec. educativas
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1">
                                {classStudents.map(a => (
                                  <div key={a.id} className="text-xs px-2 py-1 bg-muted/50 rounded">
                                    <span className="font-medium">{a.student?.first_name} {a.student?.last_name}</span>
                                    <span className="text-muted-foreground ml-1">({a.student?.current_class})</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
