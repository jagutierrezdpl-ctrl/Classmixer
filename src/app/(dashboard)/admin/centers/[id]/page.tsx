"use client"

import { useState, useEffect, use } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  ArrowLeft, Building2, Users, FolderOpen, GraduationCap,
  Clock, Loader2, Trash2, Plus, AlertTriangle,
  CheckCircle2, Info, Megaphone, Shield, Pencil, Check, X,
  Mail, KeyRound,
} from "lucide-react"
import Link from "next/link"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"

interface Center {
  id: string
  name: string
  city?: string
  address?: string
  country?: string
  created_at: string
}

interface CenterUser {
  id: string
  name: string
  email: string
  role: string
  created_at: string
}

interface Process {
  id: string
  name: string
  school_year: string
  status: string
  process_type: string
  created_at: string
  source_level: string
  target_level: string | null
}

interface ActivityLog {
  id: string
  action: string
  entity_type: string
  created_at: string
  users: { name: string; email: string } | null
}

interface CenterNote {
  id: string
  content: string
  note_type: string
  author_name: string
  created_at: string
}

interface License {
  plan: string
  max_processes: number | null
  max_students: number | null
  active: boolean
}

interface DetailData {
  center: Center
  users: CenterUser[]
  processes: Process[]
  student_count: number
  response_count: number
  recent_activity: ActivityLog[]
  notes: CenterNote[]
  license: License | null
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  borrador: { label: "Borrador", color: "bg-gray-100 text-gray-700" },
  cuestionario_abierto: { label: "Cuestionario abierto", color: "bg-blue-100 text-blue-700" },
  cuestionario_cerrado: { label: "Cuestionario cerrado", color: "bg-yellow-100 text-yellow-700" },
  en_analisis: { label: "En análisis", color: "bg-purple-100 text-purple-700" },
  propuestas_generadas: { label: "Propuestas generadas", color: "bg-indigo-100 text-indigo-700" },
  propuesta_seleccionada: { label: "Propuesta seleccionada", color: "bg-teal-100 text-teal-700" },
  cerrado: { label: "Cerrado", color: "bg-green-100 text-green-700" },
  archivado: { label: "Archivado", color: "bg-gray-100 text-gray-500" },
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  tutor: "Tutor",
  orientador: "Orientador",
  alumno: "Alumno",
}

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-blue-100 text-blue-700",
  tutor: "bg-green-100 text-green-700",
  orientador: "bg-purple-100 text-purple-700",
  alumno: "bg-gray-100 text-gray-700",
}

const NOTE_STYLES: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  nota: { icon: Info, color: "bg-blue-50 border-blue-200 text-blue-800", label: "Nota" },
  incidencia: { icon: AlertTriangle, color: "bg-red-50 border-red-200 text-red-800", label: "Incidencia" },
  resuelto: { icon: CheckCircle2, color: "bg-green-50 border-green-200 text-green-800", label: "Resuelto" },
  aviso: { icon: Megaphone, color: "bg-amber-50 border-amber-200 text-amber-800", label: "Aviso" },
}

