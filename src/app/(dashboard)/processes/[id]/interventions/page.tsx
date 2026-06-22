"use client"

import { use, useEffect, useState, useCallback } from "react"
import { toast } from "sonner"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  ArrowLeft, AlertTriangle, ShieldAlert, UserCheck, CheckCircle2,
  Clock, Plus, ChevronRight, Loader2, Send, User, Calendar, Flag
} from "lucide-react"

type CaseStatus = "detectado" | "en_revision" | "intervencion_activa" | "resuelto" | "derivado"
type Priority = "urgente" | "alta" | "media" | "baja"
type ActionType = "nota" | "reunion_tutor" | "reunion_padres" | "reunion_orientador" | "comunicado" | "derivacion" | "seguimiento"

interface Action {
  id: string
  action_type: ActionType
  description: string
  completed_at: string
  created_by_name: string | null
  created_at: string
}

interface InterventionCase {
  id: string
  student_id: string
  status: CaseStatus
  priority: Priority
  reason: string
  assigned_to_name: string | null
  due_date: string | null
  created_by_name: string | null
  created_at: string
  updated_at: string
  students: {
    id: string
    first_name: string
    last_name: string
    current_class: string | null
    gender: string | null
    behavior_level: string | null
  }
  intervention_actions: Action[]
}

const COLUMNS: { id: CaseStatus; label: string; icon: React.ElementType; color: string }[] = [
  { id: "detectado",           label: "Detectado",           icon: AlertTriangle,  color: "bg-red-50 border-red-200" },
  { id: "en_revision",         label: "En revisión",         icon: Clock,          color: "bg-amber-50 border-amber-200" },
  { id: "intervencion_activa", label: "Intervención activa", icon: ShieldAlert,    color: "bg-blue-50 border-blue-200" },
  { id: "derivado",            label: "Derivado",            icon: ChevronRight,   color: "bg-purple-50 border-purple-200" },
  { id: "resuelto",            label: "Resuelto",            icon: CheckCircle2,   color: "bg-green-50 border-green-200" },
]

const PRIORITY_COLORS: Record<Priority, string> = {
  urgente: "bg-red-100 text-red-700 border-red-200",
  alta:    "bg-orange-100 text-orange-700 border-orange-200",
  media:   "bg-yellow-100 text-yellow-700 border-yellow-200",
  baja:    "bg-gray-100 text-gray-600 border-gray-200",
}

const REASON_LABELS: Record<string, string> = {
  bullying_risk:   "Riesgo bullying",
  cdc_rechazado:   "CDC Rechazado",
  aislamiento:     "Aislamiento",
  vulnerable:      "Alumno vulnerable",
  manual:          "Creado manualmente",
}

const ACTION_LABELS: Record<ActionType, string> = {
  nota:                "Nota interna",
  reunion_tutor:       "Reunión tutor",
  reunion_padres:      "Reunión padres",
  reunion_orientador:  "Reunión orientador",
  comunicado:          "Comunicado",
  derivacion:          "Derivación",
  seguimiento:         "Seguimiento",
}

const ACTION_ICONS: Record<ActionType, React.ElementType> = {
  nota:                Send,
  reunion_tutor:       User,
  reunion_padres:      UserCheck,
  reunion_orientador:  ShieldAlert,
  comunicado:          Send,
  derivacion:          ChevronRight,
  seguimiento:         Clock,
}

