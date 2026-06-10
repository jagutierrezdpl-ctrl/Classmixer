import { createServiceClient } from "@/lib/supabase/server"
import { requireRole } from "@/lib/auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

const ACTION_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  import_students: { label: "Importar alumnos", icon: "📥", color: "secondary" },
  generate_proposals: { label: "Generar propuestas", icon: "⚡", color: "default" },
  approve_proposal: { label: "Aprobar propuesta", icon: "✅", color: "success" },
  edit_proposal_assignments: { label: "Editar distribución", icon: "✏️", color: "warning" },
  export_proposal_excel: { label: "Exportar Excel", icon: "📊", color: "secondary" },
  export_sociogram_excel: { label: "Exportar sociograma", icon: "🕸️", color: "secondary" },
  create_process: { label: "Crear proceso", icon: "📁", color: "default" },
  generate_tokens: { label: "Generar cuestionario", icon: "📋", color: "default" },
  calculate_sociogram: { label: "Calcular sociograma", icon: "🔗", color: "default" },
  view_sociogram: { label: "Ver sociograma", icon: "👁️", color: "secondary" },
  delete_process: { label: "Eliminar proceso", icon: "🗑️", color: "destructive" },
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
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const profile = await requireRole(["admin", "superadmin"])
  const supabase = createServiceClient()
  const { action, page } = await searchParams

  const pageNum = Math.max(1, parseInt(page ?? "1"))
  const pageSize = 30

  let query = supabase
    .from("audit_logs")
    .select("*, users(name, email)", { count: "exact" })
    .eq("center_id", profile.center_id)
    .order("created_at", { ascending: false })
    .range((pageNum - 1) * pageSize, pageNum * pageSize - 1)

  if (action) {
    query = query.eq("action", action)
  }

  const { data: logs, count } = await query

  const totalPages = Math.ceil((count ?? 0) / pageSize)

  const knownActions = Object.keys(ACTION_LABELS)

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
            <button
              type="submit"
              className="px-4 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Filtrar
            </button>
            {action && (
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
              No hay actividad registrada.
            </p>
          ) : (
            <div className="divide-y">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(logs as any[] ?? []).map((log: any) => {
                const meta = ACTION_LABELS[log.action] ?? { label: log.action, icon: "•", color: "secondary" }
                return (
                  <div key={log.id} className="flex items-start gap-4 px-4 py-3">
                    <span className="text-lg leading-none mt-0.5 shrink-0">{meta.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{log.users?.name ?? "Usuario"}</span>
                        <Badge variant={meta.color as "default" | "secondary" | "destructive" | "success" | "warning"} className="text-xs">
                          {meta.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{formatDate(log.created_at)}</span>
                        {log.users?.email && <span>{log.users.email}</span>}
                        {log.entity_type && (
                          <span className="capitalize">{log.entity_type}: {log.entity_id?.slice(0, 8)}</span>
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
              href={`/audit?${new URLSearchParams({ ...(action ? { action } : {}), page: String(pageNum - 1) })}`}
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
              href={`/audit?${new URLSearchParams({ ...(action ? { action } : {}), page: String(pageNum + 1) })}`}
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
