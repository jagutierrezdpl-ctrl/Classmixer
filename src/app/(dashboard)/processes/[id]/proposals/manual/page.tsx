"use client"

import { use, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  DndContext, DragOverlay, useDraggable, useDroppable,
  PointerSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent,
} from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft, GripVertical, Save, Users, Search,
  Heart, GraduationCap, CheckCircle2, XCircle, AlertTriangle, RotateCcw,
} from "lucide-react"
import Link from "next/link"
import type { Student, Rule } from "@/types"

// ---------- types ----------

interface Response { respondent_student_id: string; target_student_id: string; relation_type: string }

// ---------- live stats helpers ----------

function friendsInClass(
  sid: string,
  cls: string,
  assignments: Record<string, string>,
  friendMap: Map<string, Set<string>>
): number {
  const chosen = friendMap.get(sid) ?? new Set()
  return [...chosen].filter(cid => assignments[cid] === cls).length
}

function classStats(
  cls: string,
  assignments: Record<string, string>,
  studentMap: Map<string, Student>,
  friendMap: Map<string, Set<string>>
) {
  const ids = Object.entries(assignments).filter(([, c]) => c === cls).map(([id]) => id)
  const students = ids.map(id => studentMap.get(id)).filter(Boolean) as Student[]
  const withGrade = students.filter(s => (s.average_grade ?? 0) > 0)
  const avgGrade = withGrade.length > 0
    ? withGrade.reduce((s, a) => s + a.average_grade!, 0) / withGrade.length : 0
  const female = students.filter(s => s.gender === "F").length
  const male = students.filter(s => s.gender === "M").length
  const withFriend = ids.filter(id => friendsInClass(id, cls, assignments, friendMap) > 0).length
  return { count: students.length, avgGrade, female, male, withFriend }
}

function ruleResults(rules: Rule[], assignments: Record<string, string>) {
  const clsOf = (sid: string) => assignments[sid]
  return rules
    .filter(r => r.active && r.rule_type !== "exclude_student" && r.rule_type !== "protect_vulnerable")
    .map(rule => {
      const ids = (rule.students ?? []).map(rs => rs.student_id)
      let ok = true; let details = ""
      if (rule.rule_type === "must_separate") {
        for (let i = 0; i < ids.length && ok; i++)
          for (let j = i + 1; j < ids.length; j++) {
            const a = clsOf(ids[i]), b = clsOf(ids[j])
            if (a && b && a === b) { ok = false; break }
          }
        details = ok ? "Separados" : "En la misma clase"
      } else if (rule.rule_type === "must_keep_together" || rule.rule_type === "should_keep_together") {
        const classes = [...new Set(ids.map(clsOf).filter(Boolean))]
        ok = classes.length <= 1
        details = ok ? `Juntos en ${classes[0] ?? "—"}` : "En clases distintas"
      } else if (rule.rule_type === "lock_student_to_class") {
        const cls = clsOf(ids[0])
        ok = cls === rule.target_class
        details = ok ? `En ${rule.target_class}` : `En ${cls ?? "?"}`
      } else if (rule.rule_type === "max_from_group") {
        const max = rule.max_count ?? 1
        const perClass: Record<string, number> = {}
        for (const sid of ids) { const c = clsOf(sid); if (c) perClass[c] = (perClass[c] ?? 0) + 1 }
        const worst = Object.entries(perClass).find(([, n]) => n > max)
        ok = !worst
        details = ok ? `Máx ${max} OK` : `${worst?.[1]} en ${worst?.[0]} (máx ${max})`
      } else { details = "OK" }
      return { rule, ok, details }
    })
}

// ---------- draggable student card ----------

