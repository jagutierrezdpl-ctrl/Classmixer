"use client"

import { use, useEffect, useState, useMemo } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft, Save, Lock, Unlock, AlertTriangle,
  Loader2, UserCheck, UserX, GraduationCap, Users, RefreshCw,
} from "lucide-react"
import Link from "next/link"
import type { Student, Response, Rule } from "@/types"

interface LocalAssignment {
  student_id: string
  target_class: string
  locked: boolean
  student?: Student
}

interface ClassStats {
  count: number
  avgGrade: number
  female: number
  male: number
  studentsWithFriend: number
  studentsIsolated: number
  behaviorIssues: number
  withNeeds: number
}

function computeClassStats(
  cls: string,
  assignments: LocalAssignment[],
  friendships: Response[]
): ClassStats {
  const classAssignments = assignments.filter(a => a.target_class === cls)
  const classSet = new Set(classAssignments.map(a => a.student_id))
  const classStudents = classAssignments.map(a => a.student).filter(Boolean) as Student[]

  let studentsWithFriend = 0
  classStudents.forEach(s => {
    const hasFriend = friendships
      .filter(r => r.respondent_student_id === s.id)
      .some(r => classSet.has(r.target_student_id))
    if (hasFriend) studentsWithFriend++
  })

  const validGrades = classStudents.filter(s => s.average_grade > 0)
  return {
    count: classStudents.length,
    avgGrade:
      validGrades.length > 0
        ? validGrades.reduce((sum, s) => sum + s.average_grade, 0) / validGrades.length
        : 0,
    female: classStudents.filter(s => s.gender === "F").length,
    male: classStudents.filter(s => s.gender === "M").length,
    studentsWithFriend,
    studentsIsolated: classStudents.length - studentsWithFriend,
    behaviorIssues: classStudents.filter(s =>
      ["Seguimiento", "Conflictiva"].includes(s.behavior_level ?? "")
    ).length,
    withNeeds: classStudents.filter(s => s.needs_type && s.needs_type !== "No").length,
  }
}

function findViolations(assignments: LocalAssignment[], rules: Rule[]): string[] {
  const assignMap = new Map(assignments.map(a => [a.student_id, a.target_class]))
  const violations: string[] = []

  rules
    .filter(r => r.rule_type === "must_separate" && r.active)
    .forEach(r => {
      const ids = (r.students ?? []).map(rs => rs.student_id)
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const ci = assignMap.get(ids[i])
          const cj = assignMap.get(ids[j])
          if (ci && cj && ci === cj) {
            const sA = assignments.find(a => a.student_id === ids[i])?.student
            const sB = assignments.find(a => a.student_id === ids[j])?.student
            const nameA = sA ? `${sA.first_name} ${sA.last_name}` : ids[i]
            const nameB = sB ? `${sB.first_name} ${sB.last_name}` : ids[j]
            violations.push(
              r.description
                ? `${r.description}: ${nameA} y ${nameB} en ${ci}`
                : `Separación: ${nameA} y ${nameB} están en ${ci}`
            )
          }
        }
      }
    })

  return violations
}

