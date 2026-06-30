"use client"

import { useState, useMemo } from "react"
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  CheckCircle2, XCircle, AlertTriangle, Save, RotateCcw,
  GripVertical, Lock, Unlock, RefreshCw, ArrowRight,
} from "lucide-react"
import type { Proposal, ProposalAssignment, Rule } from "@/types"

// ---------- helpers ----------

function computeClassStats(assignments: ProposalAssignment[], cls: string) {
  const inClass = assignments.filter(a => a.target_class === cls)
  const withGrade = inClass.filter(a => (a.student?.average_grade ?? 0) > 0)
  return {
    count: inClass.length,
    avgGrade: withGrade.length > 0
      ? withGrade.reduce((s, a) => s + (a.student?.average_grade ?? 0), 0) / withGrade.length
      : 0,
    female: inClass.filter(a => a.student?.gender === "F").length,
    male: inClass.filter(a => a.student?.gender === "M").length,
  }
}

function computeRuleResults(rules: Rule[], assignments: ProposalAssignment[]) {
  const clsOf = (sid: string) => assignments.find(a => a.student_id === sid)?.target_class
  return rules
    .filter(r => r.active && r.rule_type !== "exclude_student" && r.rule_type !== "protect_vulnerable")
    .map(rule => {
      const ids = (rule.students ?? []).map(rs => rs.student_id)
      let fulfilled = true
      let details = ""
      if (rule.rule_type === "must_separate") {
        for (let i = 0; i < ids.length && fulfilled; i++)
          for (let j = i + 1; j < ids.length; j++) {
            const a = clsOf(ids[i]), b = clsOf(ids[j])
            if (a && b && a === b) { fulfilled = false; break }
          }
        details = fulfilled ? "Separados correctamente" : "Están en la misma clase"
      } else if (rule.rule_type === "must_keep_together" || rule.rule_type === "should_keep_together") {
        const classes = [...new Set(ids.map(clsOf).filter(Boolean))]
        fulfilled = classes.length <= 1
        details = fulfilled ? `Juntos en ${classes[0] ?? "—"}` : "En clases distintas"
      } else if (rule.rule_type === "lock_student_to_class") {
        const cls = clsOf(ids[0])
        fulfilled = cls === rule.target_class
        details = fulfilled ? `En ${rule.target_class}` : `En ${cls ?? "?"} en lugar de ${rule.target_class}`
      } else if (rule.rule_type === "max_from_group") {
        const max = rule.max_count ?? 1
        const perClass: Record<string, number> = {}
        for (const sid of ids) { const c = clsOf(sid); if (c) perClass[c] = (perClass[c] ?? 0) + 1 }
        const worst = Object.entries(perClass).find(([, n]) => n > max)
        fulfilled = !worst
        details = fulfilled ? `Máximo ${max} cumplido` : `${worst?.[1]} en ${worst?.[0]} (máx. ${max})`
      } else {
        details = "Verificado"
      }
      return { rule, fulfilled, details }
    })
}

// ---------- draggable student card ----------

