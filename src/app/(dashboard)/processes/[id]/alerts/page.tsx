"use client"

import { use, useEffect, useState, useCallback } from "react"
import { toast } from "sonner"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ArrowLeft, AlertTriangle, ShieldAlert, UserX, Users, Loader2,
  CheckCircle2, ChevronRight, ExternalLink
} from "lucide-react"
import type { AlertItem } from "@/app/api/processes/[id]/alerts/route"

type Severity = "urgente" | "alta" | "media"

const SEVERITY_COLORS: Record<Severity, string> = {
  urgente: "bg-red-100 text-red-800 border-red-300",
  alta:    "bg-orange-100 text-orange-800 border-orange-300",
  media:   "bg-yellow-100 text-yellow-800 border-yellow-300",
}

const ALERT_ICONS: Record<string, React.ElementType> = {
  bullying_risk:   ShieldAlert,
  cdc_rechazado:   AlertTriangle,
  aislamiento:     UserX,
  vulnerable:      Users,
  subgrupo_cerrado: Users,
}

const ALERT_LABELS: Record<string, string> = {
  bullying_risk:    "Riesgo de bullying",
  cdc_rechazado:    "CDC Rechazado",
  aislamiento:      "Aislamiento total",
  vulnerable:       "Alumno vulnerable",
  subgrupo_cerrado: "Subgrupo cerrado",
}

const CASE_STATUS_LABELS: Record<string, string> = {
  detectado:           "Detectado",
  en_revision:         "En revisión",
  intervencion_activa: "Intervención activa",
  derivado:            "Derivado",
  resuelto:            "Resuelto",
}

export default function AlertsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: processId } = use(params)
  const [data, setData] = useState<{ alerts: AlertItem[]; total: number; urgent: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState<string | null>(null)
  const [filter, setFilter] = useState<Severity | "all">("all")

  const load = useCallback(async () => {
    const res = await fetch(`/api/processes/${processId}/alerts`)
    if (res.ok) setData(await res.json())
    else toast.error("Error cargando alertas")
    setLoading(false)
  }, [processId])

  useEffect(() => { load() }, [load])

  async function createCase(alert: AlertItem) {
    setCreating(alert.id)
    const res = await fetch(`/api/processes/${processId}/interventions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        student_id: alert.student_id,
        reason: alert.alert_type,
        priority: alert.severity === "urgente" ? "urgente" : alert.severity === "alta" ? "alta" : "media",
      }),
    })
    if (res.ok) {
      toast.success("Caso de intervención creado")
      load()
    } else {
      const json = await res.json().catch(() => ({}))
      toast.error(json.error ?? "Error al crear caso")
    }
    setCreating(null)
  }

  const filtered = data?.alerts.filter(a => filter === "all" || a.severity === filter) ?? []

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  )

  return (
    <div className="space-y-6 p-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href={`/processes/${processId}`}>
          <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Centro de alertas CDC</h1>
          <p className="text-muted-foreground text-sm">
            {data?.total ?? 0} alertas detectadas · {data?.urgent ?? 0} urgentes
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <Link href={`/processes/${processId}/interventions`}>
            <Button variant="outline" size="sm">
              <ShieldAlert className="w-4 h-4 mr-2" />
              Panel Kanban
            </Button>
          </Link>
          <Link href={`/processes/${processId}/sociogram`}>
            <Button variant="outline" size="sm">
              Ver sociograma
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {(["urgente", "alta", "media"] as Severity[]).map(sev => {
          const count = data?.alerts.filter(a => a.severity === sev).length ?? 0
          return (
            <Card
              key={sev}
              className={`cursor-pointer transition-all ${filter === sev ? "ring-2 ring-primary" : ""}`}
              onClick={() => setFilter(filter === sev ? "all" : sev)}
            >
              <CardContent className="pt-4">
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-muted-foreground text-sm capitalize">{sev === "urgente" ? "Urgentes" : sev === "alta" ? "Prioridad alta" : "Prioridad media"}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent>
            <CheckCircle2 className="w-12 h-12 mx-auto text-green-500 mb-4" />
            <p className="text-lg font-medium">Sin alertas en esta categoría</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(alert => {
            const Icon = ALERT_ICONS[alert.alert_type] ?? AlertTriangle
            return (
              <Card key={alert.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${
                      alert.severity === "urgente" ? "bg-red-100" :
                      alert.severity === "alta" ? "bg-orange-100" : "bg-yellow-100"
                    }`}>
                      <Icon className={`w-4 h-4 ${
                        alert.severity === "urgente" ? "text-red-600" :
                        alert.severity === "alta" ? "text-orange-600" : "text-yellow-600"
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{alert.student_name}</span>
                        {alert.current_class && (
                          <span className="text-muted-foreground text-sm">· {alert.current_class}</span>
                        )}
                        <Badge className={`text-xs border ${SEVERITY_COLORS[alert.severity]}`} variant="outline">
                          {alert.severity}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {ALERT_LABELS[alert.alert_type]}
                        </Badge>
                        {alert.has_case && (
                          <Badge variant="outline" className="text-xs text-blue-600 border-blue-200 bg-blue-50">
                            Caso: {CASE_STATUS_LABELS[alert.case_status ?? ""] ?? alert.case_status}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{alert.description}</p>
                    </div>
                    <div className="flex gap-2 items-start shrink-0">
                      {alert.alert_type !== "subgrupo_cerrado" && (
                        <>
                          {!alert.has_case ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => createCase(alert)}
                              disabled={creating === alert.id}
                            >
                              {creating === alert.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus />}
                              <span className="ml-1 text-xs">Abrir caso</span>
                            </Button>
                          ) : (
                            <Link href={`/processes/${processId}/interventions`}>
                              <Button size="sm" variant="outline">
                                <ChevronRight className="w-3 h-3" />
                              </Button>
                            </Link>
                          )}
                          <Link href={`/processes/${processId}/students/${alert.student_id}`}>
                            <Button size="sm" variant="ghost">
                              <ExternalLink className="w-3 h-3" />
                            </Button>
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Plus() {
  return <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 5v14M5 12h14"/></svg>
}