function StudentCard({
  student, isDragging, friendCount, isUnassigned,
}: {
  student: Student; isDragging: boolean; friendCount: number; isUnassigned: boolean
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: student.id })
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined
  const gColor = student.gender === "F" ? "bg-pink-100 text-pink-700" : student.gender === "M" ? "bg-blue-100 text-blue-700" : "bg-muted text-muted-foreground"

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-1.5 px-2 py-1.5 rounded border text-xs select-none cursor-grab active:cursor-grabbing transition-all
        ${isDragging ? "opacity-30" : ""}
        ${isUnassigned ? "bg-white border-border hover:border-primary/50 hover:shadow-sm" : "bg-white border-border hover:border-primary/40 hover:shadow-sm"}`}
    >
      <span {...attributes} {...listeners} className="text-muted-foreground/40 shrink-0">
        <GripVertical className="w-3 h-3" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate leading-tight">{student.first_name} {student.last_name}</p>
        <p className="text-muted-foreground/70 text-[10px] truncate">
          {student.current_class}{student.average_grade ? ` · ${student.average_grade.toFixed(1)}` : ""}
        </p>
      </div>
      <span className={`shrink-0 text-[10px] font-medium px-1 rounded ${gColor}`}>{student.gender ?? "?"}</span>
      {!isUnassigned && friendCount > 0 && (
        <span className="text-[10px] text-pink-600 flex items-center gap-0.5">
          <Heart className="w-2.5 h-2.5" />{friendCount}
        </span>
      )}
    </div>
  )
}

function DragOverlayCard({ student }: { student: Student }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5 rounded border bg-white shadow-xl text-xs w-44 rotate-1 border-primary/40">
      <GripVertical className="w-3 h-3 text-muted-foreground/40" />
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{student.first_name} {student.last_name}</p>
        <p className="text-muted-foreground/70 text-[10px]">{student.current_class}</p>
      </div>
    </div>
  )
}

// ---------- droppable class column ----------

const UNASSIGNED_ID = "__unassigned__"

function ClassColumn({
  cls, assignments, students: allStudents, friendMap, rules: allRules, activeId,
}: {
  cls: string; assignments: Record<string, string>; students: Map<string, Student>
  friendMap: Map<string, Set<string>>; rules: Rule[]; activeId: string | null
}) {
  const { setNodeRef, isOver } = useDroppable({ id: cls })
  const isTarget = isOver && activeId !== null && assignments[activeId ?? ""] !== cls

  const ids = Object.entries(assignments).filter(([, c]) => c === cls).map(([id]) => id)
  const sorted = [...ids].sort((a, b) => {
    const sa = allStudents.get(a), sb = allStudents.get(b)
    return (sa?.last_name ?? "").localeCompare(sb?.last_name ?? "")
  })
  const stats = classStats(cls, assignments, allStudents, friendMap)

  // gender bar
  const total = stats.female + stats.male
  const fPct = total > 0 ? (stats.female / total) * 100 : 50

  return (
    <div className="flex flex-col min-w-[210px] max-w-[240px] flex-shrink-0 h-full">
      {/* Header */}
      <div className={`rounded-t-lg px-3 py-2.5 border border-b-0 transition-colors ${isTarget ? "bg-primary/10 border-primary/50" : "bg-muted/60 border-border"}`}>
        <div className="flex items-center justify-between mb-1">
          <p className="font-bold text-sm">{cls}</p>
          <span className="text-xs text-muted-foreground font-medium">{stats.count} alumnos</span>
        </div>

        {/* Grade */}
        {stats.avgGrade > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
            <GraduationCap className="w-3 h-3" />
            <span>Nota media: <strong className="text-foreground">{stats.avgGrade.toFixed(1)}</strong></span>
          </div>
        )}

        {/* Gender bar */}
        {total > 0 && (
          <div className="space-y-0.5">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span className="text-pink-600">{stats.female}F</span>
              <span className="text-blue-600">{stats.male}M</span>
            </div>
            <div className="h-1.5 rounded-full bg-blue-200 overflow-hidden">
              <div className="h-full bg-pink-400 rounded-full transition-all" style={{ width: `${fPct}%` }} />
            </div>
          </div>
        )}

        {/* Friends */}
        {stats.count > 0 && (
          <div className="flex items-center gap-1 text-[10px] mt-1">
            <Heart className="w-2.5 h-2.5 text-pink-500" />
            <span className={stats.withFriend === stats.count ? "text-green-600" : stats.withFriend > 0 ? "text-amber-600" : "text-red-500"}>
              {stats.withFriend}/{stats.count} con amigo
            </span>
          </div>
        )}
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={`flex-1 rounded-b-lg border p-2 space-y-1 overflow-y-auto transition-colors min-h-[80px]
          ${isTarget ? "bg-primary/5 border-primary/40 border-dashed" : "bg-background border-border"}`}
      >
        {sorted.map(sid => {
          const s = allStudents.get(sid)
          if (!s) return null
          const fc = friendsInClass(sid, cls, assignments, friendMap)
          return (
            <StudentCard
              key={sid}
              student={s}
              isDragging={activeId === sid}
              friendCount={fc}
              isUnassigned={false}
            />
          )
        })}
        {sorted.length === 0 && (
          <div className="flex items-center justify-center h-16 text-xs text-muted-foreground/40 border-2 border-dashed border-muted rounded">
            Suelta aquí
          </div>
        )}
      </div>
    </div>
  )
}

// ---------- unassigned pool ----------

function UnassignedPool({ students, assignments, activeId }: {
  students: Student[]; assignments: Record<string, string>; activeId: string | null
}) {
  const { setNodeRef, isOver } = useDroppable({ id: UNASSIGNED_ID })
  const [search, setSearch] = useState("")

  const unassigned = students.filter(s => !assignments[s.id])
  const filtered = unassigned.filter(s =>
    search === "" || `${s.first_name} ${s.last_name} ${s.current_class}`.toLowerCase().includes(search.toLowerCase())
  )
  const sorted = [...filtered].sort((a, b) => a.last_name.localeCompare(b.last_name))

  return (
    <div className="w-56 shrink-0 flex flex-col border-r bg-muted/20 h-full">
      <div className="px-3 pt-3 pb-2 border-b bg-background">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold">Sin asignar</p>
          <Badge variant="secondary" className="text-xs">{unassigned.length}</Badge>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="pl-7 h-7 text-xs"
          />
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto p-2 space-y-1 transition-colors ${isOver ? "bg-primary/5" : ""}`}
      >
        {sorted.map(s => (
          <StudentCard
            key={s.id}
            student={s}
            isDragging={activeId === s.id}
            friendCount={0}
            isUnassigned
          />
        ))}
        {unassigned.length === 0 && (
          <div className="text-xs text-center text-green-600 mt-4 px-2">
            ✓ Todos los alumnos están asignados
          </div>
        )}
        {unassigned.length > 0 && filtered.length === 0 && (
          <p className="text-xs text-muted-foreground text-center mt-4">Sin resultados</p>
        )}
      </div>
    </div>
  )
}