export default function InterventionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: processId } = use(params)
  const [cases, setCases] = useState<InterventionCase[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<InterventionCase | null>(null)
  const [actionText, setActionText] = useState("")
  const [actionType, setActionType] = useState<ActionType>("nota")
  const [saving, setSaving] = useState(false)
  const [dragging, setDragging] = useState<string | null>(null)

  const loadCases = useCallback(async () => {
    const res = await fetch(`/api/processes/${processId}/interventions`)
    if (res.ok) setCases(await res.json())
    setLoading(false)
  }, [processId])

  useEffect(() => { loadCases() }, [loadCases])

  async function moveCase(caseId: string, newStatus: CaseStatus) {
    const res = await fetch(`/api/processes/${processId}/interventions/${caseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      setCases(prev => prev.map(c => c.id === caseId ? { ...c, status: newStatus, updated_at: new Date().toISOString() } : c))
      if (selected?.id === caseId) setSelected(prev => prev ? { ...prev, status: newStatus } : null)
    }
  }

  async function addAction() {
    if (!actionText.trim() || !selected) return
    setSaving(true)
    const res = await fetch(`/api/processes/${processId}/interventions/${selected.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action_type: actionType, description: actionText.trim() }),
    })
    if (res.ok) {
      const newAction = await res.json()
      const updatedCase = {
        ...selected,
        status: selected.status === "detectado" ? "en_revision" as CaseStatus : selected.status,
        intervention_actions: [newAction, ...selected.intervention_actions],
      }
      setSelected(updatedCase)
      setCases(prev => prev.map(c => c.id === selected.id ? updatedCase : c))
      setActionText("")
      toast.success("Acción registrada")
    } else {
      const json = await res.json().catch(() => ({}))
      toast.error(json.error ?? "Error al registrar")
    }
    setSaving(false)
  }

  const byCaseId = (caseId: string) => cases.find(c => c.id === caseId)

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  )

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Link href={`/processes/${processId}`}>
          <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Seguimiento de intervenciones</h1>
          <p className="text-muted-foreground text-sm">
            {cases.filter(c => c.status !== "resuelto").length} casos activos ·{" "}
            {cases.filter(c => c.priority === "urgente").length} urgentes
          </p>
        </div>
        <div className="ml-auto">
          <Link href={`/processes/${processId}/sociogram`}>
            <Button variant="outline" size="sm">
              <ShieldAlert className="w-4 h-4 mr-2" />
              Ver sociograma
            </Button>
          </Link>
        </div>
      </div>

      {cases.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent>
            <CheckCircle2 className="w-12 h-12 mx-auto text-green-500 mb-4" />
            <p className="text-lg font-medium">Sin casos detectados</p>
            <p className="text-muted-foreground text-sm mt-1">
              Los casos se crean automáticamente desde el sociograma cuando se detectan alumnos con riesgo CDC o bullying.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map(col => {
            const colCases = cases.filter(c => c.status === col.id)
            const Icon = col.icon
            return (
              <div
                key={col.id}
                className={`flex-none w-72 rounded-xl border-2 ${col.color} min-h-[400px]`}
                onDragOver={e => e.preventDefault()}
                onDrop={() => {
                  if (dragging) moveCase(dragging, col.id)
                  setDragging(null)
                }}
              >
                <div className="p-3 border-b border-inherit">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    <span className="font-semibold text-sm">{col.label}</span>
                    <Badge variant="secondary" className="ml-auto text-xs">{colCases.length}</Badge>
                  </div>
                </div>
                <div className="p-2 space-y-2">
                  {colCases
                    .sort((a, b) => {
                      const prio = { urgente: 0, alta: 1, media: 2, baja: 3 }
                      return (prio[a.priority] ?? 2) - (prio[b.priority] ?? 2)
                    })
                    .map(c => (
                      <div
                        key={c.id}
                        draggable
                        onDragStart={() => setDragging(c.id)}
                        onDragEnd={() => setDragging(null)}
                        onClick={() => setSelected(c)}
                        className="bg-white rounded-lg p-3 shadow-sm border cursor-pointer hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <p className="font-medium text-sm">
                              {c.students.first_name} {c.students.last_name}
                            </p>
                            <p className="text-xs text-muted-foreground">{c.students.current_class}</p>
                          </div>
                          <Badge className={`text-xs border ${PRIORITY_COLORS[c.priority]}`} variant="outline">
                            {c.priority}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {REASON_LABELS[c.reason] ?? c.reason}
                        </p>
                        {c.intervention_actions.length > 0 && (
                          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                            <CheckCircle2 className="w-3 h-3" />
                            {c.intervention_actions.length} {c.intervention_actions.length === 1 ? "acción" : "acciones"}
                          </div>
                        )}
                        {c.due_date && (
                          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            {new Date(c.due_date).toLocaleDateString("es-ES")}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Case detail dialog */}
      <Dialog open={!!selected} onOpenChange={open => !open && setSelected(null)}>
        <DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Flag className="w-4 h-4 text-red-500" />
                  {selected.students.first_name} {selected.students.last_name}
                  <span className="text-muted-foreground font-normal text-sm">
                    — {selected.students.current_class}
                  </span>
                </DialogTitle>
              </DialogHeader>

              <div className="flex gap-2 flex-wrap">
                <Badge className={`border ${PRIORITY_COLORS[selected.priority]}`} variant="outline">
                  {selected.priority}
                </Badge>
                <Badge variant="secondary">{REASON_LABELS[selected.reason] ?? selected.reason}</Badge>
                {selected.assigned_to_name && (
                  <Badge variant="outline">
                    <User className="w-3 h-3 mr-1" />
                    {selected.assigned_to_name}
                  </Badge>
                )}
              </div>

              {/* Status selector */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Estado:</span>
                <Select value={selected.status} onValueChange={v => moveCase(selected.id, v as CaseStatus)}>
                  <SelectTrigger className="h-8 w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLUMNS.map(col => (
                      <SelectItem key={col.id} value={col.id}>{col.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Action timeline */}
              <div className="flex-1 overflow-y-auto space-y-2 border rounded-lg p-3 bg-gray-50 min-h-[120px]">
                {selected.intervention_actions.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-4">Sin acciones registradas aún</p>
                ) : (
                  selected.intervention_actions.map(action => {
                    const AIcon = ACTION_ICONS[action.action_type] ?? Send
                    return (
                      <div key={action.id} className="bg-white rounded-md p-2 border text-sm">
                        <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1">
                          <AIcon className="w-3 h-3" />
                          <span>{ACTION_LABELS[action.action_type]}</span>
                          <span className="ml-auto">{new Date(action.created_at).toLocaleDateString("es-ES")}</span>
                          {action.created_by_name && <span>· {action.created_by_name}</span>}
                        </div>
                        <p>{action.description}</p>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Add action */}
              <div className="space-y-2 border-t pt-3">
                <div className="flex gap-2">
                  <Select value={actionType} onValueChange={v => setActionType(v as ActionType)}>
                    <SelectTrigger className="h-8 w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ACTION_LABELS) as ActionType[]).map(t => (
                        <SelectItem key={t} value={t}>{ACTION_LABELS[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <textarea
                    className="flex-1 border rounded-md p-2 text-sm resize-none h-20"
                    placeholder="Describe la acción realizada..."
                    value={actionText}
                    onChange={e => setActionText(e.target.value)}
                  />
                  <Button size="sm" onClick={addAction} disabled={saving || !actionText.trim()}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <div className="flex gap-2 border-t pt-3">
                <Link href={`/processes/${processId}/students/${selected.student_id}`} className="flex-1">
                  <Button variant="outline" size="sm" className="w-full">
                    Ver ficha alumno
                  </Button>
                </Link>
                <Link href={`/processes/${processId}/students/${selected.student_id}/intervention`} className="flex-1">
                  <Button size="sm" className="w-full">
                    Ficha de intervención
                  </Button>
                </Link>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
