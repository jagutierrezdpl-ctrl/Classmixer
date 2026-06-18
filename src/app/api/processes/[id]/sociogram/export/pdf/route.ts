/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, hasFullAccess, tutorCanAccessProcess, logAudit } from "@/lib/auth"
import { NextResponse } from "next/server"
import React from "react"
import { Document, Page, Text, View, Svg, Circle, Line, renderToBuffer } from "@react-pdf/renderer"
import { calculateSociogram } from "@/lib/sociogram/calculate"
import { pdfStyles, formatDate, ALERT_STYLE_BY_SEVERITY, PdfLogoRow } from "@/lib/pdf/shared"
import { getQuestionCatalogIndex } from "@/lib/questionnaire/catalog"
import { filterVisibleResponses } from "@/lib/questionnaire/visibility"
import type { UserRole } from "@/types"

const COMMUNITY_COLORS = ["#2563eb", "#16a34a", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#db2777", "#65a30d", "#ea580c", "#4338ca"]

const CX = 260
const CY = 200
const RADIUS = 165

function layout(nodes: ReturnType<typeof calculateSociogram>["nodes"]) {
  const n = nodes.length
  return nodes.map((node, i) => {
    const angle = (2 * Math.PI * i) / Math.max(n, 1) - Math.PI / 2
    return {
      node,
      x: CX + RADIUS * Math.cos(angle),
      y: CY + RADIUS * Math.sin(angle),
      index: i + 1,
    }
  })
}

function SociogramGraph({ soc }: { soc: ReturnType<typeof calculateSociogram> }) {
  const positions = layout(soc.nodes)
  const posById = new Map(positions.map(p => [p.node.id, p]))
  const friendshipEdges = soc.edges.filter(e => e.relation_type === "friendship")

  return React.createElement(Svg, { width: "100%", height: 400, viewBox: "0 0 520 400" } as any,
    ...friendshipEdges.map(e => {
      const a = posById.get(e.source)
      const b = posById.get(e.target)
      if (!a || !b) return null
      return React.createElement(Line, {
        key: e.id,
        x1: a.x, y1: a.y, x2: b.x, y2: b.y,
        stroke: e.is_reciprocal ? "#1e40af" : "#cbd5e1",
        strokeWidth: e.is_reciprocal ? 1.6 : 0.6,
      } as any)
    }),
    ...positions.map(p => {
      const r = 7 + Math.min(p.node.received_count, 10) * 1.1
      const isRechazado = p.node.sociometric_status === "rechazado"
      const color = COMMUNITY_COLORS[(p.node.community_id ?? 0) % COMMUNITY_COLORS.length]
      // Node fill priority: isolated=red, rechazado=dark-red, default=community color
      const fill = p.node.is_isolated ? "#f87171" : isRechazado ? "#7f1d1d" : color
      // Border priority: bullying risk=bright red, bridge=yellow, vulnerable=orange
      const isBullyingRisk = isRechazado && (p.node.rejection_received_count ?? 0) >= 5
      const stroke = isBullyingRisk ? "#dc2626" : p.node.is_bridge ? "#f59e0b" : (p.node.is_vulnerable && !isRechazado) ? "#fb923c" : "#ffffff"
      const strokeWidth = (isBullyingRisk || p.node.is_bridge || p.node.is_vulnerable) ? 2.5 : 1
      return React.createElement(React.Fragment, { key: p.node.id },
        React.createElement(Circle, {
          cx: p.x, cy: p.y, r, fill, stroke, strokeWidth,
        } as any),
        React.createElement(Text, {
          x: p.x, y: p.y + 3,
          style: { fontSize: 7, fill: "#ffffff", textAnchor: "middle" } as any,
        } as any, String(p.index)),
      )
    }),
  )
}

function nameOf(s: any): string {
  return s ? `${s.first_name} ${s.last_name}` : "Alumno desconocido"
}

const CDC_STATUS_LABEL: Record<string, string> = {
  popular: "Popular",
  rechazado: "Rechazado",
  ignorado: "Ignorado",
  controvertido: "Controvertido",
  promedio: "Promedio",
}

const CDC_STATUS_COLOR: Record<string, string> = {
  popular: "#16a34a",
  rechazado: "#dc2626",
  ignorado: "#64748b",
  controvertido: "#d97706",
  promedio: "#2563eb",
}

function SociogramaPDF({ process, soc, positions, studentMap, logoUrl }: {
  process: any
  soc: ReturnType<typeof calculateSociogram>
  positions: ReturnType<typeof layout>
  studentMap: Map<string, any>
  logoUrl?: string | null
}) {
  const mostChosen = [...soc.nodes].sort((a, b) => b.received_count - a.received_count).slice(0, 8)
  const leastChosen = soc.nodes.filter(n => !n.is_isolated).sort((a, b) => a.received_count - b.received_count).slice(0, 8)
  const reciprocalPairs = soc.edges.filter(e => e.relation_type === "friendship" && e.is_reciprocal)
  const bridges = soc.nodes.filter(n => n.is_bridge).sort((a, b) => b.betweenness - a.betweenness)
  const rechazados = soc.nodes.filter(n => n.sociometric_status === "rechazado").sort((a, b) => (b.rejection_received_count ?? 0) - (a.rejection_received_count ?? 0))
  const bullyingRisk = rechazados.filter(n => (n.rejection_received_count ?? 0) >= 5)
  const hasCdc = soc.metrics.has_rejection_data

  const footer = React.createElement(View, { style: pdfStyles.footer, fixed: true },
    React.createElement(Text, { style: pdfStyles.footerText }, "ClassMixer · Informe de sociograma — uso interno"),
    React.createElement(Text, {
      style: pdfStyles.footerText,
      render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `Pág. ${pageNumber} / ${totalPages}`,
    }),
  )

  return React.createElement(Document, null,

    // ── PAGE 1: header + metrics cards + sociogram graph ──────────────────────
    React.createElement(Page, { size: "A4", style: pdfStyles.page },
      React.createElement(PdfLogoRow, { logoUrl }),
      React.createElement(View, { style: pdfStyles.header },
        React.createElement(Text, { style: pdfStyles.title }, "Informe de sociograma"),
        React.createElement(Text, { style: pdfStyles.subtitle }, `${process.name} · ${process.school_year} · ${formatDate()}`),
      ),

      React.createElement(Text, { style: pdfStyles.sectionTitle }, "Métricas sociales"),
      React.createElement(View, { style: pdfStyles.summaryGrid },
        React.createElement(View, { style: pdfStyles.summaryCard },
          React.createElement(Text, { style: pdfStyles.summaryValue }, String(soc.metrics.total_students)),
          React.createElement(Text, { style: pdfStyles.summaryLabel }, "Alumnos")),
        React.createElement(View, { style: pdfStyles.summaryCard },
          React.createElement(Text, { style: pdfStyles.summaryValue }, String(soc.metrics.isolated_count)),
          React.createElement(Text, { style: pdfStyles.summaryLabel }, "Aislados")),
        React.createElement(View, { style: pdfStyles.summaryCard },
          React.createElement(Text, { style: pdfStyles.summaryValue }, String(soc.metrics.reciprocal_pairs)),
          React.createElement(Text, { style: pdfStyles.summaryLabel }, "Parejas recíprocas")),
        React.createElement(View, { style: pdfStyles.summaryCard },
          React.createElement(Text, { style: pdfStyles.summaryValue }, String(soc.metrics.communities_count)),
          React.createElement(Text, { style: pdfStyles.summaryLabel }, "Subgrupos")),
        React.createElement(View, { style: pdfStyles.summaryCard },
          React.createElement(Text, { style: pdfStyles.summaryValue }, soc.metrics.density.toFixed(2)),
          React.createElement(Text, { style: pdfStyles.summaryLabel }, "Densidad de red")),
        React.createElement(View, { style: pdfStyles.summaryCard },
          React.createElement(Text, { style: pdfStyles.summaryValue }, (soc.metrics.group_cohesion * 100).toFixed(1) + "%"),
          React.createElement(Text, { style: pdfStyles.summaryLabel }, "Cohesión grupal (IAg)")),
        React.createElement(View, { style: pdfStyles.summaryCard },
          React.createElement(Text, { style: pdfStyles.summaryValue }, String(bridges.length)),
          React.createElement(Text, { style: pdfStyles.summaryLabel }, "Alumnos puente")),
      ),

      // CDC distribution cards (only when rejection data exists)
      hasCdc
        ? React.createElement(React.Fragment, null,
            React.createElement(Text, { style: pdfStyles.sectionTitle }, "Clasificación sociométrica CDC (Coie-Dodge)"),
            React.createElement(View, { style: pdfStyles.summaryGrid },
              ...(["popular", "rechazado", "ignorado", "controvertido", "promedio"] as const).map(s =>
                React.createElement(View, {
                  key: s,
                  style: [pdfStyles.summaryCard, { borderTop: `3pt solid ${CDC_STATUS_COLOR[s]}` }],
                },
                  React.createElement(Text, {
                    style: [pdfStyles.summaryValue, { color: CDC_STATUS_COLOR[s] }],
                  }, String(s === "popular" ? soc.metrics.popular_count :
                             s === "rechazado" ? soc.metrics.rejected_count :
                             s === "ignorado" ? soc.metrics.neglected_count :
                             s === "controvertido" ? soc.metrics.controversial_count :
                             soc.metrics.average_count)),
                  React.createElement(Text, { style: pdfStyles.summaryLabel }, CDC_STATUS_LABEL[s]),
                )
              )
            ),
          )
        : null,

      // Bullying risk URGENT alert — only when data exists and risk students detected
      bullyingRisk.length > 0
        ? React.createElement(View, {
            style: { backgroundColor: "#fef2f2", border: "2pt solid #dc2626", borderRadius: 5, padding: 10, marginBottom: 8 },
          },
            React.createElement(Text, { style: { fontSize: 10, fontWeight: "bold", color: "#b91c1c", marginBottom: 4 } },
              `⚠ RIESGO DE EXCLUSIÓN SEVERA — ${bullyingRisk.length} ALUMNO(S)`),
            React.createElement(Text, { style: { fontSize: 9, color: "#7f1d1d", marginBottom: 5 } },
              "Los siguientes alumnos reciben ≥5 nominaciones de rechazo activo (criterio de riesgo de acoso escolar). " +
              "Su perfil es distinto al del alumno tímido o aislado: son activamente excluidos por el grupo. Ver análisis en pág. 3."),
            ...bullyingRisk.map(n =>
              React.createElement(Text, { key: n.id, style: { fontSize: 9, color: "#b91c1c", marginBottom: 2 } },
                `· ${n.label} (${n.current_class ?? "—"}) — ${n.rejection_received_count} rechazos · ${n.received_count} positivo(s) · zSP=${n.social_preference_z?.toFixed(2) ?? "—"}`)
            ),
          )
        : null,

      React.createElement(Text, { style: pdfStyles.sectionTitle }, "Grafo de relaciones de amistad"),
      React.createElement(SociogramGraph, { soc }),
      React.createElement(Text, { style: { fontSize: 8, color: "#64748b", marginTop: 4 } },
        "Nodo burdeos = rechazado activo (CDC) · Nodo rojo claro = aislado · Borde rojo = riesgo acoso (≥5 rechazos) · Borde amarillo = puente · Borde naranja = vulnerable"),

      footer,
    ),

    // ── PAGE 2: legend + ranked lists + communities + alerts ──────────────────
    React.createElement(Page, { size: "A4", style: pdfStyles.page },

      React.createElement(Text, { style: pdfStyles.sectionTitle }, "Leyenda del grafo"),
      React.createElement(View, { style: pdfStyles.tableHeader },
        React.createElement(Text, { style: [pdfStyles.thCell, { flex: 0.5 }] }, "Nº"),
        React.createElement(Text, { style: [pdfStyles.thCell, { flex: 2.5 }] }, "Alumno"),
        React.createElement(Text, { style: [pdfStyles.thCell, { flex: 1 }] }, "Clase"),
        React.createElement(Text, { style: [pdfStyles.thCell, { flex: 0.8 }] }, "Rec."),
        React.createElement(Text, { style: [pdfStyles.thCell, { flex: 1 }] }, "Estado"),
      ),
      ...positions.map(p =>
        React.createElement(View, { key: p.node.id, wrap: false, style: pdfStyles.tableRow },
          React.createElement(Text, { style: [pdfStyles.tdCell, { flex: 0.5 }] }, String(p.index)),
          React.createElement(Text, { style: [pdfStyles.tdCell, { flex: 2.5 }] }, p.node.label),
          React.createElement(Text, { style: [pdfStyles.tdCell, { flex: 1 }] }, p.node.current_class ?? "—"),
          React.createElement(Text, { style: [pdfStyles.tdCell, { flex: 0.8 }] }, String(p.node.received_count)),
          React.createElement(Text, {
            style: [pdfStyles.tdCell, { flex: 1, color: CDC_STATUS_COLOR[p.node.sociometric_status ?? ""] ?? "#334155" }],
          }, CDC_STATUS_LABEL[p.node.sociometric_status ?? ""] ?? "—"),
        )
      ),

      React.createElement(Text, { style: pdfStyles.sectionTitle }, "Alumnos más elegidos"),
      ...mostChosen.map(n =>
        React.createElement(Text, { key: n.id, style: { fontSize: 9, marginBottom: 3 } },
          `· ${n.label} — ${n.received_count} elección(es) recibida(s)`)
      ),

      React.createElement(Text, { style: pdfStyles.sectionTitle }, "Alumnos con menos elecciones (no aislados)"),
      leastChosen.length > 0
        ? leastChosen.map(n =>
            React.createElement(Text, { key: n.id, style: { fontSize: 9, marginBottom: 3 } },
              `· ${n.label} — ${n.received_count} elección(es) recibida(s)`)
          )
        : [React.createElement(Text, { key: "none", style: { fontSize: 9, color: "#64748b" } }, "Sin datos.")],

      React.createElement(Text, { style: pdfStyles.sectionTitle }, "Relaciones recíprocas"),
      reciprocalPairs.length > 0
        ? React.createElement(View, null, ...reciprocalPairs.map(e =>
            React.createElement(Text, { key: e.id, style: { fontSize: 9, marginBottom: 3 } },
              `· ${nameOf(studentMap.get(e.source))} ↔ ${nameOf(studentMap.get(e.target))}`)
          ))
        : React.createElement(Text, { style: { fontSize: 9, color: "#64748b" } }, "No se han detectado relaciones recíprocas."),

      React.createElement(Text, { style: pdfStyles.sectionTitle }, "Subgrupos detectados"),
      soc.communities.filter(c => c.size >= 2).length > 0
        ? React.createElement(View, null, ...soc.communities.filter(c => c.size >= 2).map(c =>
            React.createElement(Text, { key: c.id, style: { fontSize: 9, marginBottom: 3 } },
              `· ${c.is_closed ? "Subgrupo cerrado" : "Subgrupo"} de ${c.size}: ${c.members.map(id => nameOf(studentMap.get(id))).join(", ")}`)
          ))
        : React.createElement(Text, { style: { fontSize: 9, color: "#64748b" } }, "No se han detectado subgrupos."),

      React.createElement(Text, { style: pdfStyles.sectionTitle }, "Alertas"),
      soc.alerts.length > 0
        ? React.createElement(View, null, ...soc.alerts.map((a, i) =>
            React.createElement(View, { key: i, style: (ALERT_STYLE_BY_SEVERITY[a.severity] ?? ALERT_STYLE_BY_SEVERITY.low) },
              React.createElement(Text, { style: pdfStyles.alertText }, a.message))
          ))
        : React.createElement(Text, { style: { fontSize: 9, color: "#64748b" } }, "No hay alertas activas."),

      footer,
    ),

    // ── PAGE 3: bridge analysis ──────────────────────────────────────────────
    React.createElement(Page, { size: "A4", style: pdfStyles.page },
      React.createElement(PdfLogoRow, { logoUrl }),

      React.createElement(Text, { style: pdfStyles.sectionTitle }, "Análisis de alumnos puente"),
      React.createElement(Text, { style: { fontSize: 9, color: "#475569", marginBottom: 10 } },
        "Los alumnos puente conectan comunidades distintas dentro del grupo. Su posición es estratégica: " +
        "mantenerlos bien vinculados al mezclar clases evita la fragmentación social. " +
        "Umbral aplicado: media + 1 desviación típica de intermediación (método Brandes dirigido)."),

      bridges.length > 0
        ? React.createElement(React.Fragment, null,
            React.createElement(View, { style: pdfStyles.tableHeader },
              React.createElement(Text, { style: [pdfStyles.thCell, { flex: 0.4 }] }, "Nº"),
              React.createElement(Text, { style: [pdfStyles.thCell, { flex: 2.5 }] }, "Alumno"),
              React.createElement(Text, { style: [pdfStyles.thCell, { flex: 0.9 }] }, "Clase"),
              React.createElement(Text, { style: [pdfStyles.thCell, { flex: 0.7 }] }, "Rec."),
              React.createElement(Text, { style: [pdfStyles.thCell, { flex: 1.1 }] }, "Intermediación"),
              React.createElement(Text, { style: [pdfStyles.thCell, { flex: 0.7 }] }, "Comunidad"),
              React.createElement(Text, { style: [pdfStyles.thCell, { flex: 1.1 }] }, "Estado CDC"),
            ),
            ...bridges.map((n, i) =>
              React.createElement(View, { key: n.id, wrap: false, style: pdfStyles.tableRow },
                React.createElement(Text, { style: [pdfStyles.tdCell, { flex: 0.4 }] }, String(i + 1)),
                React.createElement(Text, { style: [pdfStyles.tdCell, { flex: 2.5 }] }, n.label),
                React.createElement(Text, { style: [pdfStyles.tdCell, { flex: 0.9 }] }, n.current_class ?? "—"),
                React.createElement(Text, { style: [pdfStyles.tdCell, { flex: 0.7 }] }, String(n.received_count)),
                React.createElement(Text, { style: [pdfStyles.tdCell, { flex: 1.1 }] },
                  `${(n.betweenness * 100).toFixed(1)}%`),
                React.createElement(Text, { style: [pdfStyles.tdCell, { flex: 0.7 }] },
                  `G${(n.community_id ?? 0) + 1}`),
                React.createElement(Text, {
                  style: [pdfStyles.tdCell, {
                    flex: 1.1,
                    color: CDC_STATUS_COLOR[n.sociometric_status ?? ""] ?? "#334155",
                  }],
                }, CDC_STATUS_LABEL[n.sociometric_status ?? ""] ?? "—"),
              )
            ),
          )
        : React.createElement(View, { style: { backgroundColor: "#f8fafc", border: "1pt solid #e2e8f0", borderRadius: 6, padding: 12, marginTop: 6 } },
            React.createElement(Text, { style: { fontSize: 9, color: "#64748b" } },
              "No se han detectado alumnos puente con el umbral estadístico aplicado (media + 1 SD de intermediación). " +
              "Esto puede indicar que el grupo tiene una estructura social homogénea sin intermediarios claros, " +
              "o que la tasa de respuesta al cuestionario es baja."),
          ),

      // Bridge interpretation guide
      React.createElement(Text, { style: [pdfStyles.sectionTitle, { marginTop: 20 }] }, "Interpretación y recomendaciones"),
      React.createElement(View, { style: { gap: 6 } },
        React.createElement(View, { style: { backgroundColor: "#eff6ff", border: "1pt solid #bfdbfe", borderRadius: 5, padding: 8 } },
          React.createElement(Text, { style: { fontSize: 9, fontWeight: "bold", color: "#1e40af", marginBottom: 3 } }, "Alumno puente rechazado (CDC)"),
          React.createElement(Text, { style: { fontSize: 9, color: "#1e3a8a" } },
            "Situación crítica: conecta comunidades pero es activamente rechazado. " +
            "Su mezcla requiere supervisión especial para evitar que arrastre el rechazo al nuevo grupo. " +
            "Se recomienda intervención de orientación antes de la mezcla."),
        ),
        React.createElement(View, { style: { backgroundColor: "#f0fdf4", border: "1pt solid #bbf7d0", borderRadius: 5, padding: 8 } },
          React.createElement(Text, { style: { fontSize: 9, fontWeight: "bold", color: "#15803d", marginBottom: 3 } }, "Alumno puente popular (CDC)"),
          React.createElement(Text, { style: { fontSize: 9, color: "#14532d" } },
            "Recurso social valioso: situarle en la clase más heterogénea favorece la cohesión del nuevo grupo. " +
            "Separar de todos sus vínculos actuales tiene riesgo bajo al tener capacidad natural de integración."),
        ),
        React.createElement(View, { style: { backgroundColor: "#fefce8", border: "1pt solid #fef08a", borderRadius: 5, padding: 8 } },
          React.createElement(Text, { style: { fontSize: 9, fontWeight: "bold", color: "#854d0e", marginBottom: 3 } }, "Alumno puente ignorado (CDC)"),
          React.createElement(Text, { style: { fontSize: 9, color: "#713f12" } },
            "Perfil silencioso con función estructural: aunque no recibe elecciones, conecta grupos. " +
            "Separar de sus pocas conexiones puede dejarlo aislado en el nuevo contexto. " +
            "Se recomienda mantener al menos un vínculo del grupo actual."),
        ),
      ),

      footer,
    ),

    // ── PAGE 4: rechazado activo / bullying risk analysis (only when hasCdc) ──
    hasCdc && rechazados.length > 0
      ? React.createElement(Page, { size: "A4", style: pdfStyles.page },
          React.createElement(PdfLogoRow, { logoUrl }),

          React.createElement(View, { style: { backgroundColor: "#fef2f2", border: "2pt solid #dc2626", borderRadius: 6, padding: 10, marginBottom: 12 } },
            React.createElement(Text, { style: { fontSize: 11, fontWeight: "bold", color: "#b91c1c", marginBottom: 4 } },
              "Análisis de rechazo activo (CDC rechazado)"),
            React.createElement(Text, { style: { fontSize: 9, color: "#7f1d1d" } },
              "El rechazo activo (CDC rechazado) es cualitativamente distinto al aislamiento pasivo (CDC ignorado). " +
              "Un alumno rechazado NO es simplemente tímido o con pocos amigos: " +
              "recibe nominaciones negativas explícitas del grupo. " +
              "Mezclarlo sin intervención puede trasladar la dinámica de rechazo al nuevo grupo. " +
              "La escala de riesgo: ≥3 rechazos = atención, ≥5 rechazos = protocolo de convivencia."),
          ),

          React.createElement(Text, { style: pdfStyles.sectionTitle }, "Alumnos con rechazo activo (ordenados por número de rechazos)"),
          React.createElement(View, { style: pdfStyles.tableHeader },
            React.createElement(Text, { style: [pdfStyles.thCell, { flex: 0.4 }] }, "Nº"),
            React.createElement(Text, { style: [pdfStyles.thCell, { flex: 2.5 }] }, "Alumno"),
            React.createElement(Text, { style: [pdfStyles.thCell, { flex: 0.9 }] }, "Clase"),
            React.createElement(Text, { style: [pdfStyles.thCell, { flex: 0.8 }] }, "Rechazos"),
            React.createElement(Text, { style: [pdfStyles.thCell, { flex: 0.8 }] }, "Positivos"),
            React.createElement(Text, { style: [pdfStyles.thCell, { flex: 0.7 }] }, "Recípr."),
            React.createElement(Text, { style: [pdfStyles.thCell, { flex: 0.8 }] }, "zSP"),
            React.createElement(Text, { style: [pdfStyles.thCell, { flex: 1.1 }] }, "Riesgo"),
          ),
          ...rechazados.map((n, i) => {
            const rej = n.rejection_received_count ?? 0
            const riskLevel = rej >= 5 ? "ALTO ≥5" : rej >= 3 ? "Medio ≥3" : "Bajo"
            const riskColor = rej >= 5 ? "#b91c1c" : rej >= 3 ? "#d97706" : "#64748b"
            return React.createElement(View, { key: n.id, wrap: false, style: pdfStyles.tableRow },
              React.createElement(Text, { style: [pdfStyles.tdCell, { flex: 0.4 }] }, String(i + 1)),
              React.createElement(Text, { style: [pdfStyles.tdCell, { flex: 2.5 }] }, n.label),
              React.createElement(Text, { style: [pdfStyles.tdCell, { flex: 0.9 }] }, n.current_class ?? "—"),
              React.createElement(Text, { style: [pdfStyles.tdCell, { flex: 0.8, color: "#b91c1c", fontWeight: "bold" }] }, String(rej)),
              React.createElement(Text, { style: [pdfStyles.tdCell, { flex: 0.8 }] }, String(n.received_count)),
              React.createElement(Text, { style: [pdfStyles.tdCell, { flex: 0.7 }] }, String(n.reciprocal_count)),
              React.createElement(Text, { style: [pdfStyles.tdCell, { flex: 0.8 }] }, String(n.social_preference_z?.toFixed(1) ?? "—")),
              React.createElement(Text, { style: [pdfStyles.tdCell, { flex: 1.1, color: riskColor, fontWeight: "bold" }] }, riskLevel),
            )
          }),

          React.createElement(Text, { style: [pdfStyles.sectionTitle, { marginTop: 18 }] }, "Clasificación Coie-Dodge (CDC) — criterios diagnósticos"),
          React.createElement(View, { style: { gap: 5 } },
            React.createElement(View, { style: { backgroundColor: "#fef2f2", border: "1pt solid #fecaca", borderRadius: 5, padding: 8 } },
              React.createElement(Text, { style: { fontSize: 9, fontWeight: "bold", color: "#991b1b", marginBottom: 2 } },
                "Rechazado — zSP < −1.0, zLM < 0, zLL > 0"),
              React.createElement(Text, { style: { fontSize: 9, color: "#7f1d1d" } },
                "Recibe pocas nominaciones positivas Y recibe nominaciones de rechazo activo. " +
                "Subtipos: reactivo (conducta impulsiva) o pasivo (sumisión social). " +
                "Indicador de riesgo de acoso o exclusión crónica."),
            ),
            React.createElement(View, { style: { backgroundColor: "#f8fafc", border: "1pt solid #e2e8f0", borderRadius: 5, padding: 8 } },
              React.createElement(Text, { style: { fontSize: 9, fontWeight: "bold", color: "#334155", marginBottom: 2 } },
                "Ignorado — zSP < −0.5, zSI < −1.0 (baja visibilidad positiva Y negativa)"),
              React.createElement(Text, { style: { fontSize: 9, color: "#64748b" } },
                "Alumno invisible para el grupo: ni elegido ni rechazado. " +
                "Riesgo de soledad crónica pero sin conflicto activo. " +
                "Perfil diferente al rechazado — necesita apoyo de integración, no de convivencia."),
            ),
            React.createElement(View, { style: { backgroundColor: "#fefce8", border: "1pt solid #fef08a", borderRadius: 5, padding: 8 } },
              React.createElement(Text, { style: { fontSize: 9, fontWeight: "bold", color: "#854d0e", marginBottom: 2 } },
                "Índices de grupo (CIVSOC)"),
              React.createElement(View, { style: { flexDirection: "row", gap: 12, marginTop: 3 } },
                React.createElement(Text, { style: { fontSize: 9, color: "#713f12", flex: 1 } },
                  `DG (disociación): ${soc.metrics.group_dissociation.toFixed(3)}\nParejas de rechazo mutuo / pares posibles`),
                React.createElement(Text, { style: { fontSize: 9, color: "#713f12", flex: 1 } },
                  `CoG (coherencia): ${soc.metrics.group_coherence.toFixed(3)}\nNominaciones recíprocas / nominaciones totales`),
                React.createElement(Text, { style: { fontSize: 9, color: "#713f12", flex: 1 } },
                  `IG (intensidad): ${soc.metrics.group_intensity.toFixed(3)}\nNominaciones totales por alumno`),
              ),
            ),
          ),

          footer,
        )
      : null,
  )
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  const { data: process } = await supabase
    .from("processes")
    .select("*")
    .eq("id", id)
    .eq("center_id", profile.center_id)
    .single()

  if (!process) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  if (!hasFullAccess(profile.role) && !(await tutorCanAccessProcess(profile.center_id, profile.id, id))) {
    return NextResponse.json({ error: "Sin acceso a este proceso" }, { status: 403 })
  }

  const [{ data: allStudents }, { data: allResponses }, { data: centerData }] = await Promise.all([
    supabase.from("students").select("*").eq("process_id", id).eq("active", true),
    supabase.from("responses").select("*").eq("process_id", id),
    supabase.from("centers").select("logo_url").eq("id", profile.center_id).single(),
  ])
  const logoUrl = (centerData as any)?.logo_url as string | null | undefined

  if (!allStudents) return NextResponse.json({ error: "Error al cargar alumnos" }, { status: 500 })

  const students = (allStudents as any[]).filter(s => !s.excluded_from_mix)
  const excludedIds = new Set((allStudents as any[]).filter(s => s.excluded_from_mix).map(s => s.id))

  const catalogIndex = await getQuestionCatalogIndex(profile.center_id)
  const responses = (filterVisibleResponses(allResponses ?? [], profile.role as UserRole, catalogIndex.sensitivity) as any[])
    .filter(r => !excludedIds.has(r.respondent_student_id) && !excludedIds.has(r.target_student_id))

  const studentMap = new Map(students.map((s: any) => [s.id, s]))
  const soc = calculateSociogram(
    students as any,
    responses as any,
    catalogIndex.scoringRoles.friendshipLike,
    catalogIndex.excludedFromGraph,
    catalogIndex.scoringRoles.negativeLike,
  )
  const positions = layout(soc.nodes)

  const buffer = await renderToBuffer(React.createElement(SociogramaPDF, { process, soc, positions, studentMap, logoUrl }) as any)

  await logAudit(profile.id, profile.center_id, "export_informe_sociograma", "process", {
    processId: id,
    metadata: { students: students.length },
  })

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=informe-sociograma.pdf",
    },
  })
}
