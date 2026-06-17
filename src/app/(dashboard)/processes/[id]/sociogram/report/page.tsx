"use client"

import { use, useEffect, useState } from "react"
import { ArrowLeft, Printer, Loader2, AlertTriangle, Users, TrendingUp, Shield, Network } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import type { SociogramData, SociogramNode } from "@/types"

// ── Text helpers ──────────────────────────────────────────────────────────────

function densityLabel(d: number) {
  if (d >= 0.3) return { text: "Alta", color: "text-green-700" }
  if (d >= 0.15) return { text: "Media", color: "text-amber-600" }
  return { text: "Baja", color: "text-red-600" }
}

// Thresholds for IAg (group_cohesion = reciprocal pairs / possible pairs)
function cohesionLabel(c: number) {
  if (c >= 0.15) return { text: "Alta", color: "text-green-700" }
  if (c >= 0.08) return { text: "Media", color: "text-amber-600" }
  return { text: "Baja", color: "text-red-600" }
}

function riskLevel(m: SociogramData["metrics"]) {
  const score = m.isolated_count * 3 + m.vulnerable_count * 1.5
  if (score === 0) return { label: "Favorable", color: "bg-green-100 text-green-800 border-green-200" }
  if (score <= 4) return { label: "Atención moderada", color: "bg-amber-100 text-amber-800 border-amber-200" }
  return { label: "Atención prioritaria", color: "bg-red-100 text-red-800 border-red-200" }
}

function nodesByRole(nodes: SociogramNode[]) {
  return {
    isolated: nodes.filter(n => n.is_isolated),
    vulnerable: nodes.filter(n => n.is_vulnerable && !n.is_isolated),
    leaders: nodes.filter(n => n.is_leader).sort((a, b) => b.received_count - a.received_count),
    bridges: nodes.filter(n => n.is_bridge).sort((a, b) => b.betweenness - a.betweenness),
    normal: nodes.filter(n => !n.is_isolated && !n.is_vulnerable && !n.is_leader && !n.is_bridge),
  }
}

