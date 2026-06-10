"use client"

import { useEffect, useRef } from "react"
import type { Student, Response } from "@/types"

interface Props {
  students: Student[]
  responses: Response[]
}

const GENDER_COLORS: Record<string, string> = {
  F: "#ec4899",
  M: "#3b82f6",
  Otro: "#8b5cf6",
  "No especificado": "#94a3b8",
}

export default function ClassSimulationGraph({ students, responses }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cyRef = useRef<any>(null)

  useEffect(() => {
    if (!containerRef.current || students.length === 0) return

    let destroyed = false
    async function init() {
      const Cytoscape = (await import("cytoscape")).default
      const fcose = (await import("cytoscape-fcose")).default
      try { Cytoscape["use"](fcose) } catch { /* already registered */ }

      if (destroyed || !containerRef.current) return

      const ids = new Set(students.map(s => s.id))

      // Build received counts
      const receivedCount = new Map<string, number>()
      for (const s of students) receivedCount.set(s.id, 0)
      for (const r of responses) {
        if (ids.has(r.target_student_id)) {
          receivedCount.set(r.target_student_id, (receivedCount.get(r.target_student_id) ?? 0) + 1)
        }
      }

      const maxReceived = Math.max(1, ...Array.from(receivedCount.values()))

      const nodes = students.map(s => {
        const received = receivedCount.get(s.id) ?? 0
        const size = 20 + (received / maxReceived) * 20
        const isIsolated = received === 0 && !responses.some(r => r.respondent_student_id === s.id && ids.has(r.target_student_id))
        return {
          data: {
            id: s.id,
            label: `${s.first_name} ${s.last_name?.charAt(0)}.`,
            size,
            bgColor: isIsolated ? "#ef4444" : (GENDER_COLORS[s.gender ?? ""] ?? "#94a3b8"),
            borderColor: isIsolated ? "#b91c1c" : "#ffffff",
            borderWidth: isIsolated ? 2 : 1,
          },
        }
      })

      // Build edges (friendship only, within class)
      const edgeSet = new Set<string>()
      const edges: { data: { id: string; source: string; target: string; mutual: boolean } }[] = []
      for (const r of responses) {
        if (!ids.has(r.respondent_student_id) || !ids.has(r.target_student_id)) continue
        const mutual = responses.some(
          r2 => r2.respondent_student_id === r.target_student_id && r2.target_student_id === r.respondent_student_id
        )
        const edgeKey = [r.respondent_student_id, r.target_student_id].sort().join("-")
        if (edgeSet.has(edgeKey) && mutual) continue
        edgeSet.add(edgeKey)
        edges.push({
          data: {
            id: `e-${r.respondent_student_id}-${r.target_student_id}`,
            source: r.respondent_student_id,
            target: r.target_student_id,
            mutual,
          },
        })
      }

      if (cyRef.current) { cyRef.current.destroy(); cyRef.current = null }
      if (destroyed || !containerRef.current) return

      cyRef.current = Cytoscape({
        container: containerRef.current,
        elements: [...nodes, ...edges],
        style: [
          {
            selector: "node",
            style: {
              width: "data(size)",
              height: "data(size)",
              "background-color": "data(bgColor)",
              "border-color": "data(borderColor)",
              "border-width": "data(borderWidth)",
              label: "data(label)",
              "font-size": 9,
              "text-valign": "bottom",
              "text-margin-y": 4,
              color: "#374151",
            },
          },
          {
            selector: "edge[?mutual]",
            style: {
              width: 2,
              "line-color": "#6366f1",
              "target-arrow-color": "#6366f1",
              "target-arrow-shape": "none",
              opacity: 0.8,
            },
          },
          {
            selector: "edge[!mutual]",
            style: {
              width: 1,
              "line-color": "#cbd5e1",
              "target-arrow-color": "#cbd5e1",
              "target-arrow-shape": "triangle",
              opacity: 0.5,
              "curve-style": "bezier",
            },
          },
        ],
        layout: {
          name: "fcose",
          quality: "proof",
          nodeSeparation: 60,
          idealEdgeLength: 100,
          edgeElasticity: 0.45,
          numIter: 2500,
          animate: false,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      })
    }

    init()
    return () => {
      destroyed = true
      if (cyRef.current) { cyRef.current.destroy(); cyRef.current = null }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students.map(s => s.id).join(","), responses.length])

  return <div ref={containerRef} className="w-full h-full" />
}
