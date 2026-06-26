"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Users2, Plus, Loader2, ChevronRight, Calendar,
  Camera, X, CheckCircle2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import Link from "next/link"
import type { SociogramSnapshot } from "@/types"

interface CoopSession {
  id: string
  process_id: string
  process_name: string | null
  class_name: string
  name: string
  num_groups: number
  group_sizes: number[] | null
  balance_gender: boolean
  balance_academic: boolean
  use_sociogram: boolean
  sociogram_snapshots?: { id: string; name: string } | null
  created_at: string
  group_sets?: Array<{
    id: string
    name: string
    status: "generado" | "aprobado"
    score_total: number | null
    generated_at: string
  }>
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })
}

function sizeSummary(sizes: number[] | null, numGroups: number): string {
  if (!sizes || sizes.length === 0) return `${numGroups} grupos`
  const counts = new Map<number, number>()
  for (const s of sizes) counts.set(s, (counts.get(s) ?? 0) + 1)
  return [...counts.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([size, n]) => `${n}×${size}`)
    .join(" · ")
}

export default function CooperativoPage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<CoopSession[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  // Available classes across all processes
  const [classes, setClasses] = useState<string[]>([])

  // Form state
  const [formClassName, setFormClassName] = useState("")
  const [formName, setFormName] = useState("")
  const [formGroupSizes, setFormGroupSizes] = useState<{ count: number; size: number }[]>([{ count: 4, size: 4 }])
  const [formBalanceGender, setFormBalanceGender] = useState(true)
  const [formBalanceAcademic, setFormBalanceAcademic] = useState(true)
  const [formUseSociogram, setFormUseSociogram] = useState(false)
  const [formSnapshotId, setFormSnapshotId] = useState<string>("current")

  // Snapshot state
  const [snapshots, setSnapshots] = useState<Pick<SociogramSnapshot, "id" | "name" | "response_count" | "created_at">[]>([])
  const [loadingSnapshots, setLoadingSnapshots] = useState(false)
  const [creatingSnapshot, setCreatingSnapshot] = useState(false)
  const [newSnapshotName, setNewSnapshotName] = useState("")
  const [savingSnapshot, setSavingSnapshot] = useState(false)
  const [snapshotProcessId, setSnapshotProcessId] = useState<string | null>(null)

  const totalGroups = formGroupSizes.reduce((s, r) => s + r.count, 0)
  const totalSlots  = formGroupSizes.reduce((s, r) => s + r.count * r.size, 0)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [sessRes, clsRes] = await Promise.all([
          fetch("/api/cooperative"),
          fetch("/api/cooperative/classes"),
        ])
        if (sessRes.ok) setSessions(await sessRes.json())
        if (clsRes.ok) {
          const cls: string[] = await clsRes.json()
          setClasses(cls)
          if (cls.length > 0) setFormClassName(cls[0])
        }
      } catch {
        toast.error("Error al cargar")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // When the class changes, find the process_id for snapshot fetching
  useEffect(() => {
    if (!formClassName) return
    // We need the process_id to load snapshots for this class
    // We can infer it from the session list (all sessions for this class share the same process)
    const existing = sessions.find(s => s.class_name === formClassName)
    setSnapshotProcessId(existing?.process_id ?? null)
  }, [formClassName, sessions])

  useEffect(() => {
    if (formUseSociogram && open && snapshotProcessId) loadSnapshots(snapshotProcessId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formUseSociogram, open, snapshotProcessId])

  async function loadSnapshots(processId: string) {
    setLoadingSnapshots(true)
    try {
      const res = await fetch(`/api/processes/${processId}/sociogram/snapshots`)
      if (res.ok) {
        const data = await res.json()
        setSnapshots(data)
        if (data.length > 0 && formSnapshotId === "current") setFormSnapshotId(data[0].id)
      }
    } finally {
      setLoadingSnapshots(false)
    }
  }

  async function handleCreateSnapshot() {
    if (!snapshotProcessId) { toast.error("No se puede crear snapshot sin proceso"); return }
    if (!newSnapshotName.trim()) { toast.error("Escribe un nombre para el snapshot"); return }
    setSavingSnapshot(true)
    try {
      const res = await fetch(`/api/processes/${snapshotProcessId}/sociogram/snapshots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newSnapshotName.trim() }),
      })
      if (!res.ok) { toast.error("Error al crear el snapshot"); return }
      const snap = await res.json()
      setSnapshots(prev => [snap, ...prev])
      setFormSnapshotId(snap.id)
      setCreatingSnapshot(false)
      setNewSnapshotName("")
      toast.success("Snapshot creado")
    } finally {
      setSavingSnapshot(false)
    }
  }

  function updateGroupSizeRow(i: number, field: "count" | "size", value: number) {
    setFormGroupSizes(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r))
  }
  function addGroupSizeRow() {
    const lastSize = formGroupSizes[formGroupSizes.length - 1]?.size ?? 4
    setFormGroupSizes(prev => [...prev, { count: 1, size: Math.max(2, lastSize - 1) }])
  }
  function removeGroupSizeRow(i: number) {
    setFormGroupSizes(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleCreate() {
    if (!formClassName) { toast.error("Selecciona una clase"); return }
    if (!formName.trim()) { toast.error("Escribe un nombre para la sesión"); return }
    if (totalGroups < 1) { toast.error("Añade al menos un grupo"); return }
    setCreating(true)
    const sizes = formGroupSizes.flatMap(r => Array<number>(r.count).fill(r.size))
    try {
      const res = await fetch("/api/cooperative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          class_name: formClassName,
          name: formName.trim(),
          group_sizes: sizes,
          balance_gender: formBalanceGender,
          balance_academic: formBalanceAcademic,
          use_sociogram: formUseSociogram,
          sociogram_snapshot_id: formUseSociogram && formSnapshotId !== "current" ? formSnapshotId : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? "Error al crear"); return }
      // Navigate directly to the session detail (process-scoped URL)
      router.push(`/processes/${data.process_id}/groups/${data.id}`)
    } catch {
      toast.error("Error inesperado")
    } finally {
      setCreating(false)
    }
  }

  function handleOpenChange(v: boolean) {
    setOpen(v)
    if (!v) { setCreatingSnapshot(false); setNewSnapshotName("") }
  }

  // Group sessions by class for display
  const byClass = new Map<string, CoopSession[]>()
  for (const s of sessions) {
    if (!byClass.has(s.class_name)) byClass.set(s.class_name, [])
    byClass.get(s.class_name)!.push(s)
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Grupos cooperativos</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Crea y gestiona distribuciones de grupos de trabajo para cualquier clase.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Nueva sesión
        </Button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : sessions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Users2 className="w-7 h-7 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-lg">Sin sesiones todavía</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Crea una sesión para empezar a organizar grupos de trabajo dentro de una clase.
              </p>
            </div>
            {classes.length === 0 && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 max-w-sm">
                Para usar grupos cooperativos necesitas tener al menos un proceso con alumnos cargados.
              </p>
            )}
            <Button onClick={() => setOpen(true)} disabled={classes.length === 0}>
              <Plus className="w-4 h-4 mr-2" /> Crear primera sesión
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {[...byClass.entries()].map(([cls, clsSessions]) => (
            <div key={cls}>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Clase {cls}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {clsSessions.map(session => {
                  const approved = session.group_sets?.find(s => s.status === "aprobado")
                  return (
                    <Link
                      key={session.id}
                      href={`/processes/${session.process_id}/groups/${session.id}`}
                    >
                      <Card className="hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer h-full">
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <Users2 className="w-4 h-4 text-primary" />
                              </div>
                              <div>
                                <CardTitle className="text-base leading-tight">{session.name}</CardTitle>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {sizeSummary(session.group_sizes, session.num_groups)}
                                </p>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {session.balance_gender && <Badge variant="outline" className="text-xs">Género</Badge>}
                            {session.balance_academic && <Badge variant="outline" className="text-xs">Nivel</Badge>}
                            {session.use_sociogram && (
                              <Badge variant="outline" className="text-xs gap-1">
                                <Camera className="w-3 h-3" />
                                {session.sociogram_snapshots?.name ?? "Sociograma"}
                              </Badge>
                            )}
                            {approved && (
                              <Badge className="text-xs gap-1 bg-green-100 text-green-700 border-green-200">
                                <CheckCircle2 className="w-3 h-3" /> Aprobado
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            {session.group_sets?.length ?? 0} distribución{(session.group_sets?.length ?? 0) !== 1 ? "es" : ""}
                            &nbsp;· {formatDate(session.created_at)}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva sesión de grupos</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="coop-name">Nombre de la sesión</Label>
              <Input
                id="coop-name"
                placeholder="Ej: Grupos de Octubre"
                value={formName}
                onChange={e => setFormName(e.target.value)}
              />
            </div>

            {/* Class */}
            <div className="space-y-2">
              <Label htmlFor="coop-class">Clase</Label>
              {classes.length > 0 ? (
                <Select value={formClassName} onValueChange={v => { setFormClassName(v); setFormSnapshotId("current") }}>
                  <SelectTrigger id="coop-class">
                    <SelectValue placeholder="Selecciona una clase" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  No hay clases disponibles. Crea primero un proceso con alumnos.
                </p>
              )}
            </div>

            {/* Group sizes */}
            <div className="space-y-2">
              <Label>Configuración de grupos</Label>
              <div className="space-y-2">
                {formGroupSizes.map((row, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Select value={String(row.count)} onValueChange={v => updateGroupSizeRow(i, "count", Number(v))}>
                      <SelectTrigger className="w-20 h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[1,2,3,4,5,6,7,8,9,10].map(n => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-muted-foreground shrink-0">grupos de</span>
                    <Select value={String(row.size)} onValueChange={v => updateGroupSizeRow(i, "size", Number(v))}>
                      <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[2,3,4,5,6,7,8].map(n => (
                          <SelectItem key={n} value={String(n)}>{n} alumnos</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formGroupSizes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeGroupSizeRow(i)}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addGroupSizeRow}>
                <Plus className="w-3 h-3" /> Añadir tamaño diferente
              </Button>
              <p className="text-xs text-muted-foreground">
                Total: <strong>{totalGroups} grupos</strong> · {totalSlots} huecos para alumnos
              </p>
            </div>

            {/* Toggles */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="coop-gender">Equilibrar género</Label>
                <Switch id="coop-gender" checked={formBalanceGender} onCheckedChange={setFormBalanceGender} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="coop-academic">Equilibrar nivel académico</Label>
                <Switch id="coop-academic" checked={formBalanceAcademic} onCheckedChange={setFormBalanceAcademic} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="coop-sociogram">Usar sociograma</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Tiene en cuenta amistades y conflictos</p>
                </div>
                <Switch id="coop-sociogram" checked={formUseSociogram} onCheckedChange={setFormUseSociogram} />
              </div>
            </div>

            {/* Snapshot selector */}
            {formUseSociogram && (
              <div className="space-y-2 rounded-lg border p-3 bg-muted/30">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Datos del sociograma
                </Label>
                {!snapshotProcessId ? (
                  <p className="text-xs text-muted-foreground">
                    Selecciona una clase para ver los sociogramas disponibles.
                  </p>
                ) : loadingSnapshots ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Cargando snapshots...
                  </div>
                ) : (
                  <Select value={formSnapshotId} onValueChange={setFormSnapshotId}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="current">Respuestas actuales</SelectItem>
                      {snapshots.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                          <span className="ml-2 text-xs text-muted-foreground">
                            · {formatDate(s.created_at)}
                            {s.response_count != null ? ` · ${s.response_count} resp.` : ""}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {snapshotProcessId && !creatingSnapshot && (
                  <Button
                    variant="link" size="sm"
                    className="h-auto p-0 text-xs text-muted-foreground"
                    onClick={() => setCreatingSnapshot(true)}
                  >
                    <Camera className="w-3 h-3 mr-1" /> Guardar snapshot de las respuestas actuales
                  </Button>
                )}
                {creatingSnapshot && (
                  <div className="flex gap-2 items-center">
                    <Input
                      placeholder="Nombre del snapshot"
                      value={newSnapshotName}
                      onChange={e => setNewSnapshotName(e.target.value)}
                      className="h-8 text-sm flex-1"
                      onKeyDown={e => e.key === "Enter" && handleCreateSnapshot()}
                    />
                    <Button size="sm" className="h-8 px-3" onClick={handleCreateSnapshot} disabled={savingSnapshot}>
                      {savingSnapshot ? <Loader2 className="w-3 h-3 animate-spin" /> : "Guardar"}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 px-2"
                      onClick={() => { setCreatingSnapshot(false); setNewSnapshotName("") }}>✕</Button>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={creating}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating || classes.length === 0} className="gap-2">
              {creating && <Loader2 className="w-4 h-4 animate-spin" />}
              Crear sesión
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
