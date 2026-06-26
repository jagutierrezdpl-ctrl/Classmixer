"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  ArrowLeft, Users2, Loader2, RefreshCw, Printer,
  GraduationCap, UserCheck, BookOpen, Mic, Eye, Pencil, X, Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { GroupSession, GroupSet, GroupAssignment, Student } from "@/types"

// ─── Types ────────────────────────────────────────────────────────────────────

interface GroupAssignmentWithStudent extends GroupAssignment {
  students?: Student
}

interface GroupSetWithAssignments extends GroupSet {
  group_assignments?: GroupAssignmentWithStudent[]
}

interface GroupSessionDetail extends GroupSession {
  group_sets?: GroupSetWithAssignments[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  coordinador: { label: "Coordinador", color: "bg-blue-100 text-blue-700 border-blue-200", icon: UserCheck },
  secretario: { label: "Secretario", color: "bg-green-100 text-green-700 border-green-200", icon: BookOpen },
  portavoz: { label: "Portavoz", color: "bg-orange-100 text-orange-700 border-orange-200", icon: Mic },
  revisor: { label: "Revisor", color: "bg-purple-100 text-purple-700 border-purple-200", icon: Eye },
}

const GROUP_COLORS = [
  "border-blue-200 bg-blue-50/50",
  "border-green-200 bg-green-50/50",
  "border-orange-200 bg-orange-50/50",
  "border-purple-200 bg-purple-50/50",
  "border-pink-200 bg-pink-50/50",
  "border-teal-200 bg-teal-50/50",
  "border-indigo-200 bg-indigo-50/50",
  "border-yellow-200 bg-yellow-50/50",
]

const GROUP_HEADER_COLORS = [
  "bg-blue-100 text-blue-800",
  "bg-green-100 text-green-800",
  "bg-orange-100 text-orange-800",
  "bg-purple-100 text-purple-800",
  "bg-pink-100 text-pink-800",
  "bg-teal-100 text-teal-800",
  "bg-indigo-100 text-indigo-800",
  "bg-yellow-100 text-yellow-800",
]

function genderBadge(gender: string) {
  if (gender === "F") return <Badge variant="outline" className="text-xs border-pink-200 text-pink-600 bg-pink-50">F</Badge>
  if (gender === "M") return <Badge variant="outline" className="text-xs border-blue-200 text-blue-600 bg-blue-50">M</Badge>
  return <Badge variant="outline" className="text-xs">{gender}</Badge>
}

function buildGroups(assignments: GroupAssignmentWithStudent[]): Map<number, GroupAssignmentWithStudent[]> {
  const map = new Map<number, GroupAssignmentWithStudent[]>()
  for (const a of assignments) {
    if (!map.has(a.group_number)) map.set(a.group_number, [])
    map.get(a.group_number)!.push(a)
  }
  return map
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GroupSessionPage({ params }: { params: Promise<{ id: string; sessionId: string }> }) {
  const { id, sessionId } = use(params)

  const [session, setSession] = useState<GroupSessionDetail | null>(null)
  const [latestSet, setLatestSet] = useState<GroupSetWithAssignments | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  // Edit mode
  const [editMode, setEditMode] = useState(false)
  const [editAssignments, setEditAssignments] = useState<GroupAssignmentWithStudent[]>([])
  const [saving, setSaving] = useState(false)

  async function loadSession() {
    setLoading(true)
    try {
      const res = await fetch(`/api/processes/${id}/groups`)
      if (!res.ok) { toast.error("Error al cargar la sesión"); return }
      const sessions: GroupSessionDetail[] = await res.json()
      const s = sessions.find(s => s.id === sessionId)
      if (!s) { toast.error("Sesión no encontrada"); return }
      setSession(s)

      if (s.group_sets && s.group_sets.length > 0) {
        const latest = s.group_sets.sort((a, b) =>
          new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime()
        )[0]
        await loadGroupSet(latest.id)
      }
    } catch {
      toast.error("Error inesperado")
    } finally {
      setLoading(false)
    }
  }

  async function loadGroupSet(setId: string) {
    const res = await fetch(`/api/group-sets/${setId}`)
    if (res.ok) {
      const data = await res.json()
      setLatestSet(data)
    }
  }

  useEffect(() => { loadSession() }, [sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleGenerate() {
    setGenerating(true)
    try {
      const res = await fetch(`/api/processes/${id}/groups/${sessionId}/generate`, { method: "POST" })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? "Error al generar grupos")
        return
      }
      const result = await res.json()
      toast.success(`Grupos generados (puntuación: ${result.score_total?.toFixed(1)})`)
      await loadGroupSet(result.id)
      await loadSession()
    } catch {
      toast.error("Error inesperado")
    } finally {
      setGenerating(false)
    }
  }

  function enterEdit() {
    if (!latestSet?.group_assignments) return
    setEditAssignments([...latestSet.group_assignments])
    setEditMode(true)
  }

  function exitEdit() {
    setEditMode(false)
    setEditAssignments([])
  }

  function moveStudent(studentId: string, newGroup: number) {
    setEditAssignments(prev => prev.map(a =>
      a.student_id === studentId ? { ...a, group_number: newGroup } : a
    ))
  }

  async function handleSave() {
    if (!latestSet) return
    setSaving(true)
    try {
      const res = await fetch(`/api/group-sets/${latestSet.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignments: editAssignments.map(a => ({
            student_id: a.student_id,
            group_number: a.group_number,
            role: a.role,
          })),
        }),
      })
      if (!res.ok) {
        toast.error("Error al guardar los cambios")
        return
      }
      toast.success("Cambios guardados")
      exitEdit()
      await loadGroupSet(latestSet.id)
    } catch {
      toast.error("Error inesperado")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Sesión no encontrada.</p>
        <Button variant="outline" asChild className="mt-4">
          <Link href={`/processes/${id}/groups`}>Volver</Link>
        </Button>
      </div>
    )
  }

  const displayAssignments = editMode ? editAssignments : (latestSet?.group_assignments ?? [])
  const groups = displayAssignments.length > 0 ? buildGroups(displayAssignments) : new Map<number, GroupAssignmentWithStudent[]>()
  const sortedGroupNumbers = [...groups.keys()].sort((a, b) => a - b)
  const numGroups = session.num_groups

  return (
    <div className="p-8 print:p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:justify-between mb-8 print:hidden">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/processes/${id}/groups`}><ArrowLeft className="w-4 h-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{session.name}</h1>
            <p className="text-muted-foreground text-sm">
              Clase {session.class_name} · {numGroups} grupos
              {session.balance_gender ? " · Equilibrio de género" : ""}
              {session.balance_academic ? " · Equilibrio académico" : ""}
              {session.use_sociogram ? " · Sociograma" : ""}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {latestSet && !editMode && (
            <>
              <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2">
                <Printer className="w-4 h-4" /> Imprimir
              </Button>
              <Button variant="outline" size="sm" onClick={enterEdit} className="gap-2">
                <Pencil className="w-4 h-4" /> Editar
              </Button>
            </>
          )}
          {editMode ? (
            <>
              <Button variant="outline" size="sm" onClick={exitEdit} disabled={saving} className="gap-2">
                <X className="w-4 h-4" /> Descartar
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Guardar cambios
              </Button>
            </>
          ) : (
            <Button onClick={handleGenerate} disabled={generating} className="gap-2">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {latestSet ? "Regenerar" : "Generar grupos"}
            </Button>
          )}
        </div>
      </div>

      {/* Print header */}
      <div className="hidden print:block mb-6">
        <h1 className="text-xl font-bold">{session.name}</h1>
        <p className="text-sm text-gray-600">Clase {session.class_name} · {numGroups} grupos</p>
      </div>

      {/* Edit mode banner */}
      {editMode && (
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <Pencil className="w-4 h-4 shrink-0" />
          Modo edición — usa los selectores para mover alumnos entre grupos. Los cambios no se guardan hasta pulsar «Guardar cambios».
        </div>
      )}

      {/* Score banner */}
      {latestSet && !editMode && (
        <div className="mb-6 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-sm px-3 py-1">
              {latestSet.name}
            </Badge>
            {latestSet.score_total != null && (
              <Badge variant="outline" className="text-sm px-3 py-1">
                Puntuación: {latestSet.score_total.toFixed(1)}
              </Badge>
            )}
            <Badge
              variant={latestSet.status === "aprobado" ? "default" : "secondary"}
              className="text-xs"
            >
              {latestSet.status === "aprobado" ? "Aprobado" : "Generado"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {latestSet.group_assignments?.length ?? 0} alumnos distribuidos en {sortedGroupNumbers.length} grupos
          </p>
        </div>
      )}

      {/* No groups yet */}
      {!latestSet && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Users2 className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="font-medium">Todavía no se han generado grupos</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Pulsa el botón para generar los grupos para la clase {session.class_name}
            </p>
            <Button onClick={handleGenerate} disabled={generating} className="gap-2">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users2 className="w-4 h-4" />}
              Generar grupos
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Groups grid */}
      {sortedGroupNumbers.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 print:grid-cols-3 print:gap-3">
          {sortedGroupNumbers.map(groupNumber => {
            const members = groups.get(groupNumber) ?? []
            const colorIdx = (groupNumber - 1) % GROUP_COLORS.length
            return (
              <Card key={groupNumber} className={`border ${GROUP_COLORS[colorIdx]}`}>
                <CardHeader className="pb-2 pt-3 px-4">
                  <div className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-semibold w-fit ${GROUP_HEADER_COLORS[colorIdx]}`}>
                    <GraduationCap className="w-3.5 h-3.5" />
                    Grupo {groupNumber}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{members.length} alumnos</p>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  {members
                    .sort((a, b) => (a.role && !b.role ? -1 : !a.role && b.role ? 1 : 0))
                    .map((assignment) => {
                      const student = assignment.students
                      const roleConf = assignment.role ? ROLE_CONFIG[assignment.role] : null
                      return (
                        <div key={assignment.id ?? assignment.student_id} className="py-1 border-b border-black/5 last:border-0">
                          <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium leading-tight truncate">
                                {student ? `${student.first_name} ${student.last_name}` : "—"}
                              </p>
                              <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                {student && genderBadge(student.gender)}
                                {student?.academic_level && (
                                  <span className="text-xs text-muted-foreground">{student.academic_level}</span>
                                )}
                              </div>
                            </div>
                            {!editMode && roleConf && (
                              <Badge
                                variant="outline"
                                className={`text-xs border shrink-0 ${roleConf.color}`}
                              >
                                {roleConf.label}
                              </Badge>
                            )}
                          </div>
                          {editMode && (
                            <div className="mt-1.5">
                              <Select
                                value={String(assignment.group_number)}
                                onValueChange={(v) => moveStudent(assignment.student_id, Number(v))}
                              >
                                <SelectTrigger className="h-7 text-xs w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: numGroups }, (_, i) => i + 1).map(n => (
                                    <SelectItem key={n} value={String(n)} className="text-xs">
                                      Grupo {n}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                      )
                    })}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Previous sets list */}
      {session.group_sets && session.group_sets.length > 1 && !editMode && (
        <div className="mt-8 print:hidden">
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">Distribuciones anteriores</h2>
          <div className="flex flex-wrap gap-2">
            {session.group_sets
              .sort((a, b) => new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime())
              .map((gs, idx) => (
                <Button
                  key={gs.id}
                  variant={gs.id === latestSet?.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => loadGroupSet(gs.id)}
                  className="gap-2"
                >
                  {gs.name}
                  {gs.score_total != null && (
                    <span className="text-xs opacity-70">({gs.score_total.toFixed(0)})</span>
                  )}
                  {idx === 0 && gs.id !== latestSet?.id && (
                    <Badge variant="secondary" className="text-xs ml-1">última</Badge>
                  )}
                </Button>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