// ---------- main page ----------

export default function ManualProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [students, setStudents] = useState<Student[]>([])
  const [responses, setResponses] = useState<Response[]>([])
  const [rules, setRules] = useState<Rule[]>([])
  const [targetClasses, setTargetClasses] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  // assignments: student_id → target_class (or absent if unassigned)
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [activeId, setActiveId] = useState<string | null>(null)
  const [proposalName, setProposalName] = useState("Lista manual")
  const [saving, setSaving] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  useEffect(() => {
    Promise.all([
      fetch(`/api/processes/${id}`).then(r => r.json()),
      fetch(`/api/processes/${id}/students`).then(r => r.json()),
      fetch(`/api/processes/${id}/responses`).then(r => r.json()),
      fetch(`/api/processes/${id}/rules`).then(r => r.json()),
    ]).then(([proc, studs, resps, rls]) => {
      setTargetClasses((proc.target_groups ?? []).sort())
      setStudents(Array.isArray(studs) ? studs : [])
      setResponses(Array.isArray(resps) ? resps : [])
      setRules(Array.isArray(rls) ? rls.filter((r: Rule) => r.active && r.rule_type !== "exclude_student") : [])
    }).finally(() => setLoading(false))
  }, [id])

  const studentMap = useMemo(() => new Map(students.map(s => [s.id, s])), [students])

  // friendship map: student_id → Set of student_ids they chose (friendship-like)
  const friendMap = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const r of responses) {
      if (r.relation_type === "friendship" || r.relation_type === "work") {
        if (!m.has(r.respondent_student_id)) m.set(r.respondent_student_id, new Set())
        m.get(r.respondent_student_id)!.add(r.target_student_id)
      }
    }
    return m
  }, [responses])

  const activeStudent = activeId ? studentMap.get(activeId) : null

  const rules_results = useMemo(() => ruleResults(rules, assignments), [rules, assignments])
  const violated = rules_results.filter(r => !r.ok)
  const fulfilled_count = rules_results.filter(r => r.ok).length

  const unassignedCount = students.filter(s => !assignments[s.id]).length
  const allAssigned = unassignedCount === 0

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id))
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    setActiveId(null)
    if (!over) return
    const sid = String(active.id)
    const dest = String(over.id)
    if (dest === UNASSIGNED_ID) {
      setAssignments(prev => { const n = { ...prev }; delete n[sid]; return n })
    } else {
      if (assignments[sid] === dest) return
      setAssignments(prev => ({ ...prev, [sid]: dest }))
    }
  }

  function handleReset() {
    setAssignments({})
  }

  async function handleSave() {
    if (!allAssigned) {
      toast.error(`Faltan ${unassignedCount} alumnos por asignar`)
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/processes/${id}/proposals/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: proposalName,
          assignments: Object.entries(assignments).map(([student_id, target_class]) => ({ student_id, target_class })),
        }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      toast.success("Propuesta guardada")
      router.push(`/processes/${id}/proposals`)
    } catch {
      toast.error("Error al guardar")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-sm text-muted-foreground">
        Cargando alumnos…
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-background">

      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b bg-background shrink-0 flex-wrap">
        <Link href={`/processes/${id}/proposals`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1" /> Volver
          </Button>
        </Link>

        <div className="flex-1 min-w-0">
          <Input
            value={proposalName}
            onChange={e => setProposalName(e.target.value)}
            className="h-8 text-sm font-medium max-w-xs"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
          {unassignedCount > 0
            ? <span className="text-orange-500 font-medium">{unassignedCount} sin asignar</span>
            : <span className="text-green-600 font-medium flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Todos asignados</span>
          }
          {rules.length > 0 && (
            <>
              <span className="text-green-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {fulfilled_count}</span>
              {violated.length > 0 && <span className="text-red-600 flex items-center gap-1"><XCircle className="w-3 h-3" /> {violated.length}</span>}
            </>
          )}
        </div>

        <Button variant="outline" size="sm" onClick={handleReset} disabled={Object.keys(assignments).length === 0}>
          <RotateCcw className="w-3.5 h-3.5 mr-1" /> Empezar de cero
        </Button>

        <Button size="sm" onClick={handleSave} disabled={saving || !allAssigned}>
          <Save className="w-3.5 h-3.5 mr-1" />
          {saving ? "Guardando…" : "Guardar propuesta"}
        </Button>
      </div>

      {/* Main area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>

          {/* Unassigned pool */}
          <UnassignedPool students={students} assignments={assignments} activeId={activeId} />

          {/* Class columns */}
          <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
            <div className="flex gap-3 h-full">
              {targetClasses.map(cls => (
                <ClassColumn
                  key={cls}
                  cls={cls}
                  assignments={assignments}
                  students={studentMap}
                  friendMap={friendMap}
                  rules={rules}
                  activeId={activeId}
                />
              ))}
            </div>
          </div>

          {/* Rules sidebar */}
          {rules.length > 0 && (
            <div className="w-56 shrink-0 border-l overflow-y-auto p-3 space-y-1.5 bg-muted/10">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Reglas</p>
              {rules_results.map(({ rule, ok, details }) => {
                const isMandatory = rule.priority === "obligatoria" || rule.priority === "alta"
                return (
                  <div key={rule.id} className={`rounded p-2 text-xs border ${ok ? "bg-green-50 border-green-100" : isMandatory ? "bg-red-50 border-red-100" : "bg-amber-50 border-amber-100"}`}>
                    <div className="flex items-start gap-1.5">
                      <span className="shrink-0 mt-0.5">
                        {ok ? <CheckCircle2 className="w-3 h-3 text-green-600" />
                          : isMandatory ? <XCircle className="w-3 h-3 text-red-500" />
                          : <AlertTriangle className="w-3 h-3 text-amber-500" />}
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium truncate leading-tight">{rule.description ?? rule.rule_type}</p>
                        <p className={`mt-0.5 ${ok ? "text-green-700" : isMandatory ? "text-red-700" : "text-amber-700"}`}>{details}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <DragOverlay dropAnimation={null}>
            {activeStudent && <DragOverlayCard student={activeStudent} />}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Bottom hint */}
      <div className="px-4 py-1.5 border-t shrink-0 text-[11px] text-muted-foreground flex items-center gap-4">
        <span className="flex items-center gap-1"><GripVertical className="w-3 h-3" /> Arrastra alumnos del panel izquierdo a una clase</span>
        <span className="flex items-center gap-1"><Heart className="w-3 h-3 text-pink-500" /> Número de amigos en la misma clase</span>
        <span className="ml-auto">Los cambios se ven en tiempo real</span>
      </div>
    </div>
  )
}
