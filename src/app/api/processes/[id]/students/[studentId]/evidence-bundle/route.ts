/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, hasFullAccess, logAudit } from "@/lib/auth"
import { NextResponse } from "next/server"
import React from "react"
import { Document, Page, Text, View, renderToBuffer } from "@react-pdf/renderer"
import { calculateSociogram } from "@/lib/sociogram/calculate"
import { pdfStyles, formatDate, ALERT_STYLE_BY_SEVERITY, PdfLogoRow } from "@/lib/pdf/shared"
import { getQuestionCatalogIndex } from "@/lib/questionnaire/catalog"

// ── Evidence Bundle PDF ───────────────────────────────────────────────────────
// Bundles: sociometric snapshot + CDC alerts + intervention timeline + AI report excerpt
// into a single dated, confidential document for orientation/admin use.

function EvidenceBundlePDF({
  process,
  student,
  soc,
  nodeData,
  alerts,
  interventionCase,
  actions,
  aiReport,
  logoUrl,
  requestedBy,
}: {
  process: any
  student: any
  soc: ReturnType<typeof calculateSociogram>
  nodeData: ReturnType<typeof calculateSociogram>["nodes"][0] | undefined
  alerts: { type: string; title: string; description: string; severity: string }[]
  interventionCase: any | null
  actions: any[]
  aiReport: any | null
  logoUrl?: string | null
  requestedBy: string
}) {
  const fullName = `${student.first_name} ${student.last_name}`
  const generatedAt = new Date().toLocaleString("es-ES", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })

  const STATUS_LABELS: Record<string, string> = {
    popular: "Popular", rechazado: "Rechazado (CDC)", ignorado: "Ignorado (CDC)",
    controvertido: "Controvertido (CDC)", promedio: "Promedio",
  }
  const PRIORITY_LABELS: Record<string, string> = {
    urgente: "URGENTE", alta: "Alta", media: "Media", baja: "Baja",
  }
  const CASE_STATUS_LABELS: Record<string, string> = {
    detectado: "Detectado", en_revision: "En revisión", intervencion_activa: "Intervención activa",
    resuelto: "Resuelto", derivado: "Derivado",
  }
  const ACTION_TYPE_LABELS: Record<string, string> = {
    nota: "Nota interna", reunion_tutor: "Reunión con tutor", reunion_padres: "Reunión con familias",
    reunion_orientador: "Reunión con orientador", comunicado: "Comunicado", derivacion: "Derivación",
    seguimiento: "Seguimiento",
  }

  const statusStyle = (nodeData?.sociometric_status === "rechazado")
    ? { ...pdfStyles.alertHigh, marginBottom: 0 }
    : nodeData?.is_isolated
    ? { ...pdfStyles.alertHigh, marginBottom: 0 }
    : nodeData?.is_vulnerable
    ? { ...pdfStyles.alertMedium, marginBottom: 0 }
    : { backgroundColor: "#f0fdf4", borderLeft: "3pt solid #16a34a", padding: 8, borderRadius: 3 }

  return React.createElement(Document, null,
    React.createElement(Page, { size: "A4", style: pdfStyles.page },

      // Header
      React.createElement(PdfLogoRow, { logoUrl }),
      React.createElement(View, { style: pdfStyles.header },
        React.createElement(Text, { style: pdfStyles.title }, "Expediente de alumno — Dossier de evidencias"),
        React.createElement(Text, { style: pdfStyles.subtitle },
          `${process.name} · ${process.school_year}`),
        React.createElement(View, { style: { ...pdfStyles.metaRow, marginTop: 6 } },
          React.createElement(View, { style: pdfStyles.confidentialBadge },
            React.createElement(Text, null, "CONFIDENCIAL — Solo personal autorizado")),
          React.createElement(View, { style: pdfStyles.metaBadge },
            React.createElement(Text, null, `Generado: ${generatedAt}`)),
          React.createElement(View, { style: pdfStyles.metaBadge },
            React.createElement(Text, null, `Solicitado por: ${requestedBy}`)),
        ),
      ),

      // 1. Student identification card
      React.createElement(Text, { style: pdfStyles.sectionTitle }, "1. Identificación del alumno"),
      React.createElement(View, { style: { ...pdfStyles.card, backgroundColor: "#f8fafc" } },
        React.createElement(View, { style: { flexDirection: "row", gap: 24 } },
          React.createElement(View, { style: { flex: 1 } },
            React.createElement(Text, { style: { fontSize: 14, fontWeight: "bold", color: "#1e293b", marginBottom: 4 } }, fullName),
            React.createElement(Text, { style: { fontSize: 9, color: "#64748b" } }, `Clase: ${student.current_class ?? "—"}`),
            React.createElement(Text, { style: { fontSize: 9, color: "#64748b" } }, `Género: ${student.gender ?? "—"}`),
          ),
          React.createElement(View, { style: { flex: 1 } },
            React.createElement(Text, { style: { fontSize: 9, color: "#64748b" } }, `Nivel académico: ${student.academic_level ?? "—"}`),
            React.createElement(Text, { style: { fontSize: 9, color: "#64748b" } }, `Conducta: ${student.behavior_level ?? "—"}`),
            React.createElement(Text, { style: { fontSize: 9, color: "#64748b" } }, `Necesidades: ${student.needs_type ?? "No"}`),
            student.average_grade
              ? React.createElement(Text, { style: { fontSize: 9, color: "#64748b" } }, `Nota media: ${student.average_grade}`)
              : null,
          ),
        ),
        student.observations
          ? React.createElement(Text, { style: { fontSize: 8, color: "#475569", marginTop: 6, borderTop: "0.5pt solid #e2e8f0", paddingTop: 6 } },
              `Observaciones: ${student.observations}`)
          : null,
      ),

      // 2. Sociometric snapshot
      React.createElement(Text, { style: pdfStyles.sectionTitle }, "2. Posición sociométrica (snapshot)"),
      nodeData
        ? React.createElement(View, null,
            React.createElement(View, { style: { ...statusStyle, marginBottom: 8 } },
              React.createElement(Text, { style: { ...pdfStyles.alertText, fontWeight: "bold", marginBottom: 2 } },
                `Perfil CDC: ${STATUS_LABELS[nodeData.sociometric_status ?? ""] ?? "No clasificado"}`),
              React.createElement(Text, { style: pdfStyles.alertText },
                nodeData.is_isolated
                  ? "Aislamiento total: no ha recibido ninguna elección de amistad."
                  : nodeData.is_vulnerable
                  ? "Posición frágil: depende de un único vínculo significativo."
                  : nodeData.sociometric_status === "rechazado"
                  ? "Rechazo activo: ha recibido un volumen significativo de nominaciones negativas."
                  : "Sin señales de riesgo sociométrico detectadas en este proceso."),
            ),
            React.createElement(View, { style: pdfStyles.summaryGrid },
              React.createElement(View, { style: pdfStyles.summaryCard },
                React.createElement(Text, { style: pdfStyles.summaryValue }, String(nodeData.received_count)),
                React.createElement(Text, { style: pdfStyles.summaryLabel }, "Elecciones recibidas")),
              React.createElement(View, { style: pdfStyles.summaryCard },
                React.createElement(Text, { style: pdfStyles.summaryValue }, String(nodeData.given_count)),
                React.createElement(Text, { style: pdfStyles.summaryLabel }, "Elecciones emitidas")),
              React.createElement(View, { style: pdfStyles.summaryCard },
                React.createElement(Text, { style: pdfStyles.summaryValue }, String(nodeData.reciprocal_count)),
                React.createElement(Text, { style: pdfStyles.summaryLabel }, "Relaciones recíprocas")),
              React.createElement(View, { style: pdfStyles.summaryCard },
                React.createElement(Text, { style: pdfStyles.summaryValue }, String(nodeData.rejection_received_count ?? 0)),
                React.createElement(Text, { style: pdfStyles.summaryLabel }, "Rechazos recibidos")),
            ),
            React.createElement(View, { style: { flexDirection: "row", gap: 16, marginTop: 4 } },
              React.createElement(Text, { style: { fontSize: 9, color: "#64748b", fontFamily: "Courier" } },
                `zSP: ${(nodeData.social_preference_z ?? 0).toFixed(3)}`),
              React.createElement(Text, { style: { fontSize: 9, color: "#64748b", fontFamily: "Courier" } },
                `zSI: ${(nodeData.social_impact_z ?? 0).toFixed(3)}`),
              nodeData.community_id != null
                ? React.createElement(Text, { style: { fontSize: 9, color: "#64748b" } },
                    `Comunidad detectada: ${nodeData.community_id + 1}`)
                : null,
            ),
          )
        : React.createElement(Text, { style: { fontSize: 9, color: "#64748b" } },
            "No hay datos sociométricos disponibles (el alumno no ha recibido ninguna elección o el cuestionario no está cerrado)."),

      // 3. CDC Alerts
      React.createElement(Text, { style: pdfStyles.sectionTitle }, "3. Alertas CDC detectadas"),
      alerts.length > 0
        ? React.createElement(View, null,
            ...alerts.map((a, i) => {
              const style = a.severity === "urgente" || a.severity === "alta"
                ? ALERT_STYLE_BY_SEVERITY.high
                : a.severity === "media"
                ? ALERT_STYLE_BY_SEVERITY.medium
                : ALERT_STYLE_BY_SEVERITY.low
              return React.createElement(View, { key: i, style: style },
                React.createElement(Text, { style: { ...pdfStyles.alertText, fontWeight: "bold", marginBottom: 2 } }, a.title),
                React.createElement(Text, { style: pdfStyles.alertText }, a.description),
              )
            }),
          )
        : React.createElement(Text, { style: { fontSize: 9, color: "#64748b" } },
            "No se han generado alertas CDC para este alumno."),

      React.createElement(View, { style: pdfStyles.footer, fixed: true },
        React.createElement(Text, { style: pdfStyles.footerText }, `ClassMixer · Expediente de ${fullName} — confidencial`),
        React.createElement(Text, { style: pdfStyles.footerText, render: ({ pageNumber, totalPages }: any) => `Pág. ${pageNumber} / ${totalPages}` }),
      ),
    ),

    // Page 2: Intervention timeline + AI report
    React.createElement(Page, { size: "A4", style: pdfStyles.page },

      // 4. Intervention case
      React.createElement(Text, { style: pdfStyles.sectionTitle }, "4. Expediente de intervención"),
      interventionCase
        ? React.createElement(View, null,
            React.createElement(View, { style: { ...pdfStyles.card, backgroundColor: "#f8fafc", marginBottom: 8 } },
              React.createElement(View, { style: { flexDirection: "row", gap: 16, marginBottom: 4 } },
                React.createElement(Text, { style: { fontSize: 9, fontWeight: "bold", color: "#1e293b" } },
                  `Estado: ${CASE_STATUS_LABELS[interventionCase.status] ?? interventionCase.status}`),
                React.createElement(Text, { style: { fontSize: 9, color: "#64748b" } },
                  `Prioridad: ${PRIORITY_LABELS[interventionCase.priority] ?? interventionCase.priority}`),
                interventionCase.assigned_to_name
                  ? React.createElement(Text, { style: { fontSize: 9, color: "#64748b" } },
                      `Responsable: ${interventionCase.assigned_to_name}`)
                  : null,
              ),
              interventionCase.reason
                ? React.createElement(Text, { style: { fontSize: 9, color: "#475569" } },
                    `Motivo: ${interventionCase.reason}`)
                : null,
              interventionCase.due_date
                ? React.createElement(Text, { style: { fontSize: 9, color: "#64748b", marginTop: 4 } },
                    `Fecha límite: ${new Date(interventionCase.due_date).toLocaleDateString("es-ES")}`)
                : null,
            ),
            actions.length > 0
              ? React.createElement(View, null,
                  React.createElement(Text, { style: { fontSize: 10, fontWeight: "bold", color: "#1e293b", marginBottom: 6 } },
                    `Historial de actuaciones (${actions.length})`),
                  ...actions.map((a, i) =>
                    React.createElement(View, { key: i, style: { ...pdfStyles.card, marginBottom: 4 } },
                      React.createElement(View, { style: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 } },
                        React.createElement(Text, { style: { fontSize: 9, fontWeight: "bold", color: "#1e40af" } },
                          ACTION_TYPE_LABELS[a.action_type] ?? a.action_type),
                        React.createElement(Text, { style: { fontSize: 8, color: "#94a3b8" } },
                          new Date(a.created_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })),
                      ),
                      React.createElement(Text, { style: { fontSize: 9, color: "#334155", lineHeight: 1.4 } }, a.description),
                      a.created_by_name
                        ? React.createElement(Text, { style: { fontSize: 8, color: "#94a3b8", marginTop: 2 } },
                            `Por: ${a.created_by_name}`)
                        : null,
                      a.completed_at
                        ? React.createElement(Text, { style: { fontSize: 8, color: "#16a34a", marginTop: 2 } },
                            `Completada: ${new Date(a.completed_at).toLocaleDateString("es-ES")}`)
                        : null,
                    )
                  ),
                )
              : React.createElement(Text, { style: { fontSize: 9, color: "#64748b" } }, "Sin actuaciones registradas aún."),
          )
        : React.createElement(View, { style: ALERT_STYLE_BY_SEVERITY.low },
            React.createElement(Text, { style: pdfStyles.alertText },
              "No existe expediente de intervención activo para este alumno en este proceso."),
          ),

      // 5. AI report excerpt
      aiReport
        ? React.createElement(View, null,
            React.createElement(Text, { style: pdfStyles.sectionTitle }, "5. Informe orientativo IA (extracto)"),
            React.createElement(View, { style: { ...pdfStyles.card, backgroundColor: "#faf5ff", borderLeft: "3pt solid #7c3aed" } },
              React.createElement(View, { style: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 } },
                React.createElement(Text, { style: { fontSize: 8, color: "#7c3aed", fontWeight: "bold" } }, "Generado por IA — orientativo, requiere supervisión profesional"),
                React.createElement(Text, { style: { fontSize: 8, color: "#94a3b8" } },
                  new Date(aiReport.created_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })),
              ),
              React.createElement(Text, { style: { fontSize: 8.5, color: "#374151", lineHeight: 1.5 } },
                // Trim to first 1500 chars to keep PDF reasonable
                (aiReport.content ?? "").slice(0, 1500) +
                ((aiReport.content ?? "").length > 1500 ? "\n\n[Informe completo disponible en ClassMixer → alumno → Informe IA]" : "")
              ),
            ),
          )
        : null,

      React.createElement(Text, { style: { fontSize: 8, color: "#94a3b8", marginTop: 16 } },
        "Este documento ha sido generado automáticamente por ClassMixer. Su contenido es orientativo y debe ser " +
        "interpretado por profesionales cualificados. No constituye un diagnóstico clínico ni una decisión administrativa."),

      React.createElement(View, { style: pdfStyles.footer, fixed: true },
        React.createElement(Text, { style: pdfStyles.footerText }, `ClassMixer · Expediente de ${fullName} — confidencial`),
        React.createElement(Text, { style: pdfStyles.footerText, render: ({ pageNumber, totalPages }: any) => `Pág. ${pageNumber} / ${totalPages}` }),
      ),
    ),
  )
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; studentId: string }> },
) {
  const profile = await getUserProfile()
  if (!profile || !hasFullAccess(profile.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { id: processId, studentId } = await params
  const supabase = createServiceClient()

  const { data: process } = await supabase
    .from("processes").select("*").eq("id", processId).eq("center_id", profile.center_id).single()
  if (!process) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  const [
    { data: student },
    { data: allStudents },
    { data: responses },
    { data: interventionCases },
    { data: aiReports },
    { data: centerData },
  ] = await Promise.all([
    supabase.from("students").select("*").eq("id", studentId).eq("process_id", processId).single(),
    supabase.from("students").select("*").eq("process_id", processId).eq("active", true),
    supabase.from("responses").select("*").eq("process_id", processId),
    supabase.from("intervention_cases")
      .select("*, intervention_actions(*)")
      .eq("process_id", processId)
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase.from("ai_reports")
      .select("*")
      .eq("process_id", processId)
      .eq("report_type", "student")
      .filter("metadata->>student_id", "eq", studentId)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase.from("centers").select("logo_url").eq("id", profile.center_id).single(),
  ])

  if (!student) return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 })

  const logoUrl = (centerData as any)?.logo_url as string | null | undefined
  const activeStudents = (allStudents ?? []).filter((s: any) => !s.excluded_from_mix)
  const catalogIndex = await getQuestionCatalogIndex(profile.center_id)
  const soc = calculateSociogram(
    activeStudents as any,
    (responses ?? []) as any,
    catalogIndex.scoringRoles.friendshipLike,
    catalogIndex.excludedFromGraph,
    catalogIndex.scoringRoles.negativeLike ?? ["negative"],
  )

  const nodeData = soc.nodes.find(n => n.id === studentId)

  // Build alerts for this student
  const studentAlerts: { type: string; title: string; description: string; severity: string }[] = []
  if (nodeData) {
    if (nodeData.is_isolated) {
      studentAlerts.push({
        type: "aislamiento",
        severity: "alta",
        title: "Aislamiento social",
        description: `${student.first_name} no ha recibido ninguna elección de amistad. Riesgo de exclusión social pasiva.`,
      })
    }
    if ((nodeData.rejection_received_count ?? 0) >= 5) {
      studentAlerts.push({
        type: "bullying_risk",
        severity: "urgente",
        title: "Riesgo de exclusión activa / acoso",
        description: `Ha recibido ${nodeData.rejection_received_count} nominaciones negativas. Requiere revisión prioritaria e inmediata.`,
      })
    } else if (nodeData.sociometric_status === "rechazado") {
      studentAlerts.push({
        type: "cdc_rechazado",
        severity: "alta",
        title: "Perfil rechazado (CDC)",
        description: `zSP: ${(nodeData.social_preference_z ?? 0).toFixed(2)}. Rechazo activo por el grupo. Considerar separar de sus principales nominadores negativos.`,
      })
    }
    if (nodeData.is_vulnerable && nodeData.sociometric_status !== "rechazado") {
      studentAlerts.push({
        type: "vulnerable",
        severity: "media",
        title: "Posición social frágil",
        description: `Solo ${nodeData.received_count} voto(s) y ${nodeData.reciprocal_count} relación/es recíproca/s. Depende de un único vínculo.`,
      })
    }
    if (nodeData.sociometric_status === "controvertido") {
      studentAlerts.push({
        type: "controvertido",
        severity: "media",
        title: "Perfil controvertido (CDC)",
        description: `Alta visibilidad social pero también rechazo significativo (${nodeData.rejection_received_count ?? 0} rechazos). Puede polarizar al grupo.`,
      })
    }
  }

  const interventionCase = (interventionCases ?? [])[0] ?? null
  const actions = interventionCase
    ? ((interventionCase as any).intervention_actions ?? []).sort(
        (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
    : []
  const aiReport = (aiReports ?? [])[0] ?? null

  const buffer = await renderToBuffer(
    React.createElement(EvidenceBundlePDF, {
      process,
      student,
      soc,
      nodeData,
      alerts: studentAlerts,
      interventionCase,
      actions,
      aiReport,
      logoUrl,
      requestedBy: profile.name ?? profile.email ?? "Usuario",
    }) as any
  )

  await logAudit(profile.id, profile.center_id, "export_evidence_bundle", "student", {
    entityId: studentId,
    processId,
    metadata: {
      alerts_count: studentAlerts.length,
      has_intervention: !!interventionCase,
      has_ai_report: !!aiReport,
    },
  })

  const safeName = `${student.first_name}-${student.last_name}`.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="expediente-${safeName}.pdf"`,
    },
  })
}