const PLAN_COLORS: Record<string, string> = {
  free: "bg-gray-100 text-gray-700",
  basic: "bg-blue-100 text-blue-700",
  pro: "bg-violet-100 text-violet-700",
  enterprise: "bg-amber-100 text-amber-700",
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Ahora mismo"
  if (mins < 60) return `Hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Hace ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `Hace ${days}d`
  return new Date(dateStr).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })
}

const ACTION_LABELS: Record<string, string> = {
  import_students: "Importó alumnos",
  generate_proposals: "Generó propuestas",
  approve_proposal: "Aprobó propuesta",
  edit_proposal_assignments: "Editó distribución",
  export_proposal_excel: "Exportó Excel",
  export_sociogram_excel: "Exportó sociograma",
  create_process: "Creó proceso",
  generate_tokens: "Generó cuestionario",
}

export default function CenterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData] = useState<DetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Edit center name
  const [editingName, setEditingName] = useState(false)
  const [editNameValue, setEditNameValue] = useState("")
  const [savingName, setSavingName] = useState(false)

  // Role editing
  const [editingRole, setEditingRole] = useState<string | null>(null)
  const [newRole, setNewRole] = useState("")
  const [savingRole, setSavingRole] = useState(false)

  // User actions
  const [userActionLoading, setUserActionLoading] = useState<string | null>(null)

  // Notes
  const [noteContent, setNoteContent] = useState("")
  const [noteType, setNoteType] = useState("nota")
  const [savingNote, setSavingNote] = useState(false)

  // License editing
  const [editingLicense, setEditingLicense] = useState(false)
  const [newPlan, setNewPlan] = useState("free")
  const [savingLicense, setSavingLicense] = useState(false)

  async function loadDetail() {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/centers/${id}/detail`)
      const d = await res.json()
      if (!res.ok) { setError(d.error); return }
      setData(d)
    } catch {
      setError("Error al cargar los datos")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadDetail() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSaveName() {
    if (!editNameValue.trim()) return
    setSavingName(true)
    await fetch(`/api/admin/centers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editNameValue.trim() }),
    })
    setSavingName(false)
    setEditingName(false)
    await loadDetail()
  }

  async function handleSaveRole(userId: string) {
    setSavingRole(true)
    const res = await fetch(`/api/admin/centers/${id}/users`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, role: newRole }),
    })
    setSavingRole(false)
    if (res.ok) {
      setEditingRole(null)
      await loadDetail()
    }
  }

  async function handleDeleteUser(userId: string, userName: string) {
    if (!confirm(`¿Eliminar al usuario "${userName}"? Esta acción no se puede deshacer.`)) return
    await fetch(`/api/admin/centers/${id}/users`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    })
    await loadDetail()
  }

  async function handleUserAction(userId: string, action: "resend_invite" | "reset_password") {
    setUserActionLoading(`${userId}-${action}`)
    const res = await fetch(`/api/admin/centers/${id}/users`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, action }),
    })
    setUserActionLoading(null)
    if (res.ok) {
      const msg = action === "resend_invite" ? "Invitación reenviada" : "Email de recuperación enviado"
      alert(msg)
    }
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault()
    if (!noteContent.trim()) return
    setSavingNote(true)
    const res = await fetch(`/api/admin/centers/${id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: noteContent.trim(), note_type: noteType }),
    })
    setSavingNote(false)
    if (res.ok) {
      setNoteContent("")
      setNoteType("nota")
      await loadDetail()
    }
  }

  async function handleDeleteNote(noteId: string) {
    if (!confirm("¿Eliminar esta nota?")) return
    await fetch(`/api/admin/centers/${id}/notes/${noteId}`, { method: "DELETE" })
    setData(prev => prev ? { ...prev, notes: prev.notes.filter(n => n.id !== noteId) } : prev)
  }

  async function handleSaveLicense() {
    setSavingLicense(true)
    await fetch(`/api/admin/licenses/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: newPlan }),
    })
    setSavingLicense(false)
    setEditingLicense(false)
    await loadDetail()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !data) {
    return <div className="p-8 text-destructive">{error ?? "Centro no encontrado"}</div>
  }

  const { center, users, processes, student_count, response_count, recent_activity, notes, license } = data
  const activeProcesses = processes.filter(p => !["cerrado", "archivado"].includes(p.status))

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            {editingName ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editNameValue}
                  onChange={e => setEditNameValue(e.target.value)}
                  className="h-8 text-lg font-bold w-72"
                  onKeyDown={e => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") setEditingName(false) }}
                  autoFocus
                />
                <button onClick={handleSaveName} disabled={savingName} className="text-green-600 hover:text-green-700">
                  {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                </button>
                <button onClick={() => setEditingName(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{center.name}</h1>
                <button
                  onClick={() => { setEditNameValue(center.name); setEditingName(true) }}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-0.5">
              {[center.address, center.city, center.country].filter(Boolean).join(" · ")}
              {" · "}Creado {timeAgo(center.created_at)}
            </p>
          </div>
        </div>
        {/* License badge */}
        <div className="flex items-center gap-2">
          {editingLicense ? (
            <div className="flex items-center gap-2">
              <Select value={newPlan} onValueChange={setNewPlan}>
                <SelectTrigger className="h-8 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
              <button onClick={handleSaveLicense} disabled={savingLicense} className="text-green-600 hover:text-green-700">
                {savingLicense ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              </button>
              <button onClick={() => setEditingLicense(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setNewPlan(license?.plan ?? "free"); setEditingLicense(true) }}
              className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${PLAN_COLORS[license?.plan ?? "free"]} hover:opacity-80 transition-opacity`}
            >
              <Shield className="w-3 h-3" />
              {license?.plan ?? "free"}
              <Pencil className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <Users className="w-4 h-4 text-blue-500" />
            <div>
              <p className="text-xl font-bold leading-tight">{users.length}</p>
              <p className="text-xs text-muted-foreground">Usuarios</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <GraduationCap className="w-4 h-4 text-emerald-500" />
            <div>
              <p className="text-xl font-bold leading-tight">{student_count}</p>
              <p className="text-xs text-muted-foreground">Alumnos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <FolderOpen className="w-4 h-4 text-amber-500" />
            <div>
              <p className="text-xl font-bold leading-tight">{activeProcesses.length}</p>
              <p className="text-xs text-muted-foreground">Procesos activos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <Clock className="w-4 h-4 text-violet-500" />
            <div>
              <p className="text-xl font-bold leading-tight">{response_count.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Respuestas totales</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="processes">
        <TabsList className="mb-4">
          <TabsTrigger value="processes">Procesos ({processes.length})</TabsTrigger>
          <TabsTrigger value="users">Usuarios ({users.length})</TabsTrigger>
          <TabsTrigger value="activity">Actividad</TabsTrigger>
          <TabsTrigger value="notes">
            Notas internas
            {notes.length > 0 && (
              <span className="ml-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center leading-none">
                {notes.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* PROCESSES */}
        <TabsContent value="processes">
          <Card>
            <CardContent className="p-0">
              {processes.length === 0 ? (
                <p className="text-center py-10 text-muted-foreground text-sm">Sin procesos</p>
              ) : (
                <div className="divide-y">
                  {processes.map(p => {
                    const st = STATUS_MAP[p.status] ?? { label: p.status, color: "bg-muted text-muted-foreground" }
                    return (
                      <div key={p.id} className="flex items-center gap-4 px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.school_year} · {p.source_level}{p.target_level ? ` → ${p.target_level}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>
                            {st.label}
                          </span>
                          <Badge variant="secondary" className="text-xs capitalize">
                            {p.process_type}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{timeAgo(p.created_at)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* USERS */}
        <TabsContent value="users">
          <Card>
            <CardContent className="p-0">
              {users.length === 0 ? (
                <p className="text-center py-10 text-muted-foreground text-sm">Sin usuarios</p>
              ) : (
                <div className="divide-y">
                  {users.map(u => (
                    <div key={u.id} className="flex items-center gap-4 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{u.name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {editingRole === u.id ? (
                          <div className="flex items-center gap-1">
                            <Select value={newRole} onValueChange={setNewRole}>
                              <SelectTrigger className="h-7 w-32 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Administrador</SelectItem>
                                <SelectItem value="orientador">Orientador</SelectItem>
                                <SelectItem value="tutor">Tutor</SelectItem>
                              </SelectContent>
                            </Select>
                            <button
                              onClick={() => handleSaveRole(u.id)}
                              disabled={savingRole}
                              className="text-green-600 hover:text-green-700"
                            >
                              {savingRole ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={() => setEditingRole(null)} className="text-muted-foreground hover:text-foreground">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditingRole(u.id); setNewRole(u.role) }}
                            className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${ROLE_COLORS[u.role] ?? "bg-muted text-muted-foreground"} hover:opacity-80 transition-opacity`}
                          >
                            {ROLE_LABELS[u.role] ?? u.role}
                            <Pencil className="w-2 h-2" />
                          </button>
                        )}
                        <span className="text-xs text-muted-foreground">{timeAgo(u.created_at)}</span>
                        <button
                          onClick={() => handleUserAction(u.id, "resend_invite")}
                          disabled={userActionLoading === `${u.id}-resend_invite`}
                          className="text-muted-foreground hover:text-blue-600 transition-colors"
                          title="Reenviar invitación"
                        >
                          {userActionLoading === `${u.id}-resend_invite`
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Mail className="w-3.5 h-3.5" />
                          }
                        </button>
                        <button
                          onClick={() => handleUserAction(u.id, "reset_password")}
                          disabled={userActionLoading === `${u.id}-reset_password`}
                          className="text-muted-foreground hover:text-amber-600 transition-colors"
                          title="Resetear contraseña"
                        >
                          {userActionLoading === `${u.id}-reset_password`
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <KeyRound className="w-3.5 h-3.5" />
                          }
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u.id, u.name ?? u.email)}
                          className="text-destructive/50 hover:text-destructive transition-colors"
                          title="Eliminar usuario"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ACTIVITY */}
        <TabsContent value="activity">
          {recent_activity.length > 0 && (() => {
            // Group logs by day for chart
            const dayMap: Record<string, number> = {}
            for (const log of recent_activity) {
              const day = new Date(log.created_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })
              dayMap[day] = (dayMap[day] ?? 0) + 1
            }
            const chartData = Object.entries(dayMap).map(([day, count]) => ({ day, count })).reverse()
            return (
              <Card className="mb-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Actividad reciente</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                        formatter={(v) => [v, "Acciones"]}
                      />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )
          })()}
          <Card>
            <CardContent className="p-0">
              {recent_activity.length === 0 ? (
                <p className="text-center py-10 text-muted-foreground text-sm">Sin actividad registrada</p>
              ) : (
                <div className="divide-y">
                  {recent_activity.map(log => (
                    <div key={log.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">
                          <span className="font-medium">{log.users?.name ?? log.users?.email ?? "Sistema"}</span>
                          {" · "}
                          <span className="text-muted-foreground">
                            {ACTION_LABELS[log.action] ?? log.action}
                          </span>
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{timeAgo(log.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* NOTES */}
        <TabsContent value="notes">
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Añadir nota interna</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddNote} className="space-y-3">
                <div className="flex gap-2">
                  <Select value={noteType} onValueChange={setNoteType}>
                    <SelectTrigger className="w-36 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nota">Nota</SelectItem>
                      <SelectItem value="incidencia">Incidencia</SelectItem>
                      <SelectItem value="aviso">Aviso</SelectItem>
                      <SelectItem value="resuelto">Resuelto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Textarea
                  placeholder="Escribe una nota, incidencia o aviso sobre este centro..."
                  value={noteContent}
                  onChange={e => setNoteContent(e.target.value)}
                  rows={3}
                  className="text-sm"
                />
                <Button type="submit" size="sm" disabled={savingNote || !noteContent.trim()}>
                  {savingNote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Añadir
                </Button>
              </form>
            </CardContent>
          </Card>

          {notes.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">Sin notas todavía</p>
          ) : (
            <div className="space-y-3">
              {notes.map(note => {
                const style = NOTE_STYLES[note.note_type] ?? NOTE_STYLES.nota
                const Icon = style.icon
                return (
                  <div key={note.id} className={`rounded-lg border p-4 ${style.color}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <Icon className="w-4 h-4 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{note.content}</p>
                          <p className="text-xs opacity-70 mt-1">
                            {note.author_name} · {timeAgo(note.created_at)}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
