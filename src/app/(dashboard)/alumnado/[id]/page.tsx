"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
import {
  ArrowLeft, User, BookOpen, Network, GraduationCap, TrendingUp,
  AlertTriangle, CheckCircle2, Loader2, Calendar, Pencil, Save, X, Trash2,
  ShieldAlert, Plus, Trash
} from "lucide-react"
import Link from "next/link"
import { useConfirm } from "@/components/ui/ConfirmDialog"

interface StudentProfile {
  id: string
  external_id: string
  first_name: string
  last_name: string
  current_class: string | null
  gender: string | null
  birth_year: number | null
  academic_level: string | null
  behavior_level: string | null
  needs_type: string | null
  average_grade: number | null
  observations: string | null
  school_year: string | null
  active: boolean
  created_at: string
}

interface SociogramMetric {
  received_count: number
  given_count: number
  reciprocal_count: number
  centrality: number | null
  isolation_score: number | null
}

interface TrajectoryEntry {
  student: {
    id: string
    current_class: string
    gender: string
    average_grade: number | null
    academic_level: string | null
    behavior_level: string | null
    needs_type: string | null
    observations: string | null
    created_at: string
  }
  process: {
    id: string
    name: string
    school_year: string
    process_type: string
    status: string
    source_level: string
    target_level: string | null
  }
  sociogram: SociogramMetric | null
  final_assignment: {
    target_class: string
    proposals: { name: string; status: string }
  } | null
}

const ACADEMIC_COLORS: Record<string, string> = {
  Alto: "bg-green-100 text-green-700",
  "Medio-alto": "bg-lime-100 text-lime-700",
  Medio: "bg-yellow-100 text-yellow-700",
  "Medio-bajo": "bg-orange-100 text-orange-700",
  Bajo: "bg-red-100 text-red-700",
}

const BEHAVIOR_COLORS: Record<string, string> = {
  Positiva: "bg-green-100 text-green-700",
  Normal: "bg-slate-100 text-slate-700",
  Seguimiento: "bg-amber-100 text-amber-700",
  Conflictiva: "bg-red-100 text-red-700",
}

