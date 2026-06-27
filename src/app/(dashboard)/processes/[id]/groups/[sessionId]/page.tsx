"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowLeft, Users2, Loader2, RefreshCw, Printer,
  GraduationCap, UserCheck, BookOpen, Mic, Eye, Pencil, X, Check, CheckCircle2,
  ShieldAlert, Plus, Trash2, FileText, TrendingUp, AlertTriangle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import type { GroupSession, GroupSet, GroupAssignment, Student, SociogramSnapshot, GroupRationale } from "@/types"

// ─── Cooperative rule types ───────────────────────────────────────────────────

interface CoopRuleStudent {
  student_id: string
  students: { id: string; first_name: string; last_name: string }
}

interface CoopRule {
  id: string
  rule_type: "must_separate" | "must_keep_together"
  description: string | null
  cooperative_rule_students: CoopRuleStudent[]
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface GroupAssignmentWithStudent extends GroupAssignment {
  students?: Student
}

interface GroupSetWithAssignments extends GroupSet {
  group_assignments?: GroupAssignmentWithStudent[]
}

interface GroupSessionDetail extends GroupSession {
  group_sets?: GroupSetWithAssignments[]
  sociogram_snapshots?: Pick<SociogramSnapshot, "id" | "name"> | null
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

// ─── Rationale panel ──────────────────────────────────────────────────────────

function RationalePanel({ rationale, onClose }: { rationale: GroupRationale; onClose: () => void }) {
  const r = rationale
  const LEVEL_COLOR: Record<string, string> = {
    "Alto": "text-green-700 bg-green-50", "Medio-alto": "text-teal-700 bg-teal-50",
    "Medio": "text-blue-700 bg-blue-50", "Medio-bajo": "text-orange-700 bg-orange-50",
    "Bajo": "text-red-700 bg-red-50",
  }
  return (
    <div className="mb-6 rounded-xl border bg-card shadow-sm print:hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b">
        <h2 className="font-semibold flex items-center gap-2 text-sm">
          <FileText className="w-4 h-4 text-primary" /> Informe de generación — {r.settings.balance_gender ? "equilibrio género · " : ""}{r.settings.balance_academic ? "equilibrio nivel · " : ""}{r.settings.use_sociogram ? `sociograma${r.settings.snapshot_name ? ` (${r.settings.snapshot_name})` : ""} · ` : ""}Puntuación {r.score.toFixed(1)}
        </h2>
        <Button variant="ghost" size="icon" className="w-7 h-7" onClick={onClose}><X className="w-4 h-4" /></Button>
      </div>

      <div className="p-5 space-y-5">
        {/* Summary row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Alumnos", value: r.totals.students },
            { label: "Reglas cumplidas", value: r.totals.rules_satisfied, color: "text-green-600" },
            { label: "Reglas incumplidas", value: r.totals.rules_violated, color: r.totals.rules_violated > 0 ? "text-red-600" : "text-muted-foreground" },
            r.settings.use_sociogram
              ? { label: "Pares con afinidad", value: r.totals.social_pairs_within, color: "text-blue-600" }
              : { label: "Pares repetidos evitados", value: `−${r.totals.repeated_pairs}`, color: "text-orange-600" },
          ].map(item => (
            <div key={item.label} className="rounded-lg border px-4 py-3 text-center">
              <p className={`text-2xl font-bold ${item.color ?? ""}`}>{item.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>

        {/* Rules */}
        {r.rules.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Reglas aplicadas</h3>
            <div className="space-y-1.5">
              {r.rules.map((rule, i) => (
                <div key={i} className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${rule.satisfied ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                  {rule.satisfied
                    ? <Check className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                    : <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />}
                  <div>
                    <span className="font-medium">{rule.type === "must_separate" ? "Separar" : "Juntar"}:</span>{" "}
                    {rule.students.join(" · ")}
                    {!rule.satisfied && <span className="ml-2 text-red-600 text-xs">No fue posible cumplir esta regla</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Per-group stats */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Detalle por grupo</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {r.groups.map(g => (
              <div key={g.number} className="rounded-lg border px-4 py-3 space-y-2">
                <p className="font-semibold text-sm">Grupo {g.number} <span className="text-muted-foreground font-normal">({g.size} alumnos)</span></p>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {Object.entries(g.gender).map(([gen, n]) => (
                    <span key={gen} className={`rounded px-1.5 py-0.5 border ${gen === "F" ? "border-pink-200 bg-pink-50 text-pink-700" : gen === "M" ? "border-blue-200 bg-blue-50 text-blue-700" : "border-gray-200 bg-gray-50"}`}>
                      {gen} {n}
                    </span>
                  ))}
                  {g.avg_grade != null && (
                    <span className="rounded px-1.5 py-0.5 border border-gray-200 bg-gray-50 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" /> {g.avg_grade.toFixed(1)}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1 text-xs">
                  {Object.entries(g.levels).sort(([, a], [, b]) => b - a).map(([lvl, n]) => (
                    <span key={lvl} className={`rounded px-1.5 py-0.5 ${LEVEL_COLOR[lvl] ?? "bg-gray-50 text-gray-700"}`}>
                      {lvl} {n}
                    </span>
                  ))}
                </div>
                {(g.social_pairs > 0 || g.conflict_pairs > 0 || g.repeated_pairs > 0) && (
                  <div className="text-xs text-muted-foreground space-y-0.5 pt-1 border-t">
                    {g.social_pairs > 0 && <p className="text-blue-600">{g.social_pairs} par{g.social_pairs > 1 ? "es" : ""} con afinidad</p>}
                    {g.conflict_pairs > 0 && <p className="text-red-600">{g.conflict_pairs} par{g.conflict_pairs > 1 ? "es" : ""} en conflicto</p>}
                    {g.repeated_pairs > 0 && <p className="text-orange-600">{g.repeated_pairs} par{g.repeated_pairs > 1 ? "es" : ""} ya agrupados antes</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GroupSessionPage({ params }: { params: Promise<{ id: string; sessionId: string }> }) {
  const { id, sessionId } = use(params)
  const router = useRouter()

  const [session, setSession] = useState<GroupSessionDetail | null>(null)
  const [latestSet, setLatestSet] = useState<GroupSetWithAssignments | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  // Edit mode
  const [editMode, setEditMode] = useState(false)
  const [editAssignments, setEditAssignments] = useState<GroupAssignmentWithStudent[]>([])
  const [saving, setSaving] = useState(false)

  // Rationale report
  const [showRationale, setShowRationale] = useState(false)

  // Cooperative rules
  const [rules, setRules] = useState<CoopRule[]>([])
  const [classStudents, setClassStudents] = useState<Student[]>([])
  const [showRuleDialog, setShowRuleDialog] = useState(false)
  const [newRuleType, setNewRuleType] = useState<"must_separate" | "must_keep_together">("must_separate")
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])
  const [savingRule, setSavingRule] = useState(false)

  async function loadSession() {
    setLoading(true)
    try {
      const res = await fetch(`/api/processes/${id}/groups`)
      if (!res.ok) { toast.error("Error al cargar la sesión"); return }
      const sessions: GroupSessionDetail[] = await res.json()
      const s = sessions.find(s => s.id === sessionId)
      if (!s) { toast.error("Sesión no encontrada"); return }
      setSession(s)
      await Promise.all([
        loadRules(),
        loadClassStudents(s.class_name),
      ])

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

  function changeRole(studentId: string, role: string | null) {
    setEditAssignments(prev => prev.map(a =>
      a.student_id === studentId ? { ...a, role } : a
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

  async function handleApprove() {
    if (!latestSet) return
    try {
      const res = await fetch(`/api/group-sets/${latestSet.id}/approve`, { method: "POST" })
      if (!res.ok) { toast.error("Error al aprobar"); return }
      toast.success("Grupos aprobados como definitivos")
      await loadGroupSet(latestSet.id)
    } catch {
      toast.error("Error inesperado")
    }
  }

  async function handleUnapprove() {
    if (!latestSet) return
    try {
      const res = await fetch(`/api/group-sets/${latestSet.id}/approve`, { method: "DELETE" })
      if (!res.ok) { toast.error("Error al desaprobar"); return }
      toast.success("Marcado como borrador de nuevo")
      await loadGroupSet(latestSet.id)
    } catch {
      toast.error("Error inesperado")
    }
  }

  async function handleDeleteSession() {
    if (!session) return
    if (!confirm(`¿Eliminar la sesión "${session.name}"? Se borrarán todas sus distribuciones y reglas.`)) return
    try {
      const res = await fetch(`/api/processes/${id}/groups/${sessionId}`, { method: "DELETE" })
      if (!res.ok) { toast.error("Error al eliminar"); return }
      toast.success("Sesión eliminada")
      router.push(`/cooperativo`)
    } catch {
      toast.error("Error inesperado")
    }
  }

  async function loadRules() {
    const res = await fetch(`/api/cooperative/${sessionId}/rules`)
    if (res.ok) setRules(await res.json())
  }

  async function loadClassStudents(className: string) {
    const res = await fetch(`/api/processes/${id}/students?class=${encodeURIComponent(className)}`)
    if (res.ok) {
      const all: Student[] = await res.json()
      setClassStudents(all.filter(s => s.active !== false))
    }
  }

  async function handleAddRule() {
    if (selectedStudentIds.length < 2) {
      toast.error("Selecciona al menos 2 alumnos")
      return
    }
    setSavingRule(true)
    try {
      const res = await fetch(`/api/cooperative/${sessionId}/rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rule_type: newRuleType, student_ids: selectedStudentIds }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? "Error al crear la regla")
        return
      }
      toast.success("Regla creada")
      setShowRuleDialog(false)
      setSelectedStudentIds([])
      await loadRules()
    } catch {
      toast.error("Error inesperado")
    } finally {
      setSavingRule(false)
    }
  }

  async function handleDeleteRule(ruleId: string) {
    try {
      const res = await fetch(`/api/cooperative/${sessionId}/rules/${ruleId}`, { method: "DELETE" })
      if (!res.ok) { toast.error("Error al eliminar la regla"); return }
      setRules(prev => prev.filter(r => r.id !== ruleId))
    } catch {
      toast.error("Error inesperado")
    }
  }

  function toggleStudent(sid: string) {
    setSelectedStudentIds(prev =>
      prev.includes(sid) ? prev.filter(id => id !== sid) : [...prev, sid]
    )
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
    <div className="p-8 print:p-0">
      <style>{`
        @media print {
          @page { size: A4; margin: 1.5cm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
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
              {session.use_sociogram
                ? ` · Sociograma: ${session.sociogram_snapshots?.name ?? "respuestas actuales"}`
                : ""}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {!editMode && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground hover:text-red-600 hover:bg-red-50"
              onClick={handleDeleteSession}
            >
              <Trash2 className="w-4 h-4" /> Eliminar sesión
            </Button>
          )}
          {latestSet && !editMode && (
            <>
              <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2">
                <Printer className="w-4 h-4" /> Imprimir
              </Button>
              {latestSet.rationale && (
                <Button variant="outline" size="sm" onClick={() => setShowRationale(v => !v)} className="gap-2">
                  <FileText className="w-4 h-4" /> Informe
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={enterEdit} className="gap-2">
                <Pencil className="w-4 h-4" /> Editar
              </Button>
              {latestSet.status === "aprobado" ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUnapprove}
                  className="gap-2 border-green-300 text-green-700 hover:bg-green-50"
                >
                  <CheckCircle2 className="w-4 h-4" /> Aprobado
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleApprove}
                  className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                >
                  <Check className="w-4 h-4" /> Aprobar
                </Button>
              )}
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
      <div className="hidden print:block mb-6 pb-3 border-b">
        <h1 className="text-xl font-bold">{session.name}</h1>
        <p className="text-sm text-gray-600">
          Clase {session.class_name} · {numGroups} grupos
          {latestSet?.status === "aprobado" ? " · ✓ Aprobado" : ""}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Impreso el {new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}
        </p>
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

      {/* Rationale report panel */}
      {showRationale && latestSet?.rationale && (
        <RationalePanel rationale={latestSet.rationale} onClose={() => setShowRationale(false)} />
      )}

      {/* Cooperative rules panel — always visible, above the groups */}
      {!editMode && (
        <div className="mb-6 print:hidden">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" /> Reglas de agrupación
            </h2>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => {
              setSelectedStudentIds([])
              setNewRuleType("must_separate")
              setShowRuleDialog(true)
            }}>
              <Plus className="w-3.5 h-3.5" /> Nueva regla
            </Button>
          </div>
          {rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin reglas. Añade reglas antes de generar para que el algoritmo las respete.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {rules.map(rule => (
                <div key={rule.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${rule.rule_type === "must_separate" ? "border-red-200 bg-red-50/50" : "border-green-200 bg-green-50/50"}`}>
                  <Badge variant="outline" className={`text-xs shrink-0 ${rule.rule_type === "must_separate" ? "border-red-300 text-red-700" : "border-green-300 text-green-700"}`}>
                    {rule.rule_type === "must_separate" ? "Separar" : "Juntar"}
                  </Badge>
                  <span className="text-muted-foreground">
                    {rule.cooperative_rule_students.map(rs => `${rs.students.first_name} ${rs.students.last_name}`).join(" · ")}
                  </span>
                  <button
                    type="button"
                    className="ml-1 text-muted-foreground hover:text-red-600 transition-colors"
                    onClick={() => handleDeleteRule(rule.id)}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* No groups yet */}
      {!latestSet && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Users2 className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="font-medium">Todavía no se han generado grupos</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              {rules.length > 0
                ? `Se aplicarán ${rules.length} regla${rules.length > 1 ? "s" : ""} al generar`
                : `Pulsa el botón para generar los grupos para la clase ${session.class_name}`}
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
              <Card key={groupNumber} className={`border ${GROUP_COLORS[colorIdx]} print:break-inside-avoid`}>
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
                            <div className="mt-1.5 grid grid-cols-2 gap-1">
                              <Select
                                value={String(assignment.group_number)}
                                onValueChange={(v) => moveStudent(assignment.student_id, Number(v))}
                              >
                                <SelectTrigger className="h-7 text-xs">
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
                              <Select
                                value={assignment.role ?? "__none__"}
                                onValueChange={(v) => changeRole(assignment.student_id, v === "__none__" ? null : v)}
                              >
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__" className="text-xs">Sin rol</SelectItem>
                                  <SelectItem value="coordinador" className="text-xs">Coordinador</SelectItem>
                                  <SelectItem value="secretario" className="text-xs">Secretario</SelectItem>
                                  <SelectItem value="portavoz" className="text-xs">Portavoz</SelectItem>
                                  <SelectItem value="revisor" className="text-xs">Revisor</SelectItem>
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

      {/* Add rule dialog */}
      <Dialog open={showRuleDialog} onOpenChange={setShowRuleDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva regla de agrupación</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Tipo de regla</Label>
              <Select value={newRuleType} onValueChange={(v) => setNewRuleType(v as typeof newRuleType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="must_separate">Separar — no pueden estar en el mismo grupo</SelectItem>
                  <SelectItem value="must_keep_together">Juntar — deben estar en el mismo grupo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Alumnos implicados <span className="text-muted-foreground font-normal">(mín. 2)</span></Label>
              <div className="max-h-56 overflow-y-auto rounded-md border divide-y">
                {classStudents.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-muted/50 transition-colors ${selectedStudentIds.includes(s.id) ? "bg-primary/5 font-medium" : ""}`}
                    onClick={() => toggleStudent(s.id)}
                  >
                    <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selectedStudentIds.includes(s.id) ? "bg-primary border-primary" : "border-muted-foreground/30"}`}>
                      {selectedStudentIds.includes(s.id) && <Check className="w-2.5 h-2.5 text-white" />}
                    </span>
                    {s.first_name} {s.last_name}
                    <span className="ml-auto text-xs text-muted-foreground">{s.gender}</span>
                  </button>
                ))}
              </div>
              {selectedStudentIds.length > 0 && (
                <p className="text-xs text-muted-foreground">{selectedStudentIds.length} alumno{selectedStudentIds.length > 1 ? "s" : ""} seleccionado{selectedStudentIds.length > 1 ? "s" : ""}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRuleDialog(false)}>Cancelar</Button>
            <Button onClick={handleAddRule} disabled={savingRule || selectedStudentIds.length < 2} className="gap-2">
              {savingRule ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Crear regla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
