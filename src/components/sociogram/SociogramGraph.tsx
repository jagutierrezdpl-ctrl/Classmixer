"use client"

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import type { SociogramData, SociogramNode } from "@/types"

export type SociogramColorBy = "class" | "gender" | "level" | "community" | "isolation" | "behavior"
export type SociogramLayout = "cose" | "circle" | "concentric" | "breadthfirst" | "grid"

export interface SociogramFilter {
  classFilter: string | null
  showOnlyIsolated: boolean
  showOnlyReciprocal: boolean
  relationType: "all" | "friendship" | "work" | "emotional" | "negative"
}

interface SociogramGraphProps {
  data: SociogramData
  colorBy?: SociogramColorBy
  layout?: SociogramLayout
  filter?: Partial<SociogramFilter>
  onNodeClick?: (node: SociogramNode) => void
}

export interface SociogramGraphHandle {
  exportPNG: () => void
}

const GENDER_COLORS: Record<string, string> = {
  F: "#ec4899",
  M: "#3b82f6",
  Otro: "#8b5cf6",
  "No especificado": "#94a3b8",
}

const LEVEL_COLORS: Record<string, string> = {
  Alto: "#22c55e",
  "Medio-alto": "#84cc16",
  Medio: "#eab308",
  "Medio-bajo": "#f97316",
  Bajo: "#ef4444",
}

const BEHAVIOR_COLORS: Record<string, string> = {
  Positiva: "#22c55e",
  Normal: "#64748b",
  Seguimiento: "#f97316",
  Conflictiva: "#ef4444",
}

export const COMMUNITY_PALETTE = [
  "#3b82f6", "#22c55e", "#f97316", "#ec4899", "#8b5cf6",
  "#06b6d4", "#f59e0b", "#10b981", "#6366f1", "#84cc16",
  "#14b8a6", "#a855f7",
]

const CLASS_PALETTE = [
  "#3b82f6", "#ec4899", "#22c55e", "#f97316", "#8b5cf6",
  "#06b6d4", "#84cc16", "#f59e0b", "#ef4444", "#6366f1",
]