export default function AlumnoTrajectoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const confirmFn = useConfirm()
  const [data, setData] = useState<{ profile: StudentProfile; trajectory: TrajectoryEntry[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState<Partial<StudentProfile & { average_grade: number | null }>>({})
  const [saveOk, setSaveOk] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [notes, setNotes] = useState<{ id: string; content: string; author_name: string; created_at: string }[]>([])
  const [notesLoading, setNotesLoading] = useState(false)
  const [newNote, setNewNote] = useState("")
  const [savingNote, setSavingNote] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/student-profiles/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setData(d)
      })
      .catch(() => setError("Error al cargar los datos"))
      .finally(() => setLoading(false))

    // Load user role and notes (notes only for orientador/admin)
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      setUserRole(d.role ?? null)
      if (["admin", "superadmin", "orientador"].includes(d.role)) {
        setNotesLoading(true)
        fetch(`/api/student-profiles/${id}/notes`)
          .then(r => r.json())
          .then(n => { if (Array.isArray(n)) setNotes(n) })
          .finally(() => setNotesLoading(false))
      }
    }).catch(() => {})
  }, [id])

  function startEdit() {
    if (!data) return
    setEditForm({
      first_name: data.profile.first_name,
      last_name: data.profile.last_name,
      external_id: data.profile.external_id,
      current_class: data.profile.current_class ?? "",
      gender: data.profile.gender ?? "",
      birth_year: data.profile.birth_year ?? undefined,
      average_grade: data.profile.average_grade ?? null,
      academic_level: data.profile.academic_level ?? "",
      behavior_level: data.profile.behavior_level ?? "",
      needs_type: data.profile.needs_type ?? "",
      observations: data.profile.observations ?? "",
      school_year: data.profile.school_year ?? "",
    })
    setEditing(true)
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault()
    if (!newNote.trim()) return
    setSavingNote(true)
    try {
      const res = await fetch(`/api/student-profiles/${id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newNote.trim() }),
      })
      const d = await res.json()
      if (!d.error) {
        setNotes(prev => [d, ...prev])
        setNewNote("")
      }
    } finally {
      setSavingNote(false)
    }
  }

  async function handleDeleteNote(noteId: string) {
    const ok = await confirmFn({ title: "Eliminar nota", description: "¿Eliminar esta nota?", confirmLabel: "Eliminar", variant: "destructive" })
    if (!ok) return
    await fetch(`/api/orientation-notes/${noteId}`, { method: "DELETE" })
    setNotes(prev => prev.filter(n => n.id !== noteId))
  }

  async function handleToggleActive() {
    const isActive = data?.profile.active !== false
    const msg = isActive
      ? `¿Dar de baja a ${data?.profile.first_name} ${data?.profile.last_name}? Sus datos se conservarán.`
      : `¿Reactivar a ${data?.profile.first_name} ${data?.profile.last_name}?`
    const ok = await confirmFn({ title: isActive ? "Dar de baja" : "Reactivar alumno", description: msg, confirmLabel: isActive ? "Dar de baja" : "Reactivar", variant: isActive ? "destructive" : "default" })
    if (!ok) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/student-profiles/${id}`, {
        method: isActive ? "DELETE" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: isActive ? undefined : JSON.stringify({ active: true }),
      })
      const result = await res.json()
      if (result.error) {
        setError(result.error)
      } else {
        const updated = await fetch(`/api/student-profiles/${id}`).then(r => r.json())
        if (!updated.error) setData(updated)
      }
    } finally {
      setDeleting(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/student-profiles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      })
      const result = await res.json()
      if (result.error) {
        setError(result.error)
      } else {
        setEditing(false)
        setSaveOk(true)
        setTimeout(() => setSaveOk(false), 3000)
        // Reload
        const updated = await fetch(`/api/student-profiles/${id}`).then(r => r.json())
        if (!updated.error) setData(updated)
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />Cargando...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-8">
        <p className="text-destructive">{error ?? "No encontrado"}</p>
        <Button variant="outline" asChild className="mt-4">
          <Link href="/alumnado"><ArrowLeft className="w-4 h-4 mr-2" />Volver</Link>
        </Button>
      </div>
    )
  }

  const { profile, trajectory } = data

  const avgGrades = trajectory.map(e => e.student.average_grade).filter((g): g is number => g !== null)
  const latestGrade = avgGrades[avgGrades.length - 1]
  const firstGrade = avgGrades[0]
  const gradeTrend = avgGrades.length >= 2 ? latestGrade - firstGrade : null
  const isolatedCount = trajectory.filter(e => e.sociogram && e.sociogram.received_count === 0).length

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/alumnado"><ArrowLeft className="w-4 h-4" /></Link>
        </Button>
        <div className="flex items-center gap-4 flex-1">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {profile.first_name} {profile.last_name}
              {profile.active === false && (
                <span className="text-sm font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">Baja</span>
              )}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-muted-foreground">ID: {profile.external_id}</span>
              {profile.birth_year && (
                <Badge variant="outline" className="text-xs">
                  <Calendar className="w-3 h-3 mr-1" />{profile.birth_year}
                </Badge>
              )}
              {profile.current_class && (
                <Badge variant="outline" className="text-xs">{profile.current_class}</Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saveOk && <CheckCircle2 className="w-5 h-5 text-green-600" />}
          {editing ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                <X className="w-4 h-4 mr-1" />Cancelar
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                Guardar
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={startEdit}>
                <Pencil className="w-4 h-4 mr-2" />Editar
              </Button>
              <Button
                variant="outline" size="sm"
                className={data?.profile.active !== false
                  ? "text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                  : "text-green-600 hover:text-green-700 hover:bg-green-50 border-green-300"}
                onClick={handleToggleActive}
                disabled={deleting}
              >
                {deleting
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Trash2 className="w-4 h-4 mr-1" />}
                {data?.profile.active !== false ? "Dar de baja" : "Reactivar"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <Card className="mb-8">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Editar perfil</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs">Nombre</Label>
                <Input value={editForm.first_name ?? ""} onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Apellidos</Label>
                <Input value={editForm.last_name ?? ""} onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">ID externo</Label>
                <Input value={editForm.external_id ?? ""} onChange={e => setEditForm(f => ({ ...f, external_id: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Clase actual</Label>
                <Input value={editForm.current_class ?? ""} onChange={e => setEditForm(f => ({ ...f, current_class: e.target.value }))} placeholder="ej. 6A" />
              </div>
              <div>
                <Label className="text-xs">Género</Label>
                <Select value={editForm.gender ?? ""} onValueChange={v => setEditForm(f => ({ ...f, gender: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="F">F</SelectItem>
                    <SelectItem value="M">M</SelectItem>
                    <SelectItem value="Otro">Otro</SelectItem>
                    <SelectItem value="No especificado">No especificado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Nota media</Label>
                <Input
                  type="number" min={0} max={10} step={0.1}
                  value={editForm.average_grade ?? ""}
                  onChange={e => setEditForm(f => ({ ...f, average_grade: e.target.value === "" ? null : parseFloat(e.target.value) }))}
                  placeholder="0 – 10"
                />
              </div>
              <div>
                <Label className="text-xs">Año nacimiento</Label>
                <Input type="number" value={editForm.birth_year ?? ""} onChange={e => setEditForm(f => ({ ...f, birth_year: Number(e.target.value) || undefined }))} placeholder="ej. 2013" />
              </div>
              <div>
                <Label className="text-xs">Nivel académico</Label>
                <Select value={editForm.academic_level ?? ""} onValueChange={v => setEditForm(f => ({ ...f, academic_level: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    {["Alto", "Medio-alto", "Medio", "Medio-bajo", "Bajo"].map(v => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Conducta</Label>
                <Select value={editForm.behavior_level ?? ""} onValueChange={v => setEditForm(f => ({ ...f, behavior_level: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    {["Positiva", "Normal", "Seguimiento", "Conflictiva"].map(v => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Necesidades</Label>
                <Select value={editForm.needs_type ?? ""} onValueChange={v => setEditForm(f => ({ ...f, needs_type: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    {["No", "Sí", "ACNEAE", "NEE", "Refuerzo", "Altas capacidades", "Observación interna"].map(v => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Curso escolar</Label>
                <Input value={editForm.school_year ?? ""} onChange={e => setEditForm(f => ({ ...f, school_year: e.target.value }))} placeholder="ej. 2025/2026" />
              </div>
              <div className="col-span-2 md:col-span-3">
                <Label className="text-xs">Observaciones</Label>
                <Textarea
                  value={editForm.observations ?? ""}
                  onChange={e => setEditForm(f => ({ ...f, observations: e.target.value }))}
                  rows={2}
                  placeholder="Observaciones internas..."
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary cards */}
      {trajectory.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <BookOpen className="w-3 h-3" />Procesos
              </div>
              <p className="text-2xl font-bold">{trajectory.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <GraduationCap className="w-3 h-3" />Nota actual
              </div>
              <p className="text-2xl font-bold">{latestGrade?.toFixed(1) ?? "—"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <TrendingUp className="w-3 h-3" />Tendencia
              </div>
              <p className={`text-2xl font-bold ${gradeTrend === null ? "" : gradeTrend >= 0 ? "text-green-600" : "text-red-600"}`}>
                {gradeTrend === null ? "—" : `${gradeTrend >= 0 ? "+" : ""}${gradeTrend.toFixed(1)}`}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <AlertTriangle className="w-3 h-3" />Veces aislado
              </div>
              <p className={`text-2xl font-bold ${isolatedCount > 0 ? "text-amber-600" : ""}`}>
                {isolatedCount}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Profile summary */}
      {!editing && (
        <Card className="mb-8">
          <CardContent className="py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {profile.current_class && (
                <div><p className="text-xs text-muted-foreground">Clase</p><p className="font-medium">{profile.current_class}</p></div>
              )}
              {profile.gender && (
                <div><p className="text-xs text-muted-foreground">Género</p><p className="font-medium">{profile.gender}</p></div>
              )}
              {profile.academic_level && (
                <div>
                  <p className="text-xs text-muted-foreground">Nivel</p>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${ACADEMIC_COLORS[profile.academic_level] ?? "bg-muted"}`}>
                    {profile.academic_level}
                  </span>
                </div>
              )}
              {profile.behavior_level && (
                <div>
                  <p className="text-xs text-muted-foreground">Conducta</p>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${BEHAVIOR_COLORS[profile.behavior_level] ?? "bg-muted"}`}>
                    {profile.behavior_level}
                  </span>
                </div>
              )}
              {profile.needs_type && profile.needs_type !== "No" && (
                <div>
                  <p className="text-xs text-muted-foreground">Necesidades</p>
                  <Badge className="text-xs bg-amber-100 text-amber-700 border-0">{profile.needs_type}</Badge>
                </div>
              )}
              {profile.school_year && (
                <div><p className="text-xs text-muted-foreground">Curso</p><p className="font-medium">{profile.school_year}</p></div>
              )}
            </div>
            {profile.observations && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-xs text-muted-foreground mb-1">Observaciones</p>
                <p className="text-sm italic text-muted-foreground">{profile.observations}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Trajectory */}
      <h2 className="text-lg font-semibold mb-4">Trayectoria escolar</h2>

      {trajectory.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          Este alumno no aparece en ningún proceso todavía
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />
          <div className="space-y-6">
            {trajectory.map((entry, idx) => (
              <div key={entry.student.id} className="relative flex gap-6">
                <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0 z-10 ${
                  idx === trajectory.length - 1
                    ? "bg-primary border-primary text-white"
                    : "bg-background border-border text-muted-foreground"
                }`}>
                  <span className="text-xs font-bold">{trajectory.length - idx}</span>
                </div>

                <Card className="flex-1">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <CardTitle className="text-base">
                          <Link href={`/processes/${entry.process.id}`} className="hover:underline">
                            {entry.process.name}
                          </Link>
                        </CardTitle>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs text-muted-foreground">{entry.process.school_year}</span>
                          <Badge variant="outline" className="text-xs">{entry.process.source_level}</Badge>
                          <Badge variant="secondary" className="text-xs">
                            <Network className="w-3 h-3 mr-1" />{entry.process.process_type}
                          </Badge>
                        </div>
                      </div>
                      {entry.final_assignment && (
                        <div className="text-right shrink-0">
                          <p className="text-xs text-muted-foreground">Clase asignada</p>
                          <p className="font-bold text-lg">{entry.final_assignment.target_class}</p>
                        </div>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Clase origen</p>
                        <p className="font-medium">{entry.student.current_class}</p>
                      </div>
                      {entry.student.average_grade !== null && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Nota media</p>
                          <p className="font-medium">{entry.student.average_grade.toFixed(1)}</p>
                        </div>
                      )}
                      {entry.student.academic_level && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Nivel</p>
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                            ACADEMIC_COLORS[entry.student.academic_level] ?? "bg-muted"
                          }`}>{entry.student.academic_level}</span>
                        </div>
                      )}
                      {entry.student.behavior_level && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Conducta</p>
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                            BEHAVIOR_COLORS[entry.student.behavior_level] ?? "bg-muted"
                          }`}>{entry.student.behavior_level}</span>
                        </div>
                      )}
                    </div>

                    {entry.sociogram && (
                      <div className="mt-4 pt-3 border-t">
                        <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                          <Network className="w-3 h-3" />Sociograma
                        </p>
                        <div className="flex items-center gap-4 text-sm">
                          <div className="text-center">
                            <p className="font-bold text-lg">{entry.sociogram.received_count}</p>
                            <p className="text-xs text-muted-foreground">Elegido</p>
                          </div>
                          <div className="text-center">
                            <p className="font-bold text-lg">{entry.sociogram.given_count}</p>
                            <p className="text-xs text-muted-foreground">Elige a</p>
                          </div>
                          <div className="text-center">
                            <p className="font-bold text-lg">{entry.sociogram.reciprocal_count}</p>
                            <p className="text-xs text-muted-foreground">Recíprocas</p>
                          </div>
                          {entry.sociogram.received_count === 0 && (
                            <Badge variant="destructive" className="text-xs ml-2">
                              <AlertTriangle className="w-3 h-3 mr-1" />Aislado
                            </Badge>
                          )}
                          {entry.sociogram.received_count >= 4 && (
                            <Badge className="text-xs ml-2 bg-blue-100 text-blue-700 border-0">
                              <CheckCircle2 className="w-3 h-3 mr-1" />Líder social
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {entry.student.observations && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs text-muted-foreground mb-1">Observaciones</p>
                        <p className="text-sm italic text-muted-foreground">{entry.student.observations}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Orientation notes — only visible to orientador/admin */}
      {["admin", "superadmin", "orientador"].includes(userRole ?? "") && (
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert className="w-4 h-4 text-purple-600" />
            <h2 className="font-semibold text-sm">Notas de orientación</h2>
            <span className="text-xs text-muted-foreground">(solo visibles para orientación y administración)</span>
          </div>

          <form onSubmit={handleAddNote} className="flex gap-2 mb-4">
            <Textarea
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              placeholder="Añadir nota privada..."
              rows={2}
              className="flex-1 resize-none text-sm"
            />
            <button
              type="submit"
              disabled={savingNote || !newNote.trim()}
              className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 shrink-0 self-start"
            >
              {savingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </button>
          </form>

          {notesLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
              <Loader2 className="w-4 h-4 animate-spin" />Cargando notas...
            </div>
          ) : notes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No hay notas de orientación para este alumno.</p>
          ) : (
            <div className="space-y-2">
              {notes.map(n => (
                <Card key={n.id} className="border-purple-100 bg-purple-50/40">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm flex-1">{n.content}</p>
                      <button
                        onClick={() => handleDeleteNote(n.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {n.author_name} · {new Date(n.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