export default function EditProposalPage({
  params,
}: {
  params: Promise<{ id: string; proposalId: string }>
}) {
  const { id: processId, proposalId } = use(params)

  const [loading, setLoading] = useState(true)
  const [proposalName, setProposalName] = useState("")
  const [targetClasses, setTargetClasses] = useState<string[]>([])
  const [assignments, setAssignments] = useState<LocalAssignment[]>([])
  const [friendships, setFriendships] = useState<Response[]>([])
  const [rules, setRules] = useState<Rule[]>([])
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [lastAction, setLastAction] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [recalculating, setRecalculating] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [propRes, procRes, respRes, rulesRes] = await Promise.all([
          fetch(`/api/proposals/${proposalId}`),
          fetch(`/api/processes/${processId}`),
          fetch(`/api/processes/${processId}/responses`),
          fetch(`/api/processes/${processId}/rules`),
        ])

        if (!propRes.ok || !procRes.ok) {
          toast.error("Error al cargar datos")
          return
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const prop: any = await propRes.json()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const proc: any = await procRes.json()
        const resp = respRes.ok ? await respRes.json() : []
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rulesData = rulesRes.ok ? (await rulesRes.json()) as any[] : []

        setProposalName(prop.name ?? "Propuesta")
        setTargetClasses((proc.target_groups as string[]) ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setAssignments((prop.proposal_assignments ?? []).map((a: any) => ({
          student_id: a.student_id,
          target_class: a.target_class,
          locked: a.locked ?? false,
          student: a.students,
        })))
        setFriendships(resp.filter((r: Response) => r.relation_type === "friendship"))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setRules(rulesData.map((r: any) => ({
          ...r,
          students: r.rule_students?.map((rs: { student_id: string }) => ({ student_id: rs.student_id })) ?? [],
        })))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [proposalId, processId])

  const violations = useMemo(() => findViolations(assignments, rules), [assignments, rules])

  function moveStudent(studentId: string, toClass: string) {
    const prev = assignments.find(a => a.student_id === studentId)
    if (!prev || prev.target_class === toClass || prev.locked) return

    const student = prev.student
    const fromClass = prev.target_class
    const name = student ? `${student.first_name} ${student.last_name}` : studentId

    setAssignments(old =>
      old.map(a => a.student_id === studentId ? { ...a, target_class: toClass } : a)
    )
    setLastAction(`${name} movido de ${fromClass} → ${toClass}`)
    setDirty(true)
  }

  function toggleLock(studentId: string) {
    setAssignments(old =>
      old.map(a => a.student_id === studentId ? { ...a, locked: !a.locked } : a)
    )
    setDirty(true)
  }

  async function handleRecalculate() {
    if (dirty) {
      toast.error("Guarda los cambios antes de recalcular")
      return
    }
    setRecalculating(true)
    try {
      const res = await fetch(`/api/proposals/${proposalId}/recalculate`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`Recalculado — ${data.recalculated} alumnos redistribuidos, ${data.locked_kept} bloqueados mantenidos`)
      // Reload assignments
      const propRes = await fetch(`/api/proposals/${proposalId}`)
      if (propRes.ok) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const prop: any = await propRes.json()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setAssignments((prop.proposal_assignments ?? []).map((a: any) => ({
          student_id: a.student_id,
          target_class: a.target_class,
          locked: a.locked ?? false,
          student: a.students,
        })))
      }
      setLastAction("Propuesta recalculada respetando alumnos bloqueados")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al recalcular")
    } finally {
      setRecalculating(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/proposals/${proposalId}/assignments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignments: assignments.map(a => ({
            student_id: a.student_id,
            target_class: a.target_class,
            locked: a.locked,
          })),
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success("Cambios guardados")
      setDirty(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b bg-card shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/processes/${processId}/proposals`}>
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div>
            <h1 className="font-bold text-base">Editar {proposalName}</h1>
            <p className="text-xs text-muted-foreground">
              Arrastra alumnos entre clases · Bloquea posiciones con el candado
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {violations.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
              <AlertTriangle className="w-3.5 h-3.5" />
              {violations.length} {violations.length === 1 ? "conflicto" : "conflictos"}
            </span>
          )}
          {dirty && (
            <Badge variant="warning" className="text-xs">Sin guardar</Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRecalculate}
            disabled={recalculating || dirty}
            title="Recalcular respetando alumnos bloqueados"
          >
            {recalculating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Recalcular
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !dirty}
            size="sm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar cambios
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Kanban board */}
        <div className="flex-1 overflow-x-auto overflow-y-auto p-4">
          <div className="flex gap-4 min-w-max h-full items-start">
            {targetClasses.map(cls => {
              const classAssignments = assignments.filter(a => a.target_class === cls)
              const stats = computeClassStats(cls, assignments, friendships)
              const isDragTarget = dropTarget === cls

              return (
                <div
                  key={cls}
                  className={`flex flex-col w-64 rounded-xl border-2 transition-colors ${
                    isDragTarget ? "border-primary bg-primary/5" : "border-border bg-card"
                  }`}
                  onDragOver={e => { e.preventDefault(); setDropTarget(cls) }}
                  onDragLeave={() => setDropTarget(null)}
                  onDrop={e => {
                    e.preventDefault()
                    setDropTarget(null)
                    if (draggingId) moveStudent(draggingId, cls)
                    setDraggingId(null)
                  }}
                >
                  {/* Column header */}
                  <div className="px-3 py-2.5 border-b">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-bold text-sm">{cls}</p>
                      <span className="text-xs text-muted-foreground">{classAssignments.length} alumnos</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-xs">
                      <span className="text-muted-foreground">
                        Nota: <strong>{stats.avgGrade.toFixed(1)}</strong>
                      </span>
                      <span className="text-muted-foreground">
                        {stats.female}F/{stats.male}M
                      </span>
                      <span className={stats.studentsIsolated > 0 ? "text-red-500" : "text-green-600"}>
                        {stats.studentsIsolated > 0
                          ? `${stats.studentsIsolated} sin amigo`
                          : "Todos conectados"}
                      </span>
                    </div>
                  </div>

                  {/* Student cards */}
                  <div className="flex-1 overflow-y-auto p-2 space-y-1.5 max-h-[calc(100vh-220px)]">
                    {classAssignments
                      .sort((a, b) => {
                        const la = a.student?.last_name ?? ""
                        const lb = b.student?.last_name ?? ""
                        return la.localeCompare(lb)
                      })
                      .map(a => {
                        const s = a.student
                        const behaviorBad = s?.behavior_level === "Seguimiento" || s?.behavior_level === "Conflictiva"
                        const hasNeeds = s?.needs_type && s.needs_type !== "No"

                        return (
                          <div
                            key={a.student_id}
                            draggable={!a.locked}
                            onDragStart={() => { if (!a.locked) setDraggingId(a.student_id) }}
                            onDragEnd={() => setDraggingId(null)}
                            className={`group flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs transition-all select-none ${
                              a.locked
                                ? "bg-muted/60 border-muted cursor-not-allowed opacity-80"
                                : draggingId === a.student_id
                                ? "opacity-40"
                                : "bg-background border-border cursor-grab hover:border-primary/40 hover:shadow-sm active:cursor-grabbing"
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">
                                {s?.first_name} {s?.last_name}
                              </p>
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className="text-muted-foreground">{s?.current_class}</span>
                                {s?.average_grade ? (
                                  <span className="text-muted-foreground">· {s.average_grade.toFixed(1)}</span>
                                ) : null}
                                {behaviorBad && (
                                  <span className="text-orange-500 font-medium">· ⚠</span>
                                )}
                                {hasNeeds && (
                                  <span className="text-purple-500">· NEE</span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => toggleLock(a.student_id)}
                              className={`shrink-0 p-0.5 rounded transition-opacity ${
                                a.locked
                                  ? "opacity-100 text-primary"
                                  : "opacity-0 group-hover:opacity-60 text-muted-foreground hover:text-primary"
                              }`}
                              title={a.locked ? "Desbloquear" : "Bloquear en esta clase"}
                            >
                              {a.locked ? (
                                <Lock className="w-3.5 h-3.5" />
                              ) : (
                                <Unlock className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        )
                      })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Impact panel */}
        <div className="w-72 shrink-0 border-l bg-card overflow-y-auto p-4 space-y-4">
          <h2 className="font-bold text-sm">Panel de impacto</h2>

          {/* Last action */}
          {lastAction && (
            <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-xs">
              <p className="text-muted-foreground mb-0.5">Último cambio</p>
              <p className="font-medium">{lastAction}</p>
            </div>
          )}

          {/* Rule violations */}
          {violations.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-red-600 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Conflictos activos
              </p>
              {violations.map((v, i) => (
                <div key={i} className="text-xs rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-red-700">
                  {v}
                </div>
              ))}
            </div>
          )}

          {/* Per-class stats */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Métricas por clase</p>
            {targetClasses.map(cls => {
              const stats = computeClassStats(cls, assignments, friendships)
              return (
                <Card key={cls} className="shadow-none">
                  <CardHeader className="pb-1 pt-3 px-3">
                    <CardTitle className="text-xs font-bold flex items-center justify-between">
                      {cls}
                      <span className="font-normal text-muted-foreground">{stats.count} alumnos</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3 space-y-1">
                    <div className="grid grid-cols-2 gap-x-2 text-xs">
                      <span className="text-muted-foreground">Nota media</span>
                      <span className="font-medium text-right">{stats.avgGrade.toFixed(2)}</span>
                      <span className="text-muted-foreground">Género</span>
                      <span className="font-medium text-right">{stats.female}F / {stats.male}M</span>
                      <span className="text-muted-foreground flex items-center gap-0.5">
                        <UserCheck className="w-3 h-3" /> Con amigo
                      </span>
                      <span className={`font-medium text-right ${stats.studentsIsolated > 0 ? "text-orange-500" : "text-green-600"}`}>
                        {stats.studentsWithFriend}/{stats.count}
                      </span>
                      {stats.studentsIsolated > 0 && (
                        <>
                          <span className="text-muted-foreground flex items-center gap-0.5">
                            <UserX className="w-3 h-3" /> Sin amigo
                          </span>
                          <span className="font-medium text-right text-red-500">{stats.studentsIsolated}</span>
                        </>
                      )}
                      {stats.behaviorIssues > 0 && (
                        <>
                          <span className="text-muted-foreground">Seguimiento</span>
                          <span className="font-medium text-right text-orange-500">{stats.behaviorIssues}</span>
                        </>
                      )}
                      {stats.withNeeds > 0 && (
                        <>
                          <span className="text-muted-foreground">Nec. educ.</span>
                          <span className="font-medium text-right text-purple-500">{stats.withNeeds}</span>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Legend */}
          <div className="pt-2 border-t space-y-1.5 text-xs text-muted-foreground">
            <p className="font-semibold">Leyenda de tarjetas</p>
            <p className="flex items-center gap-1.5"><GraduationCap className="w-3 h-3" /> NEE = Necesidades educativas</p>
            <p className="flex items-center gap-1.5"><Users className="w-3 h-3" /> ⚠ = Conducta en seguimiento</p>
            <p className="flex items-center gap-1.5"><Lock className="w-3 h-3" /> Candado = Posición bloqueada</p>
          </div>
        </div>
      </div>
    </div>
  )
}
