"use client"

import { use, useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowLeft, AlertTriangle, Users, Network, Loader2,
  Download, ImageDown, Filter, X, Sparkles, FileText
} from "lucide-react"
import Link from "next/link"
import type { SociogramData, SociogramNode } from "@/types"
import type { SociogramGraphHandle, SociogramColorBy, SociogramLayout, SociogramFilter } from "@/components/sociogram/SociogramGraph"
import { COMMUNITY_PALETTE } from "@/components/sociogram/SociogramGraph"

const SociogramGraph = dynamic(
  () => import("@/components/sociogram/SociogramGraph").then(m => m.SociogramGraph),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-full"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div> }
)

const ALERT_LABELS: Record<string, string> = {
  isolated: "Aislamiento",
  vulnerable: "Vulnerabilidad",
  closed_group: "Subgrupo cerrado",
  dominant_group: "Grupo dominante",
  bridge: "Alumnos puente",
  conflict: "Conflicto",
}

const SEVERITY_STYLES: Record<string, string> = {
  high: "bg-red-50 border-red-200 text-red-800",
  medium: "bg-orange-50 border-orange-200 text-orange-800",
  low: "bg-blue-50 border-blue-200 text-blue-700",
}

export default function SociogramPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const graphRef = useRef<SociogramGraphHandle>(null)

  const [data, setData] = useState<SociogramData | null>(null)
  const [loading, setLoading] = useState(true)
  const [colorBy, setColorBy] = useState<SociogramColorBy>("community")
  const [layout, setLayout] = useState<SociogramLayout>("cose")
  const [filter, setFilter] = useState<Partial<SociogramFilter>>({})
  const [selectedNode, setSelectedNode] = useState<SociogramNode | null>(null)
  const [exportingExcel, setExportingExcel] = useState(false)
  const [viewerRole, setViewerRole] = useState<string | null>(null)
  const [canSeeSensitive, setCanSeeSensitive] = useState(false)
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => {
    fetch(`/api/processes/${id}/sociogram`)
      .then(r => r.json())
      .then(d => {
        setData(d)
        setViewerRole(d.viewer_role ?? null)
        setCanSeeSensitive(d.can_see_sensitive ?? false)
      })
      .finally(() => setLoading(false))
  }, [id])

  const classes = data ? [...new Set(data.nodes.map(n => n.current_class))].sort() : []

  function setQuickFilter(key: keyof SociogramFilter, value: boolean | null | string) {
    setFilter(prev => {
      if (key === "classFilter") return { ...prev, classFilter: value as string | null }
      if (typeof value === "boolean") return { ...prev, [key]: value }
      return prev
    })
  }

  function clearFilters() {
    setFilter({})
  }

  const hasActiveFilter = filter.classFilter || filter.showOnlyIsolated || filter.showOnlyReciprocal || (filter.relationType && filter.relationType !== "all")

  async function handleAISummary() {
    setAiLoading(true)
    setAiSummary(null)
    try {
      const res = await fetch(`/api/processes/${id}/sociogram/explain`, { method: "POST" })
      const json = await res.json()
      if (res.ok) setAiSummary(json.summary)
      else setAiSummary(`Error: ${json.error}`)
    } catch {
      setAiSummary("Error al conectar con la IA")
    } finally {
      setAiLoading(false)
    }
  }

  async function handleExportExcel() {
    setExportingExcel(true)
    try {
      const res = await fetch(`/api/processes/${id}/sociogram/export`)
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `sociograma_metricas.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 100)
    } finally {
      setExportingExcel(false)
    }
  }

  const nodeMap = data ? new Map(data.nodes.map(n => [n.id, n])) : new Map<string, SociogramNode>()

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Orientador audit notice */}
      {viewerRole === "orientador" && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-800 flex items-center gap-2 shrink-0">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Tu acceso a este sociograma queda registrado. Los datos mostrados son confidenciales.
        </div>
      )}
      {/* Tutor restricted notice */}
      {viewerRole === "tutor" && !canSeeSensitive && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 text-xs text-blue-800 flex items-center gap-2 shrink-0">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Vista limitada: las relaciones emocionales y negativas solo son visibles para orientación.
        </div>
      )}
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-background shrink-0 flex-wrap">
        <Button variant="ghost" size="icon" className="shrink-0" asChild>
          <Link href={`/processes/${id}`}><ArrowLeft className="w-4 h-4" /></Link>
        </Button>
        <div className="mr-2">
          <h1 className="text-sm font-bold leading-tight">Sociograma</h1>
          {data && <p className="text-xs text-muted-foreground">{data.metrics.total_students} alumnos · {data.edges.length} relaciones</p>}
        </div>

        <div className="flex items-center gap-1.5 flex-1 flex-wrap">
          {/* Layout */}
          <Select value={layout} onValueChange={v => setLayout(v as SociogramLayout)}>
            <SelectTrigger className="w-36 h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cose">Fuerza (fCOSE)</SelectItem>
              <SelectItem value="circle">Circular</SelectItem>
              <SelectItem value="concentric">Concéntrico</SelectItem>
              <SelectItem value="breadthfirst">Árbol</SelectItem>
              <SelectItem value="grid">Cuadrícula</SelectItem>
            </SelectContent>
          </Select>

          {/* Color by */}
          <Select value={colorBy} onValueChange={v => setColorBy(v as SociogramColorBy)}>
            <SelectTrigger className="w-40 h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="community">Por comunidad</SelectItem>
              <SelectItem value="class">Por clase</SelectItem>
              <SelectItem value="gender">Por género</SelectItem>
              <SelectItem value="level">Por nivel académico</SelectItem>
              <SelectItem value="behavior">Por conducta</SelectItem>
              <SelectItem value="isolation">Por riesgo social</SelectItem>
            </SelectContent>
          </Select>

          {/* Class filter */}
          {classes.length > 1 && (
            <Select
              value={filter.classFilter ?? "all"}
              onValueChange={v => setQuickFilter("classFilter", v === "all" ? null : v)}
            >
              <SelectTrigger className="w-28 h-7 text-xs">
                <SelectValue placeholder="Clase" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {classes.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          {/* Quick filter chips */}
          <Button
            size="sm"
            variant={filter.showOnlyIsolated ? "default" : "outline"}
            className="h-7 text-xs px-2"
            onClick={() => setQuickFilter("showOnlyIsolated", !filter.showOnlyIsolated)}
          >
            Solo en riesgo
          </Button>
          <Button
            size="sm"
            variant={filter.showOnlyReciprocal ? "default" : "outline"}
            className="h-7 text-xs px-2"
            onClick={() => setQuickFilter("showOnlyReciprocal", !filter.showOnlyReciprocal)}
          >
            Solo recíprocas
          </Button>

          {hasActiveFilter && (
            <Button size="sm" variant="ghost" className="h-7 text-xs px-2 text-muted-foreground" onClick={clearFilters}>
              <X className="w-3 h-3 mr-1" /> Limpiar
            </Button>
          )}
        </div>

        {/* Export + AI buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" asChild>
            <Link href={`/processes/${id}/sociogram/report`}>
              <FileText className="w-3.5 h-3.5" /> Informe
            </Link>
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => graphRef.current?.exportPNG()}>
            <ImageDown className="w-3.5 h-3.5" /> PNG
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={handleExportExcel} disabled={exportingExcel}>
            {exportingExcel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Excel
          </Button>
          {(viewerRole === "admin" || viewerRole === "superadmin" || viewerRole === "orientador") && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={handleAISummary} disabled={aiLoading}>
              {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Análisis IA
            </Button>
          )}
        </div>
      </div>

      {/* AI Summary panel */}
      {aiSummary && (
        <div className="border-b bg-violet-50 px-4 py-3 text-sm text-violet-900 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 mt-0.5 shrink-0 text-violet-600" />
              <div className="whitespace-pre-line leading-relaxed">{aiSummary}</div>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setAiSummary(null)}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Graph area */}
        <div className="flex-1 relative overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : data && data.nodes.length > 0 ? (
            <SociogramGraph
              ref={graphRef}
              data={data}
              colorBy={colorBy}
              layout={layout}
              filter={filter}
              onNodeClick={setSelectedNode}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Network className="w-12 h-12 mb-4 opacity-30" />
              <p className="font-medium">No hay datos de sociograma</p>
              <p className="text-sm mt-1">Importa alumnos y recoge respuestas del cuestionario primero</p>
            </div>
          )}

          {/* Active filter banner */}
          {hasActiveFilter && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs px-3 py-1.5 rounded-full shadow flex items-center gap-2">
              <Filter className="w-3 h-3" />
              Vista filtrada — mostrando subconjunto de nodos
            </div>
          )}
        </div>

        {/* Right panel */}
        {data && (
          <div className="w-80 border-l bg-background overflow-hidden flex flex-col shrink-0">
            <Tabs defaultValue="metrics" className="flex flex-col h-full">
              <TabsList className="rounded-none border-b w-full justify-start h-9 px-2 bg-muted/30 shrink-0">
                <TabsTrigger value="metrics" className="text-xs h-7">Métricas</TabsTrigger>
                <TabsTrigger value="alerts" className="text-xs h-7">
                  Alertas
                  {data.alerts.length > 0 && <span className="ml-1 bg-orange-100 text-orange-700 rounded-full text-xs w-4 h-4 flex items-center justify-center">{data.alerts.length}</span>}
                </TabsTrigger>
                <TabsTrigger value="groups" className="text-xs h-7">Grupos</TabsTrigger>
                <TabsTrigger value="nodes" className="text-xs h-7">Alumnos</TabsTrigger>
              </TabsList>

              {/* Métricas tab */}
              <TabsContent value="metrics" className="flex-1 overflow-y-auto p-3 mt-0 space-y-3">
                {/* Global stats */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Aislados", value: data.metrics.isolated_count, danger: data.metrics.isolated_count > 0 },
                    { label: "Vulnerables", value: data.metrics.vulnerable_count, warn: data.metrics.vulnerable_count > 0 },
                    { label: "Líderes", value: data.metrics.leaders_count, good: true },
                    { label: "Puentes", value: data.metrics.bridges_count, info: true },
                    { label: "Comunidades", value: data.metrics.communities_count },
                    { label: "Pares recíprocos", value: data.metrics.reciprocal_pairs, good: true },
                  ].map(item => (
                    <Card key={item.label} className="p-3">
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className={`text-xl font-bold mt-0.5 ${item.danger ? "text-red-600" : item.warn ? "text-orange-500" : item.good ? "text-green-600" : item.info ? "text-indigo-600" : ""}`}>
                        {item.value}
                      </p>
                    </Card>
                  ))}
                </div>

                {/* Density and cohesion bars */}
                <Card>
                  <CardContent className="p-3 space-y-3">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Densidad de red</span>
                        <span className="font-medium">{(data.metrics.density * 100).toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(data.metrics.density * 100 * 5, 100)}%` }} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">Relaciones existentes vs. posibles</p>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Cohesión del grupo</span>
                        <span className="font-medium">{(data.metrics.cohesion * 100).toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${data.metrics.cohesion >= 0.5 ? "bg-green-500" : data.metrics.cohesion >= 0.3 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${data.metrics.cohesion * 100}%` }} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">Amistades recíprocas sobre el total</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Legend */}
                <Card>
                  <CardHeader className="pb-1 pt-3 px-3">
                    <CardTitle className="text-xs font-semibold">Leyenda de aristas</CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3 space-y-1.5 text-xs">
                    {[
                      { color: "#93c5fd", label: "Amistad (unilateral)", style: "solid" },
                      { color: "#2563eb", label: "Amistad recíproca", style: "solid", thick: true },
                      { color: "#4ade80", label: "Trabajo en clase", style: "dashed" },
                      { color: "#c4b5fd", label: "Apoyo emocional", style: "dotted" },
                      { color: "#fca5a5", label: "Dificultad (negativa)", style: "dashed" },
                    ].map(item => (
                      <div key={item.label} className="flex items-center gap-2">
                        <div className={`w-6 h-0 border-t-2 shrink-0 ${item.style === "dashed" ? "border-dashed" : item.style === "dotted" ? "border-dotted" : ""}`}
                          style={{ borderColor: item.color, borderWidth: item.thick ? 3 : 1.5 }} />
                        <span className="text-muted-foreground">{item.label}</span>
                      </div>
                    ))}
                    <div className="mt-1 pt-1 border-t space-y-1">
                      {[
                        { color: "#ef4444", label: "Borde rojo = Aislado" },
                        { color: "#f97316", label: "Borde naranja = Vulnerable" },
                        { color: "#f59e0b", label: "Borde dorado = Líder" },
                        { color: "#6366f1", label: "Borde índigo = Puente" },
                      ].map(item => (
                        <div key={item.label} className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full border-2 shrink-0" style={{ borderColor: item.color }} />
                          <span className="text-muted-foreground">{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Alertas tab */}
              <TabsContent value="alerts" className="flex-1 overflow-y-auto p-3 mt-0">
                {data.alerts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No hay alertas detectadas
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.alerts.map((alert, i) => (
                      <div key={i} className={`border rounded-lg p-3 text-xs ${SEVERITY_STYLES[alert.severity] ?? ""}`}>
                        <div className="flex items-center gap-1.5 font-semibold mb-1">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          {ALERT_LABELS[alert.type] ?? alert.type}
                          <Badge variant="outline" className="ml-auto text-xs border-current">
                            {alert.severity === "high" ? "Alta" : alert.severity === "medium" ? "Media" : "Baja"}
                          </Badge>
                        </div>
                        <p className="mb-2 opacity-90">{alert.message}</p>
                        {alert.student_ids.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {alert.student_ids.slice(0, 6).map(sid => {
                              const n = nodeMap.get(sid)
                              return n ? (
                                <span key={sid} className="bg-white/60 px-1.5 py-0.5 rounded text-xs">
                                  {n.first_name} {n.last_name}
                                </span>
                              ) : null
                            })}
                            {alert.student_ids.length > 6 && (
                              <span className="px-1.5 py-0.5 opacity-70">+{alert.student_ids.length - 6} más</span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Grupos tab */}
              <TabsContent value="groups" className="flex-1 overflow-y-auto p-3 mt-0">
                {data.communities.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No hay comunidades detectadas
                    <p className="text-xs mt-1">Se requieren relaciones recíprocas</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.communities.map(comm => {
                      const members = comm.members.map(sid => nodeMap.get(sid)).filter(Boolean) as SociogramNode[]
                      return (
                        <Card key={comm.id} className="overflow-hidden">
                          <div className="flex items-center gap-2 p-3 pb-2">
                            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COMMUNITY_PALETTE[comm.id % COMMUNITY_PALETTE.length] }} />
                            <span className="text-xs font-semibold">Grupo {comm.id + 1}</span>
                            <Badge variant="secondary" className="text-xs ml-auto">{comm.size} alumnos</Badge>
                            {comm.is_closed && <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">Cerrado</Badge>}
                          </div>
                          <div className="px-3 pb-3 flex flex-wrap gap-1">
                            {members.map(n => (
                              <button
                                key={n.id}
                                onClick={() => setSelectedNode(n)}
                                className="text-xs bg-muted hover:bg-muted/70 px-1.5 py-0.5 rounded transition-colors"
                              >
                                {n.first_name} {n.last_name}
                              </button>
                            ))}
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </TabsContent>

              {/* Alumnos tab */}
              <TabsContent value="nodes" className="flex-1 overflow-hidden flex flex-col mt-0">
                <div className="px-3 pt-3 pb-2 shrink-0">
                  <p className="text-xs text-muted-foreground">Ordenados por centralidad descendente</p>
                </div>
                <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
                  {[...data.nodes]
                    .sort((a, b) => b.centrality - a.centrality)
                    .map(node => (
                      <button
                        key={node.id}
                        onClick={() => setSelectedNode(node)}
                        className={`w-full text-left rounded-lg border p-2 text-xs transition-colors hover:bg-muted/50 ${selectedNode?.id === node.id ? "border-primary bg-primary/5" : ""}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COMMUNITY_PALETTE[(node.community_id ?? 0) % COMMUNITY_PALETTE.length] }} />
                          <span className="font-medium flex-1 truncate">{node.first_name} {node.last_name}</span>
                          <span className="text-muted-foreground">{node.current_class}</span>
                        </div>
                        <div className="flex items-center gap-3 text-muted-foreground">
                          <span title="Elecciones recibidas">↓{node.received_count}</span>
                          <span title="Recíprocas">⇄{node.reciprocal_count}</span>
                          <span title="Centralidad">{(node.centrality * 100).toFixed(0)}%</span>
                          <div className="ml-auto flex gap-1">
                            {node.is_isolated && <span className="text-red-500 font-semibold">Ais.</span>}
                            {node.is_vulnerable && <span className="text-orange-500 font-semibold">Vul.</span>}
                            {node.is_leader && <span className="text-amber-500 font-semibold">Líd.</span>}
                            {node.is_bridge && <span className="text-indigo-500 font-semibold">Pte.</span>}
                          </div>
                        </div>
                      </button>
                    ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  )
}
