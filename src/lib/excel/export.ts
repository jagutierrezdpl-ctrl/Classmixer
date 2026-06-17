import * as XLSX from "xlsx"
import type { Proposal, Student, SociogramData, Response, Rule, ProposalMetric } from "@/types"
import { calculateSociogram } from "@/lib/sociogram/calculate"

const RULE_TYPE_LABELS: Record<string, string> = {
  must_separate: "Separar obligatoriamente",
  should_keep_together: "Mantener juntos (recomendado)",
  must_keep_together: "Mantener juntos (obligatorio)",
  keep_at_least_one: "Mantener al menos uno",
  max_from_group: "Máximo por clase",
  lock_student_to_class: "Fijar en clase concreta",
  with_tutor: "Asignar con tutor concreto",
  exclude_student: "Excluir de la mezcla",
  protect_vulnerable: "Proteger alumno vulnerable",
  avoid_tutor: "Evitar tutor (alumno-tutor)",
}

export function exportProposalToExcel(
  proposal: Proposal,
  students: Student[],
  rules: Rule[] = [],
  responses: Response[] = [],
  proposalMetrics: ProposalMetric[] = [],
): Buffer {
  const studentMap = new Map(students.map(s => [s.id, s]))

  const assignments = proposal.assignments ?? []
  const targetClasses = [...new Set(assignments.map(a => a.target_class))].sort()

  const wb = XLSX.utils.book_new()

  // Sheet per class
  for (const cls of targetClasses) {
    const classAssignments = assignments.filter(a => a.target_class === cls)
    const rows = classAssignments.map(a => {
      const s = studentMap.get(a.student_id) ?? a.student
      return {
        Clase: cls,
        Nombre: s?.first_name ?? "",
        Apellidos: s?.last_name ?? "",
        Clase_Origen: s?.current_class ?? "",
        Género: s?.gender ?? "",
        Nota_Media: s?.average_grade ?? "",
        Nivel: s?.academic_level ?? "",
        Conducta: s?.behavior_level ?? "",
        Necesidades: s?.needs_type ?? "",
        Observaciones: s?.observations ?? "",
      }
    }).sort((a, b) => a.Apellidos.localeCompare(b.Apellidos))

    const ws = XLSX.utils.json_to_sheet(rows)
    ws["!cols"] = [
      { wch: 6 }, { wch: 15 }, { wch: 20 }, { wch: 12 }, { wch: 8 },
      { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 30 },
    ]
    XLSX.utils.book_append_sheet(wb, ws, cls)
  }

  // Summary sheet
  const summaryRows = assignments.map(a => {
    const s = studentMap.get(a.student_id) ?? a.student
    return {
      Clase_Destino: a.target_class,
      Nombre: s?.first_name ?? "",
      Apellidos: s?.last_name ?? "",
      Clase_Origen: s?.current_class ?? "",
      Género: s?.gender ?? "",
      Nota_Media: s?.average_grade ?? "",
      Nivel: s?.academic_level ?? "",
      Necesidades: s?.needs_type ?? "",
    }
  }).sort((a, b) => a.Clase_Destino.localeCompare(b.Clase_Destino) || a.Apellidos.localeCompare(b.Apellidos))

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows)
  XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen")

  // Métricas sheet (stored per-class balance metrics from the solver)
  const metricRows = proposalMetrics
    .filter(m => m.target_class)
    .sort((a, b) => (a.target_class ?? "").localeCompare(b.target_class ?? "") || a.metric_key.localeCompare(b.metric_key))
    .map(m => ({ Clase: m.target_class, Métrica: m.metric_key, Valor: m.metric_value }))
  const wsClassMetrics = XLSX.utils.json_to_sheet(
    metricRows.length > 0 ? metricRows : [{ Mensaje: "Sin métricas calculadas para esta propuesta" }]
  )
  XLSX.utils.book_append_sheet(wb, wsClassMetrics, "Métricas")

  // Reglas sheet
  const ruleRows = rules.map(r => ({
    Tipo: RULE_TYPE_LABELS[r.rule_type] ?? r.rule_type,
    Prioridad: r.priority,
    Descripción: r.description ?? "",
    Clase_Destino: r.target_class ?? "",
    Alumnos: (r.students ?? [])
      .map(rs => (rs.student ? `${rs.student.first_name} ${rs.student.last_name}` : rs.student_id))
      .join(", "),
    Activa: r.active ? "Sí" : "No",
  }))
  const wsRules = XLSX.utils.json_to_sheet(
    ruleRows.length > 0 ? ruleRows : [{ Mensaje: "Sin reglas configuradas para este proceso" }]
  )
  XLSX.utils.book_append_sheet(wb, wsRules, "Reglas")

  // Future per-class sociogram (reusing calculateSociogram restricted to each new class):
  // feeds Alertas, Alumnos sin amistad and Sociograma métricas sheets
  const alertRows: Record<string, string | number>[] = []
  const friendlessRows: Record<string, string | number>[] = []
  const socMetricRows: Record<string, string | number>[] = []

  for (const cls of targetClasses) {
    const clsStudentIds = new Set(assignments.filter(a => a.target_class === cls).map(a => a.student_id))
    const clsStudents = students.filter(s => clsStudentIds.has(s.id))
    if (clsStudents.length === 0) continue
    const clsResponses = responses.filter(
      r => clsStudentIds.has(r.respondent_student_id) && clsStudentIds.has(r.target_student_id)
    )

    const soc: SociogramData = calculateSociogram(clsStudents, clsResponses)

    for (const alert of soc.alerts) {
      alertRows.push({
        Clase: cls,
        Tipo: alert.type,
        Severidad: alert.severity,
        Mensaje: alert.message,
        Alumnos: alert.student_ids
          .map(sid => { const s = studentMap.get(sid); return s ? `${s.first_name} ${s.last_name}` : sid })
          .join(", "),
      })
    }

    for (const node of soc.nodes) {
      if (node.is_isolated) {
        friendlessRows.push({
          Clase: cls,
          Nombre: node.first_name,
          Apellidos: node.last_name,
          Elecciones_Dadas_En_Clase: node.given_count,
          Elecciones_Recibidas_En_Clase: node.received_count,
        })
      }
      socMetricRows.push({
        Clase: cls,
        Nombre: node.first_name,
        Apellidos: node.last_name,
        Elecciones_Recibidas: node.received_count,
        Elecciones_Dadas: node.given_count,
        Relaciones_Recíprocas: node.reciprocal_count,
        Centralidad: node.centrality,
        Intermediación: node.betweenness,
        Aislado: node.is_isolated ? "Sí" : "No",
        Vulnerable: node.is_vulnerable ? "Sí" : "No",
      })
    }
  }

  const wsAlerts = XLSX.utils.json_to_sheet(
    alertRows.length > 0 ? alertRows : [{ Mensaje: "Sin alertas detectadas en las clases propuestas" }]
  )
  XLSX.utils.book_append_sheet(wb, wsAlerts, "Alertas")

  const wsFriendless = XLSX.utils.json_to_sheet(
    friendlessRows.length > 0
      ? friendlessRows
      : [{ Mensaje: "Todos los alumnos tienen al menos una amistad en su clase final" }]
  )
  XLSX.utils.book_append_sheet(wb, wsFriendless, "Alumnos sin amistad")

  const wsSocMetrics = XLSX.utils.json_to_sheet(socMetricRows)
  XLSX.utils.book_append_sheet(wb, wsSocMetrics, "Sociograma métricas")

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer
}