function buildRecommendations(data: SociogramData): string[] {
  const m = data.metrics
  const recs: string[] = []
  const roles = nodesByRole(data.nodes)

  if (roles.isolated.length > 0) {
    const names = roles.isolated.map(n => `${n.first_name} ${n.last_name}`).join(", ")
    recs.push(`Priorizar la integración social de ${names} en la nueva distribución: asegurarse de que queden en la misma clase que al menos un alumno que los haya elegido o que comparta intereses.`)
  }
  if (roles.vulnerable.length > 3) {
    recs.push(`${roles.vulnerable.length} alumnos dependen de una única relación significativa. Al hacer la mezcla, verificar que esa relación se preserva o se sustituye por otra equivalente.`)
  }
  if (m.density < 0.12) {
    recs.push("La densidad de red es baja. El grupo tiene pocas conexiones globales, lo que puede indicar subgrupos muy cerrados sin puentes entre ellos. Considerar actividades de cohesión grupal antes de la mezcla.")
  }
  if (m.communities_count > 4) {
    recs.push(`Se detectan ${m.communities_count} comunidades bien diferenciadas. Distribuir equilibradamente miembros de cada comunidad entre las nuevas clases para favorecer la integración.`)
  }
  if (roles.bridges.length > 0) {
    const names = roles.bridges.slice(0, 3).map(n => n.first_name).join(", ")
    recs.push(`Los alumnos puente (${names}) conectan grupos distintos. Distribuirlos en clases diferentes maximizará la integración social del conjunto.`)
  }
  if (m.group_cohesion < 0.08) {
    recs.push("La cohesión del grupo es muy baja. Priorizar las relaciones recíprocas en el algoritmo de mezcla para que cada alumno mantenga al menos un vínculo mutuo en la nueva clase.")
  }
  if (recs.length === 0) {
    recs.push("El grupo presenta indicadores sociales saludables. Aplicar la distribución equilibrada habitual atendiendo a los criterios académicos y de conducta.")
  }
  return recs
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SociogramReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData] = useState<SociogramData | null>(null)
  const [processName, setProcessName] = useState("")
  const [loading, setLoading] = useState(true)
  const today = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })

  useEffect(() => {
    Promise.all([
      fetch(`/api/processes/${id}/sociogram`).then(r => r.json()),
      fetch(`/api/processes/${id}`).then(r => r.json()),
    ]).then(([socio, proc]) => {
      setData(socio)
      setProcessName(proc.name ?? "")
    }).finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!data) return null

  const m = data.metrics
  const roles = nodesByRole(data.nodes)
  const risk = riskLevel(m)
  const density = densityLabel(m.density)
  const cohesion = cohesionLabel(m.group_cohesion)
  const recs = buildRecommendations(data)

  return (
    <div className="min-h-screen bg-white">
      {/* Toolbar — hidden on print */}
      <div className="flex items-center gap-3 px-6 py-3 border-b bg-background print:hidden sticky top-0 z-10">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/processes/${id}/sociogram`}><ArrowLeft className="w-4 h-4" /></Link>
        </Button>
        <div className="flex-1">
          <p className="text-sm font-semibold">Informe sociométrico</p>
          <p className="text-xs text-muted-foreground">{processName}</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-2">
          <Printer className="w-4 h-4" /> Imprimir / PDF
        </Button>
      </div>

      {/* Report body */}
      <div className="max-w-4xl mx-auto px-8 py-10 print:px-6 print:py-4 space-y-10">

        {/* Header */}
        <div className="border-b pb-6">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Informe sociométrico</p>
          <h1 className="text-3xl font-bold mb-1">{processName}</h1>
          <p className="text-muted-foreground text-sm">Generado el {today} · {m.total_students} alumnos analizados</p>

          <div className={`inline-flex items-center gap-2 mt-4 px-3 py-1.5 rounded-full border text-sm font-medium ${risk.color}`}>
            <AlertTriangle className="w-4 h-4" />
            Valoración general: {risk.label}
          </div>
        </div>

        {/* 1. Indicadores globales */}
        <section>
          <SectionTitle icon={<TrendingUp className="w-5 h-5" />} number="1" title="Indicadores globales" />
          <div className="grid grid-cols-2 gap-3 mt-4 sm:grid-cols-4">
            {[
              { label: "Alumnos analizados", value: m.total_students },
              { label: "Relaciones totales", value: data.edges.length },
              { label: "Pares recíprocos", value: m.reciprocal_pairs },
              { label: "Comunidades", value: m.communities_count },
            ].map(item => (
              <div key={item.label} className="border rounded-lg p-4 text-center">
                <p className="text-2xl font-bold">{item.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
              </div>
            ))}
          </div>

          <table className="w-full mt-4 text-sm border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 font-semibold">Indicador</th>
                <th className="text-right py-2 font-semibold">Valor</th>
                <th className="text-left py-2 pl-6 font-semibold">Interpretación</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td className="py-2">Densidad de red</td>
                <td className="py-2 text-right font-mono">{(m.density * 100).toFixed(1)}%</td>
                <td className={`py-2 pl-6 ${density.color}`}>{density.text} — relaciones existentes sobre el total posible</td>
              </tr>
              <tr>
                <td className="py-2">Cohesión grupal (IAg)</td>
                <td className="py-2 text-right font-mono">{(m.group_cohesion * 100).toFixed(1)}%</td>
                <td className={`py-2 pl-6 ${cohesion.color}`}>{cohesion.text} — pares recíprocos / pares posibles</td>
              </tr>
              <tr>
                <td className="py-2">Alumnos aislados</td>
                <td className={`py-2 text-right font-mono ${m.isolated_count > 0 ? "text-red-600 font-bold" : "text-green-700"}`}>{m.isolated_count}</td>
                <td className="py-2 pl-6 text-muted-foreground">{m.isolated_count === 0 ? "Ningún alumno sin elecciones recibidas" : `${m.isolated_count} alumno/s sin ninguna elección recibida`}</td>
              </tr>
              <tr>
                <td className="py-2">Alumnos vulnerables</td>
                <td className={`py-2 text-right font-mono ${m.vulnerable_count > 0 ? "text-orange-600 font-bold" : "text-green-700"}`}>{m.vulnerable_count}</td>
                <td className="py-2 pl-6 text-muted-foreground">{m.vulnerable_count === 0 ? "Ningún alumno en situación de dependencia única" : `${m.vulnerable_count} alumno/s dependen de una única relación`}</td>
              </tr>
              <tr>
                <td className="py-2">Líderes sociales</td>
                <td className="py-2 text-right font-mono text-amber-600 font-bold">{m.leaders_count}</td>
                <td className="py-2 pl-6 text-muted-foreground">Alumnos con alta centralidad y muchas elecciones recibidas</td>
              </tr>
              <tr>
                <td className="py-2">Alumnos puente</td>
                <td className="py-2 text-right font-mono text-indigo-600 font-bold">{m.bridges_count}</td>
                <td className="py-2 pl-6 text-muted-foreground">Conectan comunidades distintas; clave para la integración</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* 2. Alumnos en situación de riesgo */}
        <section>
          <SectionTitle icon={<AlertTriangle className="w-5 h-5 text-red-500" />} number="2" title="Alumnos en situación de riesgo social" />

          {roles.isolated.length === 0 && roles.vulnerable.length === 0 ? (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
              No se detectan alumnos en situación de riesgo social. Todos tienen al menos una relación recibida y al menos un vínculo recíproco.
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {roles.isolated.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                    Aislamiento total ({roles.isolated.length} alumno/s)
                  </h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    No han recibido ninguna elección de sus compañeros. Requieren atención prioritaria en la distribución de clases.
                  </p>
                  <StudentTable nodes={roles.isolated} showReceived showGiven showReciprocal />
                </div>
              )}

              {roles.vulnerable.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-orange-700 mb-2 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" />
                    Dependencia social ({roles.vulnerable.length} alumno/s)
                  </h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Solo tienen una relación recíproca significativa. Si esa conexión se rompe en la mezcla, quedan en situación de aislamiento.
                  </p>
                  <StudentTable nodes={roles.vulnerable} showReceived showGiven showReciprocal />
                </div>
              )}
            </div>
          )}
        </section>

        {/* 3. Líderes sociales */}
        {roles.leaders.length > 0 && (
          <section>
            <SectionTitle icon={<TrendingUp className="w-5 h-5 text-amber-500" />} number="3" title="Líderes sociales" />
            <p className="text-sm text-muted-foreground mt-2 mb-4">
              Alumnos con alta centralidad y muchas elecciones recibidas. Su distribución en las nuevas clases influye directamente en la dinámica social de cada grupo.
            </p>
            <StudentTable nodes={roles.leaders.slice(0, 8)} showReceived showCentrality showCommunity />
          </section>
        )}

        {/* 4. Alumnos puente */}
        {roles.bridges.length > 0 && (
          <section>
            <SectionTitle icon={<Network className="w-5 h-5 text-indigo-500" />} number="4" title="Alumnos puente" />
            <p className="text-sm text-muted-foreground mt-2 mb-4">
              Conectan comunidades distintas actuando como nexo entre grupos. Distribuirlos en clases diferentes al hacer la mezcla maximiza la integración del conjunto.
            </p>
            <StudentTable nodes={roles.bridges.slice(0, 6)} showReceived showBetweenness showCommunity />
          </section>
        )}

        {/* 5. Comunidades */}
        {data.communities.length > 0 && (
          <section>
            <SectionTitle icon={<Users className="w-5 h-5 text-blue-500" />} number="5" title="Comunidades detectadas" />
            <p className="text-sm text-muted-foreground mt-2 mb-4">
              Subgrupos de alumnos con alta densidad de relaciones internas, detectados automáticamente a partir de las elecciones recíprocas.
            </p>
            <div className="space-y-3">
              {data.communities.map(comm => {
                const members = comm.members
                  .map(sid => data.nodes.find(n => n.id === sid))
                  .filter(Boolean) as SociogramNode[]
                const avgReceived = members.length > 0
                  ? (members.reduce((s, n) => s + n.received_count, 0) / members.length).toFixed(1)
                  : "—"
                const classBreakdown = Object.entries(
                  members.reduce((acc, n) => { acc[n.current_class] = (acc[n.current_class] ?? 0) + 1; return acc }, {} as Record<string, number>)
                ).map(([cls, cnt]) => `${cnt} de ${cls}`).join(", ")

                return (
                  <div key={comm.id} className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PALETTE[comm.id % PALETTE.length] }} />
                      <span className="font-semibold text-sm">Grupo {comm.id + 1}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{comm.size} alumnos · {classBreakdown}</span>
                      {comm.is_closed && (
                        <span className="text-xs text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">Cerrado</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      Media de elecciones recibidas: {avgReceived} · {comm.is_closed ? "Grupo muy cohesionado, pocas conexiones externas." : "Grupo con conexiones hacia el exterior."}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {members.map(n => (
                        <span key={n.id} className={`text-xs px-2 py-0.5 rounded-full border ${n.is_leader ? "bg-amber-50 border-amber-300 text-amber-800" : n.is_bridge ? "bg-indigo-50 border-indigo-300 text-indigo-800" : "bg-muted text-muted-foreground"}`}>
                          {n.first_name} {n.last_name}
                          {n.is_leader ? " ★" : n.is_bridge ? " ⬡" : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* 6. Alertas */}
        {data.alerts.length > 0 && (
          <section>
            <SectionTitle icon={<AlertTriangle className="w-5 h-5 text-orange-500" />} number="6" title="Alertas del sistema" />
            <div className="mt-4 space-y-2">
              {data.alerts.map((alert, i) => (
                <div key={i} className={`border rounded-lg p-3 text-sm ${ALERT_STYLES[alert.severity] ?? ""}`}>
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold">{ALERT_LABELS[alert.type] ?? alert.type} — {alert.severity === "high" ? "Alta prioridad" : alert.severity === "medium" ? "Prioridad media" : "Baja prioridad"}</p>
                      <p className="mt-0.5 opacity-90">{alert.message}</p>
                      {alert.student_ids.length > 0 && (
                        <p className="mt-1 text-xs opacity-75">
                          Alumnos: {alert.student_ids.slice(0, 5).map(sid => {
                            const n = data.nodes.find(x => x.id === sid)
                            return n ? `${n.first_name} ${n.last_name}` : sid
                          }).join(", ")}
                          {alert.student_ids.length > 5 && ` y ${alert.student_ids.length - 5} más`}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 7. Recomendaciones */}
        <section>
          <SectionTitle icon={<Shield className="w-5 h-5 text-green-600" />} number={String(data.alerts.length > 0 ? 7 : 6 + (data.communities.length > 0 ? 1 : 0) + 1)} title="Recomendaciones para la distribución" />
          <ul className="mt-4 space-y-3">
            {recs.map((rec, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{i + 1}</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Footer */}
        <div className="border-t pt-6 text-xs text-muted-foreground space-y-1 print:mt-8">
          <p>Este informe es de uso exclusivo interno del equipo docente y orientación. Los datos son confidenciales.</p>
          <p>Generado automáticamente por ClassMixer · {today}</p>
          <p className="italic">El sociograma es una herramienta orientativa. No sustituye la valoración profesional del equipo.</p>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionTitle({ icon, number, title }: { icon: React.ReactNode; number: string; title: string }) {
  return (
    <div className="flex items-center gap-3 pb-2 border-b">
      <span className="w-7 h-7 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center shrink-0">{number}</span>
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-lg font-bold">{title}</h2>
      </div>
    </div>
  )
}

function StudentTable({
  nodes,
  showReceived, showGiven, showReciprocal, showCentrality, showBetweenness, showCommunity,
}: {
  nodes: SociogramNode[]
  showReceived?: boolean
  showGiven?: boolean
  showReciprocal?: boolean
  showCentrality?: boolean
  showBetweenness?: boolean
  showCommunity?: boolean
}) {
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="border-b text-xs text-muted-foreground">
          <th className="text-left py-1.5 font-semibold">Alumno</th>
          <th className="text-left py-1.5 font-semibold">Clase</th>
          {showReceived && <th className="text-right py-1.5 font-semibold">Rec.</th>}
          {showGiven && <th className="text-right py-1.5 font-semibold">Dadas</th>}
          {showReciprocal && <th className="text-right py-1.5 font-semibold">Recíp.</th>}
          {showCentrality && <th className="text-right py-1.5 font-semibold">Central.</th>}
          {showBetweenness && <th className="text-right py-1.5 font-semibold">Intermediac.</th>}
          {showCommunity && <th className="text-right py-1.5 font-semibold">Grupo</th>}
          <th className="text-left py-1.5 pl-4 font-semibold">Estado</th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {nodes.map(n => (
          <tr key={n.id}>
            <td className="py-2 font-medium">{n.first_name} {n.last_name}</td>
            <td className="py-2 text-muted-foreground">{n.current_class}</td>
            {showReceived && <td className="py-2 text-right font-mono">{n.received_count}</td>}
            {showGiven && <td className="py-2 text-right font-mono">{n.given_count}</td>}
            {showReciprocal && <td className="py-2 text-right font-mono">{n.reciprocal_count}</td>}
            {showCentrality && <td className="py-2 text-right font-mono">{(n.centrality * 100).toFixed(0)}%</td>}
            {showBetweenness && <td className="py-2 text-right font-mono">{(n.betweenness * 100).toFixed(1)}%</td>}
            {showCommunity && <td className="py-2 text-right text-muted-foreground">{typeof n.community_id === "number" ? `G${n.community_id + 1}` : "—"}</td>}
            <td className="py-2 pl-4">
              <div className="flex gap-1 flex-wrap">
                {n.is_isolated && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Aislado</span>}
                {n.is_vulnerable && <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">Vulnerable</span>}
                {n.is_leader && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Líder</span>}
                {n.is_bridge && <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">Puente</span>}
                {!n.is_isolated && !n.is_vulnerable && !n.is_leader && !n.is_bridge && <span className="text-xs text-muted-foreground">—</span>}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const PALETTE = [
  "#3b82f6", "#22c55e", "#f97316", "#ec4899", "#8b5cf6",
  "#06b6d4", "#f59e0b", "#10b981", "#6366f1", "#84cc16",
]

const ALERT_LABELS: Record<string, string> = {
  isolated: "Aislamiento",
  vulnerable: "Vulnerabilidad",
  closed_group: "Subgrupo cerrado",
  dominant_group: "Grupo dominante",
  bridge: "Alumnos puente",
  conflict: "Conflicto",
}

const ALERT_STYLES: Record<string, string> = {
  high: "bg-red-50 border-red-200 text-red-800",
  medium: "bg-orange-50 border-orange-200 text-orange-800",
  low: "bg-blue-50 border-blue-200 text-blue-700",
}
