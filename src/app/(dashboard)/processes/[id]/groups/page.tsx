"use client"

import { use, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowLeft, Plus, Users2, Loader2, Calendar, ChevronRight, Camera, History } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import type { GroupSession, SociogramSnapshot } from "@/types"

type GroupSessionWithSets = Omit<GroupSession, "group_sets"> & {
  group_sets?: Array<{
    id: string
    name: string
    status: "generado" | "aprobado"
    score_total: number | null
    generated_at: string
  }>
  sociogram_snapshots?: { id: string; name: string } | null
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })
}

export default function GroupsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [sessions, setSessions] = useState<GroupSessionWithSets[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [open, setOpen] = useState(false)

  const [classes, setClasses] = useState<string[]>([])

  // Form state
  const [formClassName, setFormClassName] = useState("")
  const [formName, setFormName] = useState("")
  const [formNumGroups, setFormNumGroups] = useState(4)
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

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [sessRes, stuRes] = await Promise.all([
          fetch(`/api/processes/${id}/groups`),
          fetch(`/api/processes/${id}/students`),
        ])
        if (sessRes.ok) setSessions(await sessRes.json())
        if (stuRes.ok) {
          const students: { current_class: string }[] = await stuRes.json()
          const unique = [...new Set(students.map(s => s.current_class))].sort()
          setClasses(unique)
          if (unique.length > 0 && !formClassName) setFormClassName(unique[0])
        }
      } catch {
        toast.error("Error al cargar las sesiones")
      } finally {
        setLoading(false)
      }
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Load snapshots when sociogram toggle is turned on
  useEffect(() => {
    if (formUseSociogram && open) loadSnapshots()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formUseSociogram, open])

  async function loadSnapshots() {
    setLoadingSnapshots(true)
    try {
      const res = await fetch(`/api/processes/${id}/sociogram/snapshots`)
      if (res.ok) {
        const data = await res.json()
        setSnapshots(data)
        // Default to latest snapshot if any, otherwise "current"
        if (data.length > 0 && formSnapshotId === "current") {
          setFormSnapshotId(data[0].id)
        }
      }
    } finally {
      setLoadingSnapshots(false)
    }
  }

  async function handleCreateSnapshot() {
    if (!newSnapshotName.trim()) { toast.error("Escribe un nombre para el snapshot"); return }
    setSavingSnapshot(true)
    try {
      const res = await fetch(`/api/processes/${id}/sociogram/snapshots`, {
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
    } catch {
      toast.error("Error inesperado")
    } finally {
      setSavingSnapshot(false)
    }
  }

  async function handleCreate() {
    if (!formClassName) { toast.error("Selecciona una clase"); return }
    if (!formName.trim()) { toast.error("Escribe un nombre para la sesión"); return }
    setCreating(true)
    try {
      const res = await fetch(`/api/processes/${id}/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          class_name: formClassName,
          name: formName.trim(),
          num_groups: formNumGroups,
          balance_gender: formBalanceGender,
          balance_academic: formBalanceAcademic,
          use_sociogram: formUseSociogram,
          sociogram_snapshot_id: formUseSociogram && formSnapshotId !== "current" ? formSnapshotId : null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? "Error al crear la sesión")
        return
      }
      const session = await res.json()
      setOpen(false)
      router.push(`/processes/${id}/groups/${session.id}`)
    } catch {
      toast.error("Error inesperado")
    } finally {
      setCreating(false)
    }
  }

  function handleOpenChange(v: boolean) {
    setOpen(v)
    if (!v) {
      // Reset snapshot form state on close
      setCreatingSnapshot(false)
      setNewSnapshotName("")
    }
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between mb-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/processes/${id}`}><ArrowLeft className="w-4 h-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Grupos cooperativos</h1>
            <p className="text-muted-foreground text-sm">Genera grupos de trabajo equilibrados dentro de cada clase</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild className="gap-2">
            <Link href={`/processes/${id}/groups/history`}>
              <History className="w-4 h-4" /> Historial
            </Link>
          </Button>
          <Button onClick={() => setOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Nueva sesión
          </Button>
        </div>
      </div>

      {/* Sessions list */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : sessions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Users2 className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="font-medium">No hay sesiones de grupos todavía</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Crea una sesión para generar grupos cooperativos en una clase
            </p>
            <Button onClick={() => setOpen(true)} variant="outline" className="gap-2">
              <Plus className="w-4 h-4" /> Crear primera sesión
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sessions.map(session => (
            <Link key={session.id} href={`/processes/${id}/groups/${session.id}`}>
              <Card className="hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Users2 className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base leading-tight">{session.name}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">Clase {session.class_name}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 flex-wrap text-sm">
                    <span className="text-muted-foreground">{session.num_groups} grupos</span>
                    {session.balance_gender && <Badge variant="outline" className="text-xs">Género</Badge>}
                    {session.balance_academic && <Badge variant="outline" className="text-xs">Nivel</Badge>}
                    {session.use_sociogram && (
                      <Badge variant="outline" className="text-xs gap-1">
                        <Camera className="w-3 h-3" />
                        {session.sociogram_snapshots?.name ?? "Sociograma actual"}
                      </Badge>
                    )}
                  </div>
                  {(session.group_sets?.length ?? 0) > 0 ? (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" />
                      {session.group_sets!.length} distribución{session.group_sets!.length !== 1 ? "es" : ""} generada{session.group_sets!.length !== 1 ? "s" : ""}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Sin distribuciones todavía</p>
                  )}
                  <p className="text-xs text-muted-foreground">Creada el {formatDate(session.created_at)}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Create session dialog */}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva sesión de grupos</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="sess-name">Nombre de la sesión</Label>
              <Input
                id="sess-name"
                placeholder="Ej: Grupos de Octubre"
                value={formName}
                onChange={e => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sess-class">Clase</Label>
              {classes.length > 0 ? (
                <Select value={formClassName} onValueChange={setFormClassName}>
                  <SelectTrigger id="sess-class">
                    <SelectValue placeholder="Selecciona una clase" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="sess-class"
                  placeholder="Ej: 6PA"
                  value={formClassName}
                  onChange={e => setFormClassName(e.target.value)}
                />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="sess-num">Número de grupos</Label>
              <Select value={String(formNumGroups)} onValueChange={v => setFormNumGroups(Number(v))}>
                <SelectTrigger id="sess-num"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2, 3, 4, 5, 6, 7, 8].map(n => (
                    <SelectItem key={n} value={String(n)}>{n} grupos</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="balance-gender">Equilibrar género</Label>
                <Switch id="balance-gender" checked={formBalanceGender} onCheckedChange={setFormBalanceGender} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="balance-academic">Equilibrar nivel académico</Label>
                <Switch id="balance-academic" checked={formBalanceAcademic} onCheckedChange={setFormBalanceAcademic} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="use-sociogram">Usar sociograma</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Tiene en cuenta amistades y conflictos</p>
                </div>
                <Switch id="use-sociogram" checked={formUseSociogram} onCheckedChange={setFormUseSociogram} />
              </div>
            </div>

            {/* Snapshot selector — only when use_sociogram is ON */}
            {formUseSociogram && (
              <div className="space-y-2 rounded-lg border p-3 bg-muted/30">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Datos del sociograma
                </Label>
                {loadingSnapshots ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Cargando snapshots...
                  </div>
                ) : (
                  <Select value={formSnapshotId} onValueChange={setFormSnapshotId}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="current">
                        Respuestas actuales
                      </SelectItem>
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
                {/* Inline create snapshot */}
                {!creatingSnapshot ? (
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs text-muted-foreground"
                    onClick={() => setCreatingSnapshot(true)}
                  >
                    <Camera className="w-3 h-3 mr-1" /> Guardar snapshot de las respuestas actuales
                  </Button>
                ) : (
                  <div className="flex gap-2 items-center">
                    <Input
                      placeholder="Nombre del snapshot (ej: Trimestre 1)"
                      value={newSnapshotName}
                      onChange={e => setNewSnapshotName(e.target.value)}
                      className="h-8 text-sm flex-1"
                      onKeyDown={e => e.key === "Enter" && handleCreateSnapshot()}
                    />
                    <Button
                      size="sm"
                      className="h-8 px-3"
                      onClick={handleCreateSnapshot}
                      disabled={savingSnapshot}
                    >
                      {savingSnapshot ? <Loader2 className="w-3 h-3 animate-spin" /> : "Guardar"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2"
                      onClick={() => { setCreatingSnapshot(false); setNewSnapshotName("") }}
                    >
                      ✕
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={creating}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating} className="gap-2">
              {creating && <Loader2 className="w-4 h-4 animate-spin" />}
              Crear sesión
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