function StudentCard({
  assignment,
  isDragging,
  locked,
  onToggleLock,
}: {
  assignment: ProposalAssignment
  isDragging: boolean
  locked: boolean
  onToggleLock: () => void
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: assignment.student_id,
    disabled: locked,
  })
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined
  const s = assignment.student
  const gColor = s?.gender === "F" ? "bg-pink-100 text-pink-700" : s?.gender === "M" ? "bg-blue-100 text-blue-700" : "bg-muted text-muted-foreground"

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-1.5 px-2 py-1.5 rounded border text-xs select-none transition-shadow
        ${isDragging ? "opacity-30 shadow-none" : "opacity-100"}
        ${locked ? "bg-amber-50 border-amber-200" : "bg-white border-border hover:border-primary/40 hover:shadow-sm"}
        cursor-${locked ? "default" : "grab"}`}
    >
      {locked
        ? <Lock className="w-3 h-3 text-amber-500 shrink-0" />
        : (
          <span {...attributes} {...listeners} className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0">
            <GripVertical className="w-3 h-3" />
          </span>
        )
      }
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate leading-tight">{s?.first_name} {s?.last_name}</p>
        <p className="text-muted-foreground/70 text-[10px] truncate leading-tight">
          {s?.current_class}{s?.average_grade ? ` · ${s.average_grade.toFixed(1)}` : ""}
        </p>
      </div>
      <span className={`shrink-0 text-[10px] font-medium px-1 rounded ${gColor}`}>{s?.gender ?? "?"}</span>
      <button
        onClick={onToggleLock}
        className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-amber-500 transition-all"
        title={locked ? "Desbloquear" : "Fijar aquí"}
      >
        {locked ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
      </button>
    </div>
  )
}

function DragOverlayCard({ assignment }: { assignment: ProposalAssignment }) {
  const s = assignment.student
  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5 rounded border bg-white shadow-xl text-xs w-44 rotate-1 border-primary/30">
      <GripVertical className="w-3 h-3 text-muted-foreground/40 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{s?.first_name} {s?.last_name}</p>
        <p className="text-muted-foreground/70 text-[10px] truncate">{s?.current_class}</p>
      </div>
    </div>
  )
}

// ---------- droppable class column ----------

function ClassColumn({
  cls,
  assignments,
  lockedIds,
  onToggleLock,
  activeId,
  activeSrc,
}: {
  cls: string
  assignments: ProposalAssignment[]
  lockedIds: Set<string>
  onToggleLock: (sid: string) => void
  activeId: string | null
  activeSrc: string | null
}) {
  const { setNodeRef, isOver } = useDroppable({ id: cls })
  const isTarget = isOver && activeId !== null && activeSrc !== cls

  const students = [...assignments]
    .filter(a => a.target_class === cls)
    .sort((a, b) => (a.student?.last_name ?? "").localeCompare(b.student?.last_name ?? ""))

  const stats = computeClassStats(assignments, cls)

  // delta preview: what would stats look like if active student came here?
  let deltaLabel: string | null = null
  if (isTarget && activeId) {
    const s = assignments.find(a => a.student_id === activeId)?.student
    if (s) {
      const newCount = stats.count + 1
      const addF = s.gender === "F" ? 1 : 0
      const addM = s.gender === "M" ? 1 : 0
      const grade = s.average_grade ?? 0
      const newGrade = grade > 0
        ? (stats.avgGrade * (stats.count > 0 ? stats.count : 0) + grade) / newCount
        : stats.avgGrade
      const parts: string[] = []
      parts.push(`${newCount} alumnos`)
      if (newGrade > 0) parts.push(`nota ${newGrade.toFixed(1)}`)
      const newF = stats.female + addF
      const newM = stats.male + addM
      if (newF + newM > 0) parts.push(`${newF}F · ${newM}M`)
      deltaLabel = parts.join(" · ")
    }
  }

  return (
    <div className="flex flex-col min-w-[200px] max-w-[240px] flex-shrink-0">
      <div className={`rounded-t-lg px-3 py-2 border border-b-0 transition-colors
        ${isTarget ? "bg-primary/10 border-primary/40" : "bg-muted/60 border-border"}`}>
        <p className="font-semibold text-sm">{cls}</p>
        <div className="text-xs text-muted-foreground mt-0.5 space-y-0.5">
          {isTarget && deltaLabel
            ? (
              <span className="flex items-center gap-1 text-primary font-medium">
                <ArrowRight className="w-3 h-3" />
                {deltaLabel}
              </span>
            )
            : (
              <span>
                {stats.count} alumnos
                {stats.avgGrade > 0 && ` · nota ${stats.avgGrade.toFixed(1)}`}
                {(stats.female + stats.male) > 0 && ` · ${stats.female}F ${stats.male}M`}
              </span>
            )
          }
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 rounded-b-lg border p-2 space-y-1 min-h-[100px] transition-colors
          ${isTarget ? "bg-primary/5 border-primary/40 border-dashed" : "bg-background border-border"}`}
      >
        {students.map(a => (
          <StudentCard
            key={a.student_id}
            assignment={a}
            isDragging={a.student_id === activeId}
            locked={lockedIds.has(a.student_id)}
            onToggleLock={() => onToggleLock(a.student_id)}
          />
        ))}
        {students.length === 0 && (
          <div className="flex items-center justify-center h-14 text-xs text-muted-foreground/40 border-2 border-dashed border-muted rounded">
            Suelta aquí
          </div>
        )}
      </div>
    </div>
  )
}

