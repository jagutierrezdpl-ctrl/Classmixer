import * as XLSX from "xlsx"
import type { Proposal, Student, SociogramData } from "@/types"

export function exportProposalToExcel(proposal: Proposal, students: Student[]): Buffer {
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
    { Métrica: "Cohesión del grupo", Valor: `${(data.metrics.cohesion * 100).toFixed(2)}%` },
  ]
  const wsMetrics = XLSX.utils.json_to_sheet(metricsRows)
  wsMetrics["!cols"] = [{ wch: 28 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, wsMetrics, "Resumen")

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer
}
