import { createServiceClient } from "@/lib/supabase/server"
import { requireRole } from "@/lib/auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

// Fallback: translates unknown snake_case action names into readable Spanish
function formatActionFallback(action: string): { label: string; icon: string; color: string } {
  const prefixMap: [string, string][] = [
    ["view_",        "Ver"],
    ["create_",      "Crear"],
    ["delete_",      "Eliminar"],
    ["update_",      "Actualizar"],
    ["export_",      "Exportar"],
    ["import_",      "Importar"],
    ["generate_",    "Generar"],
    ["assign_",      "Asignar"],
    ["unassign_",    "Quitar"],
    ["send_",        "Enviar"],
    ["approve_",     "Aprobar"],
    ["add_",         "Añadir"],
    ["edit_",        "Editar"],
    ["duplicate_",   "Duplicar"],
    ["bulk_",        "Masivo —"],
    ["upsert_",      "Guardar"],
    ["upload_",      "Subir"],
    ["calculate_",   "Calcular"],
    ["recalculate_", "Recalcular"],
  ]
  const iconMap: [string, string][] = [
    ["view_",    "👁️"],
    ["delete_",  "🗑️"],
    ["export_",  "📄"],
    ["import_",  "📥"],
    ["create_",  "📁"],
    ["generate_","⚡"],
    ["approve_", "✅"],
    ["send_",    "📧"],
  ]
  let label = action
  let icon = "•"
  for (const [prefix, spanish] of prefixMap) {
    if (action.startsWith(prefix)) {
      const rest = action.slice(prefix.length).replace(/_/g, " ")
      label = `${spanish} ${rest}`
      break
    }
  }
  for (const [prefix, ic] of iconMap) {
    if (action.startsWith(prefix)) { icon = ic; break }
  }
  return { label, icon, color: "secondary" }
}

