"use client"

import { useEffect, useRef } from "react"
import { DEMO_NODES, DEMO_EDGES } from "./demo-data"

const COMMUNITY_PALETTE = [
  "#3b82f6", "#22c55e", "#f97316", "#ec4899", "#8b5cf6",
  "#06b6d4", "#f59e0b", "#10b981", "#6366f1", "#94a3b8",
]

interface CytoscapeInstance {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

export default function DemoSociogram() {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<CytoscapeInstance | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const load = async () => {
      const Cytoscape = (await import("cytoscape")).default
      const fcose = (await import("cytoscape-fcose")).default
      try { Cytoscape["use"](fcose) } catch { /* already registered */ }

      const maxReceived = Math.max(...DEMO_NODES.map(n => n.received_count), 1)

      const elements = [
        ...DEMO_NODES.map(node => {
          const size = 18 + (node.received_count / maxReceived) * 24
          const bgColor = COMMUNITY_PALETTE[(node.community_id ?? 0) % COMMUNITY_PALETTE.length]
          const borderColor = node.is_isolated ? "#ef4444" : node.is_vulnerable ? "#f97316" : node.is_leader ? "#f59e0b" : node.is_bridge ? "#6366f1" : "transparent"
          const borderWidth = node.is_isolated ? 3.5 : node.is_vulnerable ? 2.5 : node.is_leader ? 4 : node.is_bridge ? 2.5 : 0
          return { data: { id: node.id, label: node.first_name, bgColor, size, borderColor, borderWidth } }
        }),
        ...DEMO_EDGES.map(e => ({
          data: { id: e.id, source: e.source, target: e.target, relation_type: e.relation_type, reciprocal: e.is_reciprocal ? "true" : "false" },
        })),
      ]

      const cy = Cytoscape({
        container: containerRef.current,
        elements,
        style: [
          {
            selector: "node",
            style: {
              label: "data(label)", "font-size": 10, "text-valign": "bottom", "text-margin-y": 4,
              color: "#1e293b", "text-background-color": "#ffffff", "text-background-opacity": 0.9,
              "text-background-padding": "2px", "text-background-shape": "roundrectangle",
              "background-color": "data(bgColor)", width: "data(size)", height: "data(size)",
              "border-width": "data(borderWidth)", "border-color": "data(borderColor)",
            },
          },
          { selector: "edge[relation_type='friendship'][reciprocal='false']", style: { "line-color": "#93c5fd", width: 1.5, "curve-style": "bezier", "target-arrow-shape": "triangle", "target-arrow-color": "#93c5fd", opacity: 0.55 } },
          { selector: "edge[relation_type='friendship'][reciprocal='true']",  style: { "line-color": "#2563eb", width: 3,   "curve-style": "bezier", opacity: 0.8 } },
          { selector: "edge[relation_type='work']",                           style: { "line-color": "#4ade80", "line-style": "dashed", width: 1.5, "curve-style": "bezier", "target-arrow-shape": "triangle", "target-arrow-color": "#4ade80", opacity: 0.6 } },
        ],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        layout: { name: "fcose", animate: false, padding: 40, quality: "proof", nodeSeparation: 80, idealEdgeLength: 90 } as any,
        userZoomingEnabled: false,
        userPanningEnabled: false,
        boxSelectionEnabled: false,
      })

      cyRef.current = cy
    }

    load()
    return () => { cyRef.current?.destroy(); cyRef.current = null }
  }, [])

  return <div ref={containerRef} className="w-full h-full" />
}
