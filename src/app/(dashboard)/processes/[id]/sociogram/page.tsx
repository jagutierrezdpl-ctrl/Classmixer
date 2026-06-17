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
  Download, ImageDown, Filter, X, Sparkles, FileText, ShieldAlert, ChevronDown
} from "lucide-react"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-background shrink-0">
        {/* Back + title */}
        <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7" asChild>
          <Link href={`/processes/${id}`}><ArrowLeft className="w-4 h-4" /></Link>
        </Button>
        <div className="shrink-0 mr-1">
          <h1 className="text-sm font-bold leading-tight">Sociograma</h1>
          {data && <p className="text-xs text-muted-foreground leading-tight">{data.metrics.total_students} alumnos · {data.edges.length} relaciones</p>}
        </div>

        <div className="w-px h-6 bg-border shrink-0" />

        {/* View controls */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
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

          {classes.length > 1 && (
            <Select
              value={filter.classFilter ?? "all"}
              onValueChange={v => setQuickFilter("classFilter", v === "all" ? null : v)}
            >
              <SelectTrigger className="w-24 h-7 text-xs">
                <SelectValue placeholder="Clase" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {classes.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          <div className="w-px h-5 bg-border shrink-0" />

          <Button
            size="sm"
            variant={filter.showOnlyIsolated ? "default" : "outline"}
            className="h-7 text-xs px-2.5"
            onClick={() => setQuickFilter("showOnlyIsolated", !filter.showOnlyIsolated)}
          >
            En riesgo
          </Button>
          <Button
            size="sm"
            variant={filter.showOnlyReciprocal ? "default" : "outline"}
            className="h-7 text-xs px-2.5"
            onClick={() => setQuickFilter("showOnlyReciprocal", !filter.showOnlyReciprocal)}
          >
            Recíprocas
          </Button>

          {hasActiveFilter && (
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground" onClick={clearFilters} title="Limpiar filtros">
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>

        <div className="w-px h-6 bg-border shrink-0" />

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" asChild>
            <Link href={`/processes/${id}/sociogram/report`}>
              <FileText className="w-3.5 h-3.5" /> Informe
            </Link>
          </Button>

          {/* Export dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                <Download className="w-3.5 h-3.5" /> Exportar <ChevronDown className="w-3 h-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-xs">
              <DropdownMenuItem className="gap-2 text-xs" onClick={() => graphRef.current?.exportPNG()}>
                <ImageDown className="w-3.5 h-3.5" /> Imagen PNG
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 text-xs" onClick={() => graphRef.current?.exportSVG()}>
                <ImageDown className="w-3.5 h-3.5" /> Imagen SVG
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 text-xs" onClick={handleExportExcel} disabled={exportingExcel}>
                {exportingExcel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Excel (métricas)
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 text-xs" asChild>
                <a href={`/api/processes/${id}/sociogram/export/pdf`} download>
                  <Download className="w-3.5 h-3.5" /> PDF sociograma
                </a>
              </DropdownMenuItem>
              {(viewerRole === "admin" || viewerRole === "superadmin" || viewerRole === "orientador") && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="gap-2 text-xs" asChild>
                    <a href={`/api/processes/${id}/sociogram/export/pdf/orientacion`} download>
                      <Download className="w-3.5 h-3.5" /> PDF orientación
                    </a>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {(viewerRole === "admin" || viewerRole === "superadmin" || viewerRole === "orientador") && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 border-red-200 text-red-700 hover:bg-red-50" asChild title="Informe de convivencia (muy sensible)">
              <a href={`/api/processes/${id}/sociogram/export/pdf/convivencia`} download>
                <ShieldAlert className="w-3.5 h-3.5" /> Convivencia
              </a>
            </Button>
          )}

          {(viewerRole === "admin" || viewerRole === "superadmin" || viewerRole === "orientador") && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={handleAISummary} disabled={aiLoading}>
              {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} IA
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

          {/* Selected node detail panel */}
          {selectedNode && (
            <div className="absolute bottom-4 left-4 w-72 bg-background border rounded-xl shadow-lg text-xs overflow-hidden">
              <div className="flex items-start justify-between gap-2 px-3 pt-3 pb-2 border-b">
                <div>
                  <p className="font-bold text-sm">{selectedNode.first_name} {selectedNode.last_name}</p>
                  <p className="text-muted-foreground">{selectedNode.current_class} · {selectedNode.gender}</p>
                </div>
                <button onClick={() => setSelectedNode(null)} className="text-muted-foreground hover:text-foreground mt-0.5 shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-3 py-2 space-y-2">
                {/* Role badges */}
                <div className="flex flex-wrap gap-1">
                  {selectedNode.is_isolated && <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-semibold">Aislado</span>}
                  {selectedNode.is_vulnerable && <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-semibold">Vulnerable</span>}
                  {selectedNode.is_leader && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold">Líder</span>}
                  {selectedNode.is_bridge && <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-semibold">Puente</span>}
                  {!selectedNode.is_isolated && !selectedNode.is_vulnerable && !selectedNode.is_leader && !selectedNode.is_bridge && (
                    <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700">Integrado</span>
                  )}
                </div>
                {/* Stats row */}
                <div className="grid grid-cols-3 gap-1 text-center">
                  <div className="bg-muted rounded p-1.5">
                    <p className="text-base font-bold">{selectedNode.received_count}</p>
                    <p className="text-muted-foreground">Recibidas</p>
                  </div>
                  <div className="bg-muted rounded p-1.5">
                    <p className="text-base font-bold">{selectedNode.given_count}</p>
                    <p className="text-muted-foreground">Dadas</p>
                  </div>
                  <div className="bg-muted rounded p-1.5">
                    <p className="text-base font-bold">{selectedNode.reciprocal_count}</p>
                    <p className="text-muted-foreground">Recíprocas</p>
                  </div>
                </div>
                {/* Academic info */}
                {(selectedNode.academic_level || selectedNode.average_grade) && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    {selectedNode.average_grade != null && <span>Nota: <span className="font-medium text-foreground">{selectedNode.average_grade}</span></span>}
                    {selectedNode.academic_level && <span>·</span>}
                    {selectedNode.academic_level && <span>{selectedNode.academic_level}</span>}
                  </div>
                )}
                {/* Who chose this student */}
                {(() => {
                  const choosers = (data?.edges ?? [])
                    .filter(e => e.target === selectedNode.id && e.relation_type === "friendship")
                    .map(e => nodeMap.get(e.source))
                    .filter(Boolean) as SociogramNode[]
                  if (choosers.length === 0) return null
                  return (
                    <div>
                      <p className="text-muted-foreground mb-1">Le eligieron:</p>
                      <div className="flex flex-wrap gap-1">
                        {choosers.slice(0, 8).map(n => {
                          const isReciprocal = (data?.edges ?? []).some(e => e.source === selectedNode.id && e.target === n.id && e.relation_type === "friendship")
                          return (
                            <button
                              key={n.id}
                              onClick={() => setSelectedNode(n)}
                              className={`px-1.5 py-0.5 rounded transition-colors ${isReciprocal ? "bg-pink-100 text-pink-800 font-medium" : "bg-muted hover:bg-muted/70"}`}
                            >
                              {n.first_name}
                              {isReciprocal && " ⇄"}
                            </button>
                          )
                        })}
                        {choosers.length > 8 && <span className="text-muted-foreground px-1">+{choosers.length - 8}</span>}
                      </div>
                    </div>
                  )
                })()}
                {/* Who this student chose */}
                {(() => {
                  const chosen = (data?.edges ?? [])
                    .filter(e => e.source === selectedNode.id && e.relation_type === "friendship")
                    .map(e => nodeMap.get(e.target))
                    .filter(Boolean) as SociogramNode[]
                  if (chosen.length === 0) return null
                  return (
                    <div>
                      <p className="text-muted-foreground mb-1">Eligió a:</p>
                      <div className="flex flex-wrap gap-1">
                        {chosen.slice(0, 8).map(n => {
                          const isReciprocal = (data?.edges ?? []).some(e => e.source === n.id && e.target === selectedNode.id && e.relation_type === "friendship")
                          return (
                            <button
                              key={n.id}
                              onClick={() => setSelectedNode(n)}
                              className={`px-1.5 py-0.5 rounded transition-colors ${isReciprocal ? "bg-pink-100 text-pink-800 font-medium" : "bg-muted hover:bg-muted/70"}`}
                            >
                              {n.first_name}
                              {isReciprocal && " ⇄"}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}
              </div>
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
                <TabsTrigger value="rankings" className="text-xs h-7">Rankings</TabsTrigger>
                <TabsTrigger value="guide" className="text-xs h-7">Guía</TabsTrigger>
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
                {/* Excluded students panel */}
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(data as any).excluded_students?.length > 0 && (
                  <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1.5">
                      <span className="inline-block w-2 h-2 rounded-full bg-gray-400" />
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {(data as any).excluded_students.length} alumno{(data as any).excluded_students.length !== 1 ? "s" : ""} dado{(data as any).excluded_students.length !== 1 ? "s" : ""} de baja — excluidos del análisis
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {(data as any).excluded_students.map((s: any) => (
                        <span key={s.id} className="bg-white border border-gray-200 px-1.5 py-0.5 rounded text-xs text-gray-500 line-through">
                          {s.first_name} {s.last_name}
                          {s.excluded_reason && <span className="no-underline not-italic ml-1 text-gray-400">({s.excluded_reason})</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
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

              {/* Rankings tab */}
              <TabsContent value="rankings" className="flex-1 overflow-y-auto p-3 mt-0 space-y-4 text-xs">

                {/* Popularity ranking */}
                <section>
                  <p className="font-semibold text-sm mb-2 flex items-center gap-1.5">
                    <span className="text-amber-500">⭐</span> Más elegidos (popularidad)
                  </p>
                  <div className="space-y-1">
                    {[...data.nodes]
                      .sort((a, b) => b.received_count - a.received_count)
                      .slice(0, 10)
                      .map((node, i) => {
                        const maxR = Math.max(...data.nodes.map(n => n.received_count), 1)
                        return (
                          <button
                            key={node.id}
                            onClick={() => setSelectedNode(node)}
                            className="w-full flex items-center gap-2 hover:bg-muted/50 rounded p-1 transition-colors"
                          >
                            <span className={`w-5 text-center font-bold shrink-0 ${i === 0 ? "text-amber-500" : i === 1 ? "text-slate-400" : i === 2 ? "text-orange-600" : "text-muted-foreground"}`}>
                              {i + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="truncate font-medium">{node.first_name} {node.last_name}</span>
                                <span className="ml-2 shrink-0 text-muted-foreground">{node.received_count}</span>
                              </div>
                              <div className="h-1 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(node.received_count / maxR) * 100}%` }} />
                              </div>
                            </div>
                          </button>
                        )
                      })}
                  </div>
                </section>

                <div className="border-t" />

                {/* Work ranking */}
                {data.edges.some(e => e.relation_type === "work") && (
                  <>
                    <section>
                      <p className="font-semibold text-sm mb-2 flex items-center gap-1.5">
                        <span className="text-blue-500">💼</span> Más elegidos para trabajar
                      </p>
                      <div className="space-y-1">
                        {(() => {
                          const workCounts = new Map<string, number>()
                          data.edges.filter(e => e.relation_type === "work").forEach(e => {
                            workCounts.set(e.target, (workCounts.get(e.target) ?? 0) + 1)
                          })
                          const maxW = Math.max(...workCounts.values(), 1)
                          return [...workCounts.entries()]
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 8)
                            .map(([id, count], i) => {
                              const node = data.nodes.find(n => n.id === id)
                              if (!node) return null
                              return (
                                <button
                                  key={id}
                                  onClick={() => setSelectedNode(node)}
                                  className="w-full flex items-center gap-2 hover:bg-muted/50 rounded p-1 transition-colors"
                                >
                                  <span className="w-5 text-center font-bold shrink-0 text-muted-foreground">{i + 1}</span>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-0.5">
                                      <span className="truncate font-medium">{node.first_name} {node.last_name}</span>
                                      <span className="ml-2 shrink-0 text-muted-foreground">{count}</span>
                                    </div>
                                    <div className="h-1 bg-muted rounded-full overflow-hidden">
                                      <div className="h-full bg-blue-400 rounded-full" style={{ width: `${(count / maxW) * 100}%` }} />
                                    </div>
                                  </div>
                                </button>
                              )
                            })
                        })()}
                      </div>
                    </section>
                    <div className="border-t" />
                  </>
                )}

                {/* Reciprocal ranking */}
                <section>
                  <p className="font-semibold text-sm mb-2 flex items-center gap-1.5">
                    <span className="text-green-500">⇄</span> Más relaciones recíprocas
                  </p>
                  <div className="space-y-1">
                    {[...data.nodes]
                      .sort((a, b) => b.reciprocal_count - a.reciprocal_count)
                      .filter(n => n.reciprocal_count > 0)
                      .slice(0, 8)
                      .map((node, i) => {
                        const maxRec = Math.max(...data.nodes.map(n => n.reciprocal_count), 1)
                        return (
                          <button
                            key={node.id}
                            onClick={() => setSelectedNode(node)}
                            className="w-full flex items-center gap-2 hover:bg-muted/50 rounded p-1 transition-colors"
                          >
                            <span className="w-5 text-center font-bold shrink-0 text-muted-foreground">{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="truncate font-medium">{node.first_name} {node.last_name}</span>
                                <span className="ml-2 shrink-0 text-muted-foreground">{node.reciprocal_count}</span>
                              </div>
                              <div className="h-1 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-green-400 rounded-full" style={{ width: `${(node.reciprocal_count / maxRec) * 100}%` }} />
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    {data.nodes.every(n => n.reciprocal_count === 0) && (
                      <p className="text-muted-foreground text-center py-2">Sin relaciones recíprocas detectadas</p>
                    )}
                  </div>
                </section>

                <div className="border-t" />

                {/* At-risk students */}
                <section>
                  <p className="font-semibold text-sm mb-2 flex items-center gap-1.5">
                    <span className="text-red-500">⚠️</span> Alumnos en riesgo social
                  </p>
                  {data.nodes.filter(n => n.is_isolated || n.is_vulnerable).length === 0 ? (
                    <p className="text-green-600 text-xs py-1">✓ Ningún alumno en riesgo detectado</p>
                  ) : (
                    <div className="space-y-1.5">
                      {data.nodes.filter(n => n.is_isolated).map(node => (
                        <button
                          key={node.id}
                          onClick={() => setSelectedNode(node)}
                          className="w-full flex items-center gap-2 bg-red-50 border border-red-200 rounded p-1.5 hover:bg-red-100 transition-colors text-left"
                        >
                          <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                          <span className="flex-1 truncate font-medium text-red-800">{node.first_name} {node.last_name}</span>
                          <span className="text-red-600 font-semibold shrink-0">Aislado</span>
                        </button>
                      ))}
                      {data.nodes.filter(n => !n.is_isolated && n.is_vulnerable).map(node => (
                        <button
                          key={node.id}
                          onClick={() => setSelectedNode(node)}
                          className="w-full flex items-center gap-2 bg-orange-50 border border-orange-200 rounded p-1.5 hover:bg-orange-100 transition-colors text-left"
                        >
                          <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />
                          <span className="flex-1 truncate font-medium text-orange-800">{node.first_name} {node.last_name}</span>
                          <span className="text-orange-600 font-semibold shrink-0">Vulnerable</span>
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                {/* Distribution by class */}
                {classes.length > 1 && (
                  <>
                    <div className="border-t" />
                    <section>
                      <p className="font-semibold text-sm mb-2">Elecciones recibidas por clase</p>
                      {classes.map(cls => {
                        const classNodes = data.nodes.filter(n => n.current_class === cls)
                        const totalReceived = classNodes.reduce((s, n) => s + n.received_count, 0)
                        const avg = classNodes.length > 0 ? totalReceived / classNodes.length : 0
                        const maxAvg = Math.max(...classes.map(c => {
                          const cn = data.nodes.filter(n => n.current_class === c)
                          return cn.length > 0 ? cn.reduce((s, n) => s + n.received_count, 0) / cn.length : 0
                        }), 0.1)
                        return (
                          <div key={cls} className="mb-2">
                            <div className="flex justify-between mb-0.5">
                              <span className="font-medium">{cls}</span>
                              <span className="text-muted-foreground">{avg.toFixed(1)} media</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${(avg / maxAvg) * 100}%` }} />
                            </div>
                            <p className="text-muted-foreground mt-0.5">{classNodes.length} alumnos · {totalReceived} elecciones totales</p>
                          </div>
                        )
                      })}
                    </section>
                  </>
                )}

              </TabsContent>

              {/* Guía tab */}
              <TabsContent value="guide" className="flex-1 overflow-y-auto p-3 mt-0 space-y-4 text-xs">

                <section>
                  <p className="font-semibold text-sm mb-2">Tipos de alumno</p>
                  <div className="space-y-2.5">
                    <div className="flex gap-2">
                      <span className="text-lg leading-none shrink-0">⭐</span>
                      <div>
                        <p className="font-medium">Líder social</p>
                        <p className="text-muted-foreground">Recibe muchas elecciones de compañeros. Alta centralidad. Tiene influencia en el grupo y conecta con varios subgrupos.</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-lg leading-none shrink-0">🔗</span>
                      <div>
                        <p className="font-medium">Alumno puente</p>
                        <p className="text-muted-foreground">Conecta dos o más comunidades distintas. Su presencia es clave para la cohesión global del grupo. Si se aísla, subgrupos quedan desconectados.</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-lg leading-none shrink-0">⚠️</span>
                      <div>
                        <p className="font-medium">Alumno vulnerable</p>
                        <p className="text-muted-foreground">Solo tiene una conexión significativa. Si se separa de ese compañero (p.ej. en la mezcla de clases), quedaría sin vínculos. Requiere atención especial.</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-lg leading-none shrink-0">🔴</span>
                      <div>
                        <p className="font-medium">Alumno aislado</p>
                        <p className="text-muted-foreground">Sin elecciones recibidas o sin ninguna relación recíproca. No pertenece a ningún subgrupo visible. Puede indicar exclusión o dificultades de integración.</p>
                      </div>
                    </div>
                  </div>
                </section>

                <div className="border-t" />

                <section>
                  <p className="font-semibold text-sm mb-2">Métricas individuales</p>
                  <div className="space-y-2">
                    <div>
                      <p className="font-medium">Elecciones recibidas</p>
                      <p className="text-muted-foreground">Cuántos compañeros han elegido a este alumno. El tamaño del nodo en el grafo lo representa.</p>
                    </div>
                    <div>
                      <p className="font-medium">Elecciones realizadas</p>
                      <p className="text-muted-foreground">Cuántos compañeros ha elegido este alumno. No implica reciprocidad.</p>
                    </div>
                    <div>
                      <p className="font-medium">Relaciones recíprocas</p>
                      <p className="text-muted-foreground">Elecciones mutuas: A elige a B y B elige a A. Son los vínculos más sólidos y los más importantes para preservar en la mezcla.</p>
                    </div>
                    <div>
                      <p className="font-medium">Centralidad</p>
                      <p className="text-muted-foreground">Importancia del alumno dentro de la red. Un valor alto significa que está bien conectado con alumnos que a su vez están bien conectados.</p>
                    </div>
                    <div>
                      <p className="font-medium">Intermediación</p>
                      <p className="text-muted-foreground">Mide cuántas veces el alumno actúa como paso entre otros dos. Alta intermediación = posible alumno puente.</p>
                    </div>
                  </div>
                </section>

                <div className="border-t" />

                <section>
                  <p className="font-semibold text-sm mb-2">Métricas de grupo</p>
                  <div className="space-y-2">
                    <div>
                      <p className="font-medium">Cohesión</p>
                      <p className="text-muted-foreground">Nivel de conexión global del grupo. Alta cohesión = grupo bien integrado. Baja = muchos alumnos desconectados o subgrupos cerrados.</p>
                    </div>
                    <div>
                      <p className="font-medium">Densidad de red</p>
                      <p className="text-muted-foreground">Porcentaje de relaciones existentes sobre el total posible. Un grupo de 30 alumnos podría tener 870 relaciones posibles; la densidad indica cuántas existen.</p>
                    </div>
                    <div>
                      <p className="font-medium">Reciprocidad</p>
                      <p className="text-muted-foreground">Porcentaje de elecciones que son mutuas sobre el total de elecciones. Un grupo con alta reciprocidad tiene relaciones más estables.</p>
                    </div>
                  </div>
                </section>

                <div className="border-t" />

                <section>
                  <p className="font-semibold text-sm mb-2">Tipos de relación (conexiones)</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-0 border-t-2 border-pink-400 shrink-0" />
                      <p className="text-muted-foreground"><span className="font-medium text-foreground">Amistad unilateral</span> — A elige a B pero B no elige a A.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-0 border-t-4 border-pink-600 shrink-0" />
                      <p className="text-muted-foreground"><span className="font-medium text-foreground">Amistad recíproca</span> — Elección mutua. Línea más gruesa.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-0 border-t-2 border-blue-400 shrink-0" />
                      <p className="text-muted-foreground"><span className="font-medium text-foreground">Relación de trabajo</span> — Trabajan bien juntos en clase.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-0 border-t-2 border-red-400 border-dashed shrink-0" />
                      <p className="text-muted-foreground"><span className="font-medium text-foreground">Conflicto / regla de separación</span> — No deben compartir clase.</p>
                    </div>
                  </div>
                </section>

                <div className="border-t" />

                <section>
                  <p className="font-semibold text-sm mb-2">Colores por riesgo social</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500 shrink-0" />
                      <p className="text-muted-foreground">Sin riesgo — Bien integrado en el grupo.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-amber-400 shrink-0" />
                      <p className="text-muted-foreground">Riesgo moderado — Pocas conexiones o vínculos débiles.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
                      <p className="text-muted-foreground">Riesgo alto — Aislado o muy vulnerable. Requiere atención.</p>
                    </div>
                  </div>
                </section>

                <div className="border-t" />

                <section>
                  <p className="font-semibold text-sm mb-2">Comunidades detectadas</p>
                  <p className="text-muted-foreground">El algoritmo agrupa automáticamente a los alumnos en comunidades según sus relaciones (algoritmo de Louvain). Cada color representa un subgrupo que se relaciona más entre sí que con el resto. Un subgrupo cerrado de muchos alumnos puede dificultar la integración general.</p>
                </section>

                <div className="border-t" />

                <section>
                  <p className="font-semibold text-sm mb-2">Alertas</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                      <p className="text-muted-foreground"><span className="font-medium text-foreground">Alta severidad</span> — Situación que requiere intervención: aislamiento, conflicto activo.</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />
                      <p className="text-muted-foreground"><span className="font-medium text-foreground">Media</span> — Situación a vigilar: vulnerabilidad, subgrupo cerrado.</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                      <p className="text-muted-foreground"><span className="font-medium text-foreground">Informativa</span> — Observación útil para la mezcla: alumnos puente, grupos dominantes.</p>
                    </div>
                  </div>
                </section>

                <p className="text-muted-foreground/60 text-[10px] leading-relaxed pt-1">
                  El sociograma es una herramienta orientativa. Los datos deben interpretarse siempre en contexto y con criterio docente. No sustituye la observación directa del equipo educativo.
                </p>

              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  )
}