const ACTION_LABELS: Record<string, { label: string; icon: string; color: string; important?: boolean }> = {
  // Procesos
  create_process:           { label: "Crear proceso",             icon: "📁", color: "default",     important: true },
  duplicate_process:        { label: "Duplicar proceso",          icon: "📋", color: "default",     important: true },
  delete_process:           { label: "Eliminar proceso",          icon: "🗑️", color: "destructive", important: true },
  create_followup_process:  { label: "Crear proceso seguimiento", icon: "🔁", color: "default",     important: true },
  // Alumnos
  import_students:          { label: "Importar alumnos",         icon: "📥", color: "secondary",   important: true },
  import_student_profiles:  { label: "Importar perfiles",        icon: "📥", color: "secondary",   important: true },
  delete_students:          { label: "Eliminar alumnos",         icon: "🗑️", color: "destructive", important: true },
  exclude_student:          { label: "Excluir alumno",           icon: "⛔", color: "destructive", important: true },
  include_student:          { label: "Reactivar alumno",         icon: "✅", color: "success",     important: true },
  bulk_update_students:     { label: "Actualización masiva",     icon: "✏️", color: "warning",     important: true },
  update_grades:            { label: "Actualizar notas",         icon: "📝", color: "secondary",   important: true },
  // Cuestionario
  generate_tokens:          { label: "Generar cuestionario",     icon: "📋", color: "default",     important: true },
  send_reminder_email:      { label: "Enviar recordatorio",      icon: "📧", color: "secondary",   important: true },
  import_responses_from_process: { label: "Importar respuestas", icon: "📥", color: "secondary",  important: true },
  // Reglas
  create_rule:              { label: "Crear regla",              icon: "📐", color: "default",     important: true },
  // Propuestas
  generate_proposals:       { label: "Generar propuestas",       icon: "⚡", color: "default",     important: true },
  approve_proposal:         { label: "Aprobar propuesta",        icon: "✅", color: "success",     important: true },
  edit_proposal_assignments:{ label: "Editar distribución",      icon: "✏️", color: "warning",     important: true },
  recalculate_proposal:     { label: "Recalcular propuesta",     icon: "🔄", color: "secondary",   important: true },
  // Intervenciones
  create_intervention_case: { label: "Crear caso intervención",  icon: "🚨", color: "destructive", important: true },
  update_intervention_case: { label: "Actualizar caso",          icon: "🔄", color: "warning",     important: true },
  delete_intervention_case: { label: "Eliminar caso",            icon: "🗑️", color: "destructive", important: true },
  add_intervention_note:    { label: "Añadir nota orientación",  icon: "📝", color: "secondary",   important: true },
  // Sociograma / IA
  calculate_sociogram:      { label: "Calcular sociograma",      icon: "🔗", color: "default",     important: true },
  generate_ai_student_report: { label: "Informe IA alumno",      icon: "🤖", color: "secondary",   important: true },
  upsert_sociogram_annotation: { label: "Anotación sociograma",  icon: "📌", color: "secondary",   important: false },
  // Exportaciones
  export_proposal_excel:    { label: "Exportar Excel propuesta", icon: "📊", color: "secondary" },
  export_sociogram_excel:   { label: "Exportar sociograma",      icon: "🕸️", color: "secondary" },
  export_informe_sociograma:{ label: "PDF informe sociograma",   icon: "📄", color: "secondary" },
  export_informe_orientacion:{ label: "PDF informe orientación", icon: "📄", color: "secondary",   important: true },
  export_informe_convivencia:{ label: "PDF informe convivencia", icon: "📄", color: "secondary" },
  export_informe_direccion: { label: "PDF informe dirección",    icon: "📄", color: "secondary" },
  export_informe_tutores:   { label: "PDF informe tutores",      icon: "📄", color: "secondary" },
  export_evidence_bundle:   { label: "Paquete evidencias",       icon: "📦", color: "secondary",   important: true },
  // Tutores / Equipo
  assign_tutor:             { label: "Asignar tutor",            icon: "👥", color: "default",     important: true },
  unassign_tutor:           { label: "Quitar tutor",             icon: "👥", color: "warning",     important: true },
  // Usuarios
  update_user:              { label: "Editar usuario",           icon: "👤", color: "warning",     important: true },
  delete_user:              { label: "Eliminar usuario",         icon: "🗑️", color: "destructive", important: true },
  // Centro / Configuración
  upload_center_logo:       { label: "Subir logo centro",        icon: "🏫", color: "secondary" },
  delete_center_logo:       { label: "Eliminar logo",            icon: "🗑️", color: "secondary" },
  update_openrouter_key:    { label: "Actualizar clave IA",      icon: "🔑", color: "warning",     important: true },
  update_ai_model:          { label: "Cambiar modelo IA",        icon: "🤖", color: "secondary",   important: true },
  // Perfiles alumnos
  delete_student_profile_permanent: { label: "Eliminar perfil permanente", icon: "🗑️", color: "destructive", important: true },
  // Vistas (menos relevantes en auditoría)
  view_sociogram:           { label: "Ver sociograma",           icon: "👁️", color: "secondary" },
  view_sociogram_ai:        { label: "Ver análisis IA",          icon: "👁️", color: "secondary" },
  view_alerts:              { label: "Ver alertas",              icon: "👁️", color: "secondary" },
  view_interventions:       { label: "Ver intervenciones",       icon: "👁️", color: "secondary" },
  view_informe_convivencia: { label: "Ver informe convivencia",  icon: "👁️", color: "secondary" },
  view_convivencia_dashboard: { label: "Ver dashboard convivencia", icon: "👁️", color: "secondary" },
  view_followup_compare:    { label: "Ver comparativa seguimiento", icon: "👁️", color: "secondary" },
  view_intervention_ficha:  { label: "Ver ficha intervención",   icon: "👁️", color: "secondary" },
  view_longitudinal_history:{ label: "Ver historial longitudinal", icon: "👁️", color: "secondary" },
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString("es-ES", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

interface SearchParams {
  action?: string
  user?: string
  page?: string
  important?: string
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const profile = await requireRole(["admin", "superadmin"])
  const supabase = createServiceClient()
  const { action, user, page, important } = await searchParams

  const pageNum = Math.max(1, parseInt(page ?? "1"))
  const pageSize = 50
  const onlyImportant = important === "1"

  let query = supabase
    .from("audit_logs")
    .select("*, users(name, email)", { count: "exact" })
    .eq("center_id", profile.center_id)
    .order("created_at", { ascending: false })
    .range((pageNum - 1) * pageSize, pageNum * pageSize - 1)

  if (action) {
    query = query.eq("action", action)
  }

  if (user) {
    query = query.eq("user_id", user)
  }

  if (onlyImportant) {
    const importantActions = Object.entries(ACTION_LABELS)
      .filter(([, v]) => v.important)
      .map(([k]) => k)
    query = query.in("action", importantActions)
  }

  const { data: logs, count } = await query

  // Load users for filter dropdown
  const { data: centerUsers } = await supabase
    .from("users")
    .select("id, name, email")
    .eq("center_id", profile.center_id)
    .order("name")

  const totalPages = Math.ceil((count ?? 0) / pageSize)
  const knownActions = Object.keys(ACTION_LABELS)

  function buildParams(overrides: Record<string, string | undefined>) {
    const base: Record<string, string> = {}
    if (action) base.action = action
    if (user) base.user = user
    if (onlyImportant) base.important = "1"
    return new URLSearchParams({ ...base, ...Object.fromEntries(Object.entries(overrides).filter(([, v]) => v !== undefined)) as Record<string, string> })
  }

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Registro de actividad</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {count ?? 0} acciones registradas
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <form className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-medium">Acción</label>
              <select
                name="action"
                defaultValue={action ?? ""}
                className="text-sm border rounded-md px-3 py-1.5 bg-background"
              >
                <option value="">Todas las acciones</option>
                {knownActions.map(a => (
                  <option key={a} value={a}>{ACTION_LABELS[a].label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-medium">Usuario</label>
              <select
                name="user"
                defaultValue={user ?? ""}
                className="text-sm border rounded-md px-3 py-1.5 bg-background"
              >
                <option value="">Todos los usuarios</option>
                {(centerUsers ?? []).map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-medium">Filtro rápido</label>
              <label className="flex items-center gap-2 text-sm border rounded-md px-3 py-1.5 cursor-pointer hover:bg-muted/50">
                <input
                  type="checkbox"
                  name="important"
                  value="1"
                  defaultChecked={onlyImportant}
                  className="rounded border-border"
                />
                Solo acciones importantes
              </label>
            </div>
            <button
              type="submit"
              className="px-4 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Filtrar
            </button>
            {(action || user || onlyImportant) && (
              <Link
                href="/audit"
                className="px-4 py-1.5 text-sm border rounded-md hover:bg-muted transition-colors"
              >
                Limpiar
              </Link>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Log table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Actividad</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {(logs ?? []).length === 0 ? (
            <p className="text-center py-10 text-muted-foreground text-sm">
              No hay actividad registrada{onlyImportant ? " con las acciones importantes seleccionadas" : ""}.
            </p>
          ) : (
            <div className="divide-y">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(logs as any[] ?? []).map((log: any) => {
                const meta = ACTION_LABELS[log.action] ?? formatActionFallback(log.action)
                return (
                  <div key={log.id} className="flex items-start gap-4 px-4 py-3 hover:bg-muted/20 transition-colors">
                    <span className="text-lg leading-none mt-0.5 shrink-0">{meta.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{log.users?.name ?? "Usuario"}</span>
                        <Badge variant={meta.color as "default" | "secondary" | "destructive" | "success" | "warning"} className="text-xs">
                          {meta.label}
                        </Badge>
                        {log.metadata?.count != null && (
                          <span className="text-xs text-muted-foreground">({log.metadata.count} registros)</span>
                        )}
                        {log.metadata?.student_name && (
                          <span className="text-xs text-muted-foreground font-medium">{log.metadata.student_name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{formatDate(log.created_at)}</span>
                        {log.users?.email && <span className="text-xs opacity-60">{log.users.email}</span>}
                        {log.metadata?.processId && (
                          <span>Proceso: {String(log.metadata.processId).slice(0, 8)}…</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          {pageNum > 1 && (
            <Link
              href={`/audit?${buildParams({ page: String(pageNum - 1) })}`}
              className="px-3 py-1.5 text-sm border rounded-md hover:bg-muted transition-colors"
            >
              Anterior
            </Link>
          )}
          <span className="text-sm text-muted-foreground">
            Página {pageNum} de {totalPages}
          </span>
          {pageNum < totalPages && (
            <Link
              href={`/audit?${buildParams({ page: String(pageNum + 1) })}`}
              className="px-3 py-1.5 text-sm border rounded-md hover:bg-muted transition-colors"
            >
              Siguiente
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