// ---------- main editor ----------

interface Props {
  proposal: Proposal
  rules: Rule[]
  open: boolean
  onClose: () => void
  onSaved: (updated: Proposal) => void
}

export default function ProposalEditor({ proposal, rules, open, onClose, onSaved }: Props) {
  const targetClasses = useMemo(
    () => [...new Set((proposal.assignments ?? []).map(a => a.target_class))].sort(),
    [proposal.assignments]
  )

  const [assignments, setAssignments] = useState<ProposalAssignment[]>(() =>
    (proposal.assignments ?? []).map(a => ({ ...a }))
  )
  const [lockedIds, setLockedIds] = useState<Set<string>>(
    () => new Set((proposal.assignments ?? []).filter(a => a.locked).map(a => a.student_id))
  )
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeSrc, setActiveSrc] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [recalculating, setRecalculating] = useState(false)
  const [dirty, setDirty] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const ruleResults = useMemo(() => computeRuleResults(rules, assignments), [rules, assignments])
  const violated = ruleResults.filter(r => !r.fulfilled)
  const fulfilled = ruleResults.filter(r => r.fulfilled)

  const activeAssignment = activeId ? assignments.find(a => a.student_id === activeId) : null

  function handleDragStart(e: DragStartEvent) {
    const sid = String(e.active.id)
    setActiveId(sid)
    setActiveSrc(assignments.find(a => a.student_id === sid)?.target_class ?? null)
  }

  function handleDragOver(e: DragOverEvent) {
    // no-op — column highlighting handled via useDroppable isOver
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    setActiveId(null)
    setActiveSrc(null)
    if (!over) return
    const sid = String(active.id)
    const dest = String(over.id)
    const current = assignments.find(a => a.student_id === sid)?.target_class
    if (!current || current === dest || lockedIds.has(sid)) return
    setAssignments(prev => prev.map(a => a.student_id === sid ? { ...a, target_class: dest } : a))
    setDirty(true)
  }

  function toggleLock(sid: string) {
    setLockedIds(prev => {
      const next = new Set(prev)
      next.has(sid) ? next.delete(sid) : next.add(sid)
      return next
    })
    setDirty(true)
  }

  function handleReset() {
    setAssignments((proposal.assignments ?? []).map(a => ({ ...a })))
    setLockedIds(new Set((proposal.assignments ?? []).filter(a => a.locked).map(a => a.student_id)))
    setDirty(false)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/proposals/${proposal.id}/assignments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignments: assignments.map(a => ({
            student_id: a.student_id,
            target_class: a.target_class,
            locked: lockedIds.has(a.student_id),
          })),
        }),
      })
      if (!res.ok) throw new Error()
      toast.success("Cambios guardados")
      setDirty(false)
      const updated: Proposal = {
        ...proposal,
        status: "editada",
        assignments: assignments.map(a => ({ ...a, locked: lockedIds.has(a.student_id) })),
      }
      onSaved(updated)
    } catch {
      toast.error("Error al guardar")
    } finally {
      setSaving(false)
    }
  }

  async function handleRecalculate() {
    // First save current locks so the recalculate API picks them up
    setRecalculating(true)
    try {
      const saveRes = await fetch(`/api/proposals/${proposal.id}/assignments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignments: assignments.map(a => ({
            student_id: a.student_id,
            target_class: a.target_class,
            locked: lockedIds.has(a.student_id),
          })),
        }),
      })
      if (!saveRes.ok) throw new Error("No se pudo guardar el estado actual")

      const recalcRes = await fetch(`/api/proposals/${proposal.id}/recalculate`, { method: "POST" })
      if (!recalcRes.ok) throw new Error("Error al recalcular")

      // Reload proposal from server — proposal_assignments is the raw join name
      const reloadRes = await fetch(`/api/proposals/${proposal.id}`)
      if (reloadRes.ok) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw: any = await reloadRes.json()
        const newAssignments: ProposalAssignment[] = raw.proposal_assignments ?? []
        setAssignments(newAssignments)
        setLockedIds(new Set(newAssignments.filter((a: ProposalAssignment) => a.locked).map((a: ProposalAssignment) => a.student_id)))
      }

      toast.success("Propuesta recalculada respetando los cambios")
      setDirty(false)
      onSaved({ ...proposal, status: "editada" })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al recalcular")
    } finally {
      setRecalculating(false)
    }
  }

  const busy = saving || recalculating

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-[96vw] w-full h-[90vh] flex flex-col p-0 gap-0">

        {/* Header */}
        <DialogHeader className="px-4 pt-4 pb-3 border-b shrink-0">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <DialogTitle className="text-base">{proposal.name} — edición manual</DialogTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {dirty && (
                <Button variant="ghost" size="sm" onClick={handleReset} disabled={busy}>
                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                  Descartar
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRecalculate}
                disabled={busy || !lockedIds.size}
                title={lockedIds.size === 0 ? "Fija al menos un alumno para recalcular el resto" : "Recalcular alumnos no fijados respetando los bloqueados"}
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1 ${recalculating ? "animate-spin" : ""}`} />
                {recalculating ? "Recalculando…" : "Recalcular"}
              </Button>
              <Button size="sm" onClick={handleSave} disabled={!dirty || busy}>
                <Save className="w-3.5 h-3.5 mr-1" />
                {saving ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </div>

          {/* Live rule count */}
          {rules.length > 0 && (
            <div className="flex items-center gap-3 mt-1.5 text-xs">
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="w-3.5 h-3.5" /> {fulfilled.length} cumplidas
              </span>
              {violated.length > 0 && (
                <span className="flex items-center gap-1 text-red-600">
                  <XCircle className="w-3.5 h-3.5" /> {violated.length} incumplidas
                </span>
              )}
              {dirty && <span className="text-orange-500 font-medium ml-auto">Cambios sin guardar</span>}
            </div>
          )}
        </DialogHeader>

        {/* Body */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Kanban */}
          <div className="flex-1 overflow-x-auto overflow-y-auto p-4">
            <DndContext
              sensors={sensors}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              <div className="flex gap-3 items-start">
                {targetClasses.map(cls => (
                  <ClassColumn
                    key={cls}
                    cls={cls}
                    assignments={assignments}
                    lockedIds={lockedIds}
                    onToggleLock={toggleLock}
                    activeId={activeId}
                    activeSrc={activeSrc}
                  />
                ))}
              </div>
              <DragOverlay dropAnimation={null}>
                {activeAssignment && <DragOverlayCard assignment={activeAssignment} />}
              </DragOverlay>
            </DndContext>
          </div>

          {/* Rules sidebar */}
          {rules.length > 0 && (
            <div className="w-60 shrink-0 border-l overflow-y-auto p-3 space-y-1.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Reglas</p>
              {ruleResults.map(({ rule, fulfilled: ok, details }) => {
                const isMandatory = rule.priority === "obligatoria" || rule.priority === "alta"
                return (
                  <div key={rule.id} className={`rounded p-2 text-xs border ${ok ? "bg-green-50 border-green-100" : isMandatory ? "bg-red-50 border-red-100" : "bg-amber-50 border-amber-100"}`}>
                    <div className="flex items-start gap-1.5">
                      <span className="mt-0.5 shrink-0">
                        {ok
                          ? <CheckCircle2 className="w-3 h-3 text-green-600" />
                          : isMandatory ? <XCircle className="w-3 h-3 text-red-500" />
                          : <AlertTriangle className="w-3 h-3 text-amber-500" />}
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium leading-tight truncate">
                          {rule.description ?? RULE_LABELS[rule.rule_type] ?? rule.rule_type}
                        </p>
                        <p className={`mt-0.5 ${ok ? "text-green-700" : isMandatory ? "text-red-700" : "text-amber-700"}`}>
                          {details}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t shrink-0 text-[11px] text-muted-foreground flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1"><GripVertical className="w-3 h-3" /> Arrastra entre clases</span>
          <span className="flex items-center gap-1"><Lock className="w-3 h-3 text-amber-500" /> Fija un alumno en su clase</span>
          <span className="flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Recalcula el resto respetando los fijados</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const RULE_LABELS: Record<string, string> = {
  must_separate: "Separar",
  should_keep_together: "Mantener juntos",
  must_keep_together: "Mantener juntos",
  lock_student_to_class: "Fijar en clase",
  max_from_group: "Máximo por clase",
  keep_at_least_one: "Al menos uno",
}