export function exportSociogramToExcel(data: SociogramData): Buffer {
  const wb = XLSX.utils.book_new()

  // Sheet 1: per-student metrics
  const studentRows = [...data.nodes]
    .sort((a, b) => b.centrality - a.centrality)
    .map(n => ({
      Nombre: n.first_name,
      Apellidos: n.last_name,
      Clase: n.current_class,
      Género: n.gender,
      Nivel_Académico: n.academic_level ?? "",
      Conducta: n.behavior_level ?? "",
      Elecciones_Recibidas: n.received_count,
      Elecciones_Dadas: n.given_count,
      Relaciones_Recíprocas: n.reciprocal_count,
      Centralidad_Pct: `${(n.centrality * 100).toFixed(1)}%`,
      Intermediación_Pct: `${(n.betweenness * 100).toFixed(1)}%`,
      Comunidad: n.community_id !== undefined ? `Grupo ${n.community_id + 1}` : "",
      Aislado: n.is_isolated ? "Sí" : "No",
      Vulnerable: n.is_vulnerable ? "Sí" : "No",
      Líder: n.is_leader ? "Sí" : "No",
      Puente: n.is_bridge ? "Sí" : "No",
    }))
  const wsStudents = XLSX.utils.json_to_sheet(studentRows)
  wsStudents["!cols"] = [
    { wch: 12 }, { wch: 18 }, { wch: 8 }, { wch: 8 }, { wch: 14 }, { wch: 12 },
    { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 14 },
    { wch: 12 }, { wch: 8 }, { wch: 10 }, { wch: 8 }, { wch: 8 },
  ]
  XLSX.utils.book_append_sheet(wb, wsStudents, "Alumnos")

  // Sheet 2: communities
  const communityRows = data.communities.flatMap(c =>
    c.members.map(sid => {
      const n = data.nodes.find(nd => nd.id === sid)
      return {
        Grupo: `Grupo ${c.id + 1}`,
        Tamaño: c.size,
        Subgrupo_Cerrado: c.is_closed ? "Sí" : "No",
        Nombre: n?.first_name ?? "",
        Apellidos: n?.last_name ?? "",
        Clase: n?.current_class ?? "",
      }
    })
  )
  const wsCommunities = XLSX.utils.json_to_sheet(communityRows)
  XLSX.utils.book_append_sheet(wb, wsCommunities, "Comunidades")

  // Sheet 3: alerts
  const nodeMap = new Map(data.nodes.map(n => [n.id, n]))
  const alertRows = data.alerts.flatMap(a =>
    a.student_ids.map(sid => {
      const n = nodeMap.get(sid)
      return {
        Tipo: a.type,
        Severidad: a.severity,
        Mensaje: a.message,
        Alumno: n ? `${n.first_name} ${n.last_name}` : sid,
        Clase: n?.current_class ?? "",
      }
    })
  )
  const wsAlerts = XLSX.utils.json_to_sheet(alertRows)
  XLSX.utils.book_append_sheet(wb, wsAlerts, "Alertas")

  // Sheet 4: global metrics
  const metricsRows = [
    { Métrica: "Total alumnos", Valor: data.metrics.total_students },
    { Métrica: "Alumnos aislados", Valor: data.metrics.isolated_count },
    { Métrica: "Alumnos vulnerables", Valor: data.metrics.vulnerable_count },
    { Métrica: "Líderes sociales", Valor: data.metrics.leaders_count },
    { Métrica: "Alumnos puente", Valor: data.metrics.bridges_count },
    { Métrica: "Comunidades detectadas", Valor: data.metrics.communities_count },
    { Métrica: "Pares recíprocos", Valor: data.metrics.reciprocal_pairs },
    { Métrica: "Densidad de red", Valor: `${(data.metrics.density * 100).toFixed(2)}%` },
    { Métrica: "Cohesión grupal (IAg)", Valor: `${(data.metrics.group_cohesion * 100).toFixed(2)}%` },
  ]
  const wsMetrics = XLSX.utils.json_to_sheet(metricsRows)
  wsMetrics["!cols"] = [{ wch: 28 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, wsMetrics, "Resumen")

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer
}