export const SociogramGraph = forwardRef<SociogramGraphHandle, SociogramGraphProps>(
  function SociogramGraph({ data, colorBy = "class", layout = "cose", filter, onNodeClick }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cyRef = useRef<any>(null)
    const [selectedNode, setSelectedNode] = useState<SociogramNode | null>(null)

    const classes = [...new Set(data.nodes.map(n => n.current_class))].sort()
    const classColorMap = Object.fromEntries(classes.map((c, i) => [c, CLASS_PALETTE[i % CLASS_PALETTE.length]]))

    function getNodeColor(node: SociogramNode): string {
      switch (colorBy) {
        case "gender": return GENDER_COLORS[node.gender] ?? "#94a3b8"
        case "class": return classColorMap[node.current_class] ?? "#94a3b8"
        case "level": return node.academic_level ? (LEVEL_COLORS[node.academic_level] ?? "#94a3b8") : "#94a3b8"
        case "community": return COMMUNITY_PALETTE[(node.community_id ?? 0) % COMMUNITY_PALETTE.length]
        case "behavior": return node.behavior_level ? (BEHAVIOR_COLORS[node.behavior_level] ?? "#94a3b8") : "#94a3b8"
        case "isolation":
          if (node.is_isolated) return "#ef4444"
          if (node.is_vulnerable) return "#f97316"
          if (node.is_leader) return "#f59e0b"
          if (node.is_bridge) return "#6366f1"
          return "#22c55e"
        default: return "#3b82f6"
      }
    }

    useImperativeHandle(ref, () => ({
      exportPNG() {
        if (!cyRef.current) return
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const png: any = cyRef.current.png({ output: "blob", bg: "white", full: true, scale: 2 })
          const url = URL.createObjectURL(png)
          const a = document.createElement("a")
          a.href = url
          a.download = "sociograma.png"
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          setTimeout(() => URL.revokeObjectURL(url), 100)
        } catch { /* no-op */ }
      },
    }))

    useEffect(() => {
      if (!containerRef.current) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let cy: any = null

      const loadCytoscape = async () => {
        const Cytoscape = (await import("cytoscape")).default
        const fcose = (await import("cytoscape-fcose")).default
        try { Cytoscape["use"](fcose) } catch { /* already registered on HMR reload */ }
        const maxReceived = Math.max(...data.nodes.map(n => n.received_count), 1)

        // Apply filters
        const f: SociogramFilter = {
          classFilter: filter?.classFilter ?? null,
          showOnlyIsolated: filter?.showOnlyIsolated ?? false,
          showOnlyReciprocal: filter?.showOnlyReciprocal ?? false,
          relationType: filter?.relationType ?? "all",
        }

        let visibleNodes = data.nodes
        if (f.classFilter) visibleNodes = visibleNodes.filter(n => n.current_class === f.classFilter)
        if (f.showOnlyIsolated) visibleNodes = visibleNodes.filter(n => n.is_isolated || n.is_vulnerable)
        const visibleIds = new Set(visibleNodes.map(n => n.id))

        let visibleEdges = data.edges.filter(e => visibleIds.has(e.source) && visibleIds.has(e.target))
        if (f.showOnlyReciprocal) visibleEdges = visibleEdges.filter(e => e.is_reciprocal)
        if (f.relationType !== "all") visibleEdges = visibleEdges.filter(e => e.relation_type === f.relationType)

        const elements = [
          ...visibleNodes.map(node => {
            const size = 16 + (node.received_count / maxReceived) * 22
            const borderWidth = node.is_isolated ? 3 : node.is_vulnerable ? 2.5 : node.is_leader ? 3.5 : node.is_bridge ? 2.5 : 0
            const borderColor = node.is_isolated ? "#ef4444" : node.is_vulnerable ? "#f97316" : node.is_leader ? "#f59e0b" : node.is_bridge ? "#6366f1" : "transparent"
            return {
              data: {
                id: node.id,
                label: node.first_name,
                node,
                bgColor: getNodeColor(node),
                size,
                borderWidth,
                borderColor,
                isVulnerable: node.is_vulnerable ? true : undefined,
              },
            }
          }),
          ...visibleEdges.map(edge => ({
            data: {
              id: edge.id,
              source: edge.source,
              target: edge.target,
              relation_type: edge.relation_type,
              reciprocal: edge.is_reciprocal ? "true" : "false",
            },
          })),
        ]

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const layoutConfigs: Record<string, any> = {
          // fcose: Fast Compound Spring Embedder — handles variable node sizes correctly
          cose: {
            name: "fcose",
            animate: false,
            randomize: true,
            quality: "proof",
            nodeSeparation: 75,
            idealEdgeLength: 120,
            edgeElasticity: 0.45,
            gravity: 0.25,
            gravityRange: 3.8,
            gravityCompound: 1.0,
            gravityRangeCompound: 1.5,
            numIter: 2500,
            tilingPaddingVertical: 10,
            tilingPaddingHorizontal: 10,
            initialEnergyOnIncremental: 0.3,
            padding: 50,
          },
          circle: { name: "circle", padding: 60, animate: false, spacingFactor: 1.5 },
          concentric: {
            name: "concentric", animate: false, padding: 40,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            concentric: (node: any) => (node.data("node") as SociogramNode).received_count + (node.data("node") as SociogramNode).reciprocal_count,
            levelWidth: () => 2,
            minNodeSpacing: 40,
            spacingFactor: 1.8,
          },
          breadthfirst: { name: "breadthfirst", animate: false, directed: false, padding: 40, spacingFactor: 1.6 },
          grid: { name: "grid", animate: false, padding: 40, spacingFactor: 1.3 },
        }

        cy = Cytoscape({
          container: containerRef.current,
          elements,
          style: [
            {
              selector: "node",
              style: {
                label: "data(label)",
                "font-size": 10,
                "text-valign": "bottom",
                "text-margin-y": 4,
                color: "#1e293b",
                "text-background-color": "#ffffff",
                "text-background-opacity": 0.9,
                "text-background-padding": "2px",
                "text-background-shape": "roundrectangle",
                "background-color": "data(bgColor)",
                width: "data(size)",
                height: "data(size)",
                "border-width": "data(borderWidth)",
                "border-color": "data(borderColor)",
              },
            },
            { selector: "node:selected", style: { "border-width": 4, "border-color": "#2563eb", "border-style": "solid" } },
            { selector: "node[?isVulnerable]", style: { "border-style": "dashed" } },
            {
              selector: "edge[relation_type='friendship'][reciprocal='false']",
              style: { "line-color": "#93c5fd", width: 1.5, "curve-style": "bezier", "target-arrow-shape": "triangle", "target-arrow-color": "#93c5fd", opacity: 0.55 },
            },
            {
              selector: "edge[relation_type='friendship'][reciprocal='true']",
              style: { "line-color": "#2563eb", width: 3, "curve-style": "bezier", opacity: 0.8 },
            },
            {
              selector: "edge[relation_type='work']",
              style: { "line-color": "#4ade80", "line-style": "dashed", width: 1.5, "curve-style": "bezier", "target-arrow-shape": "triangle", "target-arrow-color": "#4ade80", opacity: 0.6 },
            },
            {
              selector: "edge[relation_type='emotional']",
              style: { "line-color": "#c4b5fd", "line-style": "dotted", width: 2, "curve-style": "bezier", opacity: 0.55 },
            },
            {
              selector: "edge[relation_type='negative']",
              style: { "line-color": "#fca5a5", "line-style": "dashed", width: 1.2, "curve-style": "bezier", "target-arrow-shape": "triangle", "target-arrow-color": "#fca5a5", opacity: 0.5 },
            },
          ],
          layout: layoutConfigs[layout] ?? layoutConfigs.cose,
        })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cy.on("tap", "node", (evt: any) => {
          const nodeData = evt.target.data("node") as SociogramNode
          setSelectedNode(nodeData)
          onNodeClick?.(nodeData)
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cy.on("tap", (evt: any) => { if (evt.target === cy) setSelectedNode(null) })

        cyRef.current = cy
      }

      loadCytoscape()
      return () => { cyRef.current?.destroy(); cyRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data, colorBy, layout, filter])

    return (
      <div className="relative w-full h-full">
        <div ref={containerRef} className="w-full h-full" />

        {selectedNode && (
          <div className="absolute top-4 right-4 w-60 bg-card border rounded-xl shadow-lg p-4 text-sm z-10">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-semibold">{selectedNode.first_name} {selectedNode.last_name}</p>
                <p className="text-xs text-muted-foreground">{selectedNode.current_class}</p>
              </div>
              <div className="flex flex-col gap-0.5 items-end">
                {selectedNode.is_isolated && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">Aislado</span>}
                {selectedNode.is_vulnerable && <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-medium">Vulnerable</span>}
                {selectedNode.is_leader && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">Líder</span>}
                {selectedNode.is_bridge && <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-medium">Puente</span>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs border-t pt-2">
              <span className="text-muted-foreground">Elec. recibidas</span><span className="font-medium text-right">{selectedNode.received_count}</span>
              <span className="text-muted-foreground">Elec. dadas</span><span className="font-medium text-right">{selectedNode.given_count}</span>
              <span className="text-muted-foreground">Recíprocas</span><span className="font-medium text-right">{selectedNode.reciprocal_count}</span>
              <span className="text-muted-foreground">Centralidad</span><span className="font-medium text-right">{(selectedNode.centrality * 100).toFixed(0)}%</span>
              <span className="text-muted-foreground">Intermediación</span><span className="font-medium text-right">{(selectedNode.betweenness * 100).toFixed(1)}%</span>
              {selectedNode.academic_level && <><span className="text-muted-foreground">Nivel</span><span className="font-medium text-right">{selectedNode.academic_level}</span></>}
              {selectedNode.behavior_level && <><span className="text-muted-foreground">Conducta</span><span className="font-medium text-right">{selectedNode.behavior_level}</span></>}
              {selectedNode.needs_type && selectedNode.needs_type !== "No" && <><span className="text-muted-foreground">Nec. educativas</span><span className="font-medium text-right">{selectedNode.needs_type}</span></>}
            </div>
            {typeof selectedNode.community_id === "number" && (
              <div className="mt-2 pt-2 border-t flex items-center gap-2">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COMMUNITY_PALETTE[selectedNode.community_id % COMMUNITY_PALETTE.length] }} />
                <span className="text-xs text-muted-foreground">Grupo {selectedNode.community_id + 1}</span>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }
)
