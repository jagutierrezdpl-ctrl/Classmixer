"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import {
  Search, User, ChevronRight, Loader2,
  Upload, Download, Users, LayoutGrid, AlertTriangle, Plus, Trash2
} from "lucide-react"
import Link from "next/link"
import { getCurrentSchoolYear, getSchoolYears } from "@/utils/school-year"

const SCHOOL_YEARS = getSchoolYears(1, 3)
const DEFAULT_SCHOOL_YEAR = getCurrentSchoolYear()

interface StudentProfile {
  id: string
  external_id: string
  first_name: string
  last_name: string
  current_class: string | null
  gender: string | null
  academic_level: string | null
  needs_type: string | null
  birth_year: number | null
}

interface GroupSummary {
  name: string
  count: number
  female: number
  male: number
  with_needs: number
  tutor: { id: string; name: string; email: string } | null
}

export default function AlumnadoPage() {
  const [profiles, setProfiles] = useState<StudentProfile[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState("")
  const [debouncedQ, setDebouncedQ] = useState("")
  const [filterClass, setFilterClass] = useState("")
  const [loading, setLoading] = useState(false)
  const [groups, setGroups] = useState<GroupSummary[]>([])
  const [groupsLoading, setGroupsLoading] = useState(false)

  // New group dialog
  const [newGroupOpen, setNewGroupOpen] = useState(false)
  const [newGroupCourse, setNewGroupCourse] = useState("")
  const [newGroupLetter, setNewGroupLetter] = useState("A")
  const [newGroupYear, setNewGroupYear] = useState(DEFAULT_SCHOOL_YEAR)
  const [newGroupSaving, setNewGroupSaving] = useState(false)
  const [newGroupError, setNewGroupError] = useState<string | null>(null)

  // New student dialog
  const [newStudentOpen, setNewStudentOpen] = useState(false)
  const [newStudentSaving, setNewStudentSaving] = useState(false)
  const [newStudentError, setNewStudentError] = useState<string | null>(null)
  const [newStudentForm, setNewStudentForm] = useState({
    first_name: "", last_name: "", external_id: "",
    current_class: "", gender: "", average_grade: "",
    academic_level: "", behavior_level: "", needs_type: "", email: "", observations: "",
  })

  // Import dialog
  const [importOpen, setImportOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; total_rows: number } | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(q); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [q])

  const loadProfiles = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (debouncedQ) params.set("q", debouncedQ)
      if (filterClass) params.set("class", filterClass)
      const res = await fetch(`/api/student-profiles?${params}`)
      const data = await res.json()
      setProfiles(data.profiles ?? [])
      setTotal(data.total ?? 0)
    } finally {
      setLoading(false)
    }
  }, [page, debouncedQ, filterClass])

  const loadGroups = useCallback(async () => {
    setGroupsLoading(true)
    try {
      const res = await fetch("/api/student-profiles/groups")
      const data = await res.json()
      setGroups(Array.isArray(data) ? data : [])
    } finally {
      setGroupsLoading(false)
    }
  }, [])

  useEffect(() => { loadProfiles() }, [loadProfiles])
  useEffect(() => { loadGroups() }, [loadGroups])

  const pageSize = 50
  const totalPages = Math.ceil(total / pageSize)

  async function handleImport() {
    if (!importFile) return
    setImporting(true)
    setImportError(null)
    setImportResult(null)
    try {
      const fd = new FormData()
      fd.append("file", importFile)
      const res = await fetch("/api/student-profiles/import", { method: "POST", body: fd })
      const data = await res.json()
      if (data.error) {
        setImportError(data.error)
      } else {
        setImportResult(data)
        loadProfiles()
        loadGroups()
      }
    } catch {
      setImportError("Error al importar el archivo")
    } finally {
      setImporting(false)
    }
  }

  function handleImportClose() {
    setImportOpen(false)
    setImportFile(null)
    setImportResult(null)
    setImportError(null)
  }

  function handleNewStudentClose() {
    setNewStudentOpen(false)
    setNewStudentError(null)
    setNewStudentForm({
      first_name: "", last_name: "", external_id: "",
      current_class: "", gender: "", average_grade: "",
      academic_level: "", behavior_level: "", needs_type: "", observations: "",
    })
  }

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault()
    const name = newGroupCourse + newGroupLetter
    setNewGroupSaving(true)
    setNewGroupError(null)
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, school_year: newGroupYear }),
      })
      const data = await res.json()
      if (!res.ok) {
        setNewGroupError(data.error ?? "Error al crear el grupo")
      } else {
        setNewGroupOpen(false)
        setNewGroupCourse("")
        setNewGroupLetter("A")
        setNewGroupYear("")
        setNewGroupError(null)
        loadGroups()
      }
    } catch {
      setNewGroupError("Error de red al guardar")
    } finally {
      setNewGroupSaving(false)
    }
  }

  async function handleDeleteGroup(name: string) {
    if (!confirm(`¿Eliminar el grupo "${name}"? Solo es posible si no tiene alumnos asignados.`)) return
    const res = await fetch(`/api/groups?name=${encodeURIComponent(name)}`, { method: "DELETE" })
    const data = await res.json()
    if (!res.ok) {
      alert(data.error ?? "Error al eliminar el grupo")
    } else {
      loadGroups()
    }
  }

  async function handleCreateStudent(e: React.FormEvent) {
    e.preventDefault()
    setNewStudentSaving(true)
    setNewStudentError(null)
    try {
      const res = await fetch("/api/student-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newStudentForm),
      })
      const data = await res.json()
      if (!res.ok) {
        setNewStudentError(data.error ?? "Error al crear el alumno")
      } else {
        handleNewStudentClose()
        loadProfiles()
        loadGroups()
      }
    } catch {
      setNewStudentError("Error de red al guardar")
    } finally {
      setNewStudentSaving(false)
    }
  }

  const GENDER_COLORS: Record<string, string> = {
    F: "bg-pink-100 text-pink-700",
    M: "bg-blue-100 text-blue-700",
    Otro: "bg-purple-100 text-purple-700",
  }

  const SEL = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Alumnado</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Registro central de alumnos del centro, independiente de los procesos
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="/api/student-profiles/export-template" download>
              <Download className="w-4 h-4 mr-2" />Plantilla
            </a>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />Importar Excel
          </Button>
          <Button size="sm" onClick={() => setNewStudentOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />Nuevo alumno
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <Users className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{total}</p>
              <p className="text-xs text-muted-foreground">Alumnos totales</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <LayoutGrid className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{groups.length}</p>
              <p className="text-xs text-muted-foreground">Grupos / Clases</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">
                {groups.filter(g => !g.tutor).length}
              </p>
              <p className="text-xs text-muted-foreground">Sin tutor asignado</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="alumnos">
        <TabsList className="mb-6">
          <TabsTrigger value="alumnos">
            <User className="w-4 h-4 mr-2" />Alumnos
          </TabsTrigger>
          <TabsTrigger value="grupos">
            <LayoutGrid className="w-4 h-4 mr-2" />Grupos
          </TabsTrigger>
        </TabsList>

        {/* ALUMNOS TAB */}
        <TabsContent value="alumnos">
          <div className="flex gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar por nombre, apellidos o ID..."
                value={q}
                onChange={e => setQ(e.target.value)}
              />
            </div>
            <Input
              className="w-32"
              placeholder="Clase (ej. 6A)"
              value={filterClass}
              onChange={e => { setFilterClass(e.target.value); setPage(1) }}
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />Cargando...
            </div>
          ) : profiles.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              {debouncedQ || filterClass ? "No se encontraron resultados" : "No hay alumnos registrados todavía"}
              <p className="text-sm mt-1">
                Importa un Excel para crear perfiles de alumnado
              </p>
            </div>
          ) : (
            <>
              <div className="text-sm text-muted-foreground mb-3">
                {total} alumno{total !== 1 ? "s" : ""}
                {filterClass && ` en clase ${filterClass}`}
              </div>

              <div className="space-y-2">
                {profiles.map(p => (
                  <Card key={p.id} className="hover:bg-muted/30 transition-colors">
                    <CardContent className="py-3 px-4">
                      <Link href={`/alumnado/${p.id}`} className="flex items-center gap-4">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">
                            {p.last_name}, {p.first_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            ID: {p.external_id ?? "—"}
                            {p.current_class && ` · ${p.current_class}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {p.gender && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              GENDER_COLORS[p.gender] ?? "bg-muted text-muted-foreground"
                            }`}>
                              {p.gender}
                            </span>
                          )}
                          {p.academic_level && (
                            <Badge variant="outline" className="text-xs">{p.academic_level}</Badge>
                          )}
                          {p.needs_type && p.needs_type !== "No" && (
                            <Badge className="text-xs bg-amber-100 text-amber-700 border-0">{p.needs_type}</Badge>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                    Anterior
                  </Button>
                  <span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                    Siguiente
                  </Button>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* GRUPOS TAB */}
        <TabsContent value="grupos">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              Crea los grupos primero y luego asigna alumnos. Los tutores se asignan desde el detalle de cada grupo.
            </p>
            <Button size="sm" onClick={() => setNewGroupOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />Nuevo grupo
            </Button>
          </div>

          {groupsLoading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />Cargando grupos...
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <LayoutGrid className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No hay grupos configurados</p>
              <p className="text-sm mt-1">Crea grupos antes de importar alumnos</p>
              <Button size="sm" className="mt-4" onClick={() => setNewGroupOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />Crear primer grupo
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {groups.map(g => (
                <Card key={g.name} className="hover:bg-muted/30 transition-colors">
                  <CardContent className="py-4 px-5">
                    <div className="flex items-start justify-between gap-4">
                      <Link href={`/alumnado/grupos/${encodeURIComponent(g.name)}`} className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-lg">{g.name}</h3>
                          <Badge variant={g.count === 0 ? "outline" : "secondary"}>
                            {g.count === 0 ? "Vacío" : `${g.count} alumnos`}
                          </Badge>
                        </div>
                        <div className="flex gap-3 text-xs text-muted-foreground">
                          {g.female > 0 && <span className="text-pink-600">{g.female}F</span>}
                          {g.male > 0 && <span className="text-blue-600">{g.male}M</span>}
                          {g.with_needs > 0 && (
                            <span className="text-amber-600 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />{g.with_needs} NEE
                            </span>
                          )}
                        </div>
                        <div className="mt-2">
                          {g.tutor ? (
                            <span className="text-xs text-muted-foreground">
                              Tutor/a: <span className="font-medium text-foreground">{g.tutor.name}</span>
                            </span>
                          ) : (
                            <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                              Sin tutor asignado
                            </Badge>
                          )}
                        </div>
                      </Link>
                      {g.count === 0 && (
                        <button
                          onClick={() => handleDeleteGroup(g.name)}
                          className="text-muted-foreground hover:text-destructive transition-colors shrink-0 mt-1"
                          title="Eliminar grupo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* New group dialog */}
      <Dialog open={newGroupOpen} onOpenChange={open => { if (!open) { setNewGroupOpen(false); setNewGroupCourse(""); setNewGroupLetter("A"); setNewGroupYear(DEFAULT_SCHOOL_YEAR); setNewGroupError(null) } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nuevo grupo</DialogTitle>
            <DialogDescription>Selecciona el curso y la letra para formar el nombre del grupo.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateGroup} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Curso *</label>
                <select
                  value={newGroupCourse}
                  onChange={e => setNewGroupCourse(e.target.value)}
                  className={SEL}
                  required
                  autoFocus
                >
                  <option value="">Selecciona...</option>
                  <optgroup label="Infantil">
                    <option value="I3">Infantil 3 años</option>
                    <option value="I4">Infantil 4 años</option>
                    <option value="I5">Infantil 5 años</option>
                  </optgroup>
                  <optgroup label="Primaria">
                    <option value="1P">1º Primaria</option>
                    <option value="2P">2º Primaria</option>
                    <option value="3P">3º Primaria</option>
                    <option value="4P">4º Primaria</option>
                    <option value="5P">5º Primaria</option>
                    <option value="6P">6º Primaria</option>
                  </optgroup>
                  <optgroup label="ESO">
                    <option value="1E">1º ESO</option>
                    <option value="2E">2º ESO</option>
                    <option value="3E">3º ESO</option>
                    <option value="4E">4º ESO</option>
                  </optgroup>
                  <optgroup label="Bachillerato">
                    <option value="1B">1º Bachillerato</option>
                    <option value="2B">2º Bachillerato</option>
                  </optgroup>
                  <optgroup label="FP">
                    <option value="1FP">1º FP Básica</option>
                    <option value="2FP">2º FP Básica</option>
                    <option value="1GM">1º CFGM</option>
                    <option value="2GM">2º CFGM</option>
                    <option value="1GS">1º CFGS</option>
                    <option value="2GS">2º CFGS</option>
                  </optgroup>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Letra *</label>
                <select
                  value={newGroupLetter}
                  onChange={e => setNewGroupLetter(e.target.value)}
                  className={SEL}
                >
                  {["A","B","C","D","E"].map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
            </div>

            {newGroupCourse && (
              <div className="rounded-lg bg-muted px-4 py-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">Nombre del grupo</p>
                <p className="text-2xl font-bold tracking-wide">{newGroupCourse}{newGroupLetter}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Curso escolar</label>
              <select
                value={newGroupYear}
                onChange={e => setNewGroupYear(e.target.value)}
                className={SEL}
              >
                <option value="">Sin especificar</option>
                {SCHOOL_YEARS.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {newGroupError && <p className="text-sm text-destructive">{newGroupError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setNewGroupOpen(false); setNewGroupCourse(""); setNewGroupLetter("A"); setNewGroupYear(DEFAULT_SCHOOL_YEAR); setNewGroupError(null) }}>
                Cancelar
              </Button>
              <Button type="submit" disabled={newGroupSaving || !newGroupCourse}>
                {newGroupSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Crear grupo
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* New student dialog */}
      <Dialog open={newStudentOpen} onOpenChange={open => { if (!open) handleNewStudentClose() }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo alumno</DialogTitle>
            <DialogDescription>Crea un perfil de alumno manualmente.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateStudent} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Nombre *</label>
                <Input
                  value={newStudentForm.first_name}
                  onChange={e => setNewStudentForm(f => ({ ...f, first_name: e.target.value }))}
                  placeholder="Nombre"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Apellidos *</label>
                <Input
                  value={newStudentForm.last_name}
                  onChange={e => setNewStudentForm(f => ({ ...f, last_name: e.target.value }))}
                  placeholder="Apellidos"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">ID externo</label>
                <Input
                  value={newStudentForm.external_id}
                  onChange={e => setNewStudentForm(f => ({ ...f, external_id: e.target.value }))}
                  placeholder="Ej: A001"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Clase actual</label>
                <select
                  value={newStudentForm.current_class}
                  onChange={e => setNewStudentForm(f => ({ ...f, current_class: e.target.value }))}
                  className={SEL}
                >
                  <option value="">Sin asignar</option>
                  {groups.map(g => (
                    <option key={g.name} value={g.name}>{g.name} ({g.count} alumnos)</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Género</label>
                <select
                  value={newStudentForm.gender}
                  onChange={e => setNewStudentForm(f => ({ ...f, gender: e.target.value }))}
                  className={SEL}
                >
                  <option value="">No especificado</option>
                  <option value="F">F</option>
                  <option value="M">M</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Nota media</label>
                <Input
                  type="number"
                  min={0}
                  max={10}
                  step={0.1}
                  value={newStudentForm.average_grade}
                  onChange={e => setNewStudentForm(f => ({ ...f, average_grade: e.target.value }))}
                  placeholder="0 – 10"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Nivel académico</label>
                <select
                  value={newStudentForm.academic_level}
                  onChange={e => setNewStudentForm(f => ({ ...f, academic_level: e.target.value }))}
                  className={SEL}
                >
                  <option value="">—</option>
                  {["Alto", "Medio-alto", "Medio", "Medio-bajo", "Bajo"].map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Conducta</label>
                <select
                  value={newStudentForm.behavior_level}
                  onChange={e => setNewStudentForm(f => ({ ...f, behavior_level: e.target.value }))}
                  className={SEL}
                >
                  <option value="">—</option>
                  {["Positiva", "Normal", "Seguimiento", "Conflictiva"].map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Necesidades educativas</label>
              <select
                value={newStudentForm.needs_type}
                onChange={e => setNewStudentForm(f => ({ ...f, needs_type: e.target.value }))}
                className={SEL}
              >
                <option value="">—</option>
                {["No", "Sí", "ACNEAE", "NEE", "Refuerzo", "Altas capacidades", "Observación interna"].map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email institucional <span className="text-amber-600 text-xs">(Google Workspace)</span></label>
              <Input
                type="email"
                value={newStudentForm.email}
                onChange={e => setNewStudentForm(f => ({ ...f, email: e.target.value }))}
                placeholder="alumno@colegio.es"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Observaciones</label>
              <Textarea
                value={newStudentForm.observations}
                onChange={e => setNewStudentForm(f => ({ ...f, observations: e.target.value }))}
                placeholder="Observaciones internas..."
                rows={2}
              />
            </div>
            {newStudentError && (
              <p className="text-sm text-destructive">{newStudentError}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleNewStudentClose}>Cancelar</Button>
              <Button type="submit" disabled={newStudentSaving}>
                {newStudentSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Crear alumno
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Import dialog */}
      <Dialog open={importOpen} onOpenChange={open => { if (!open) handleImportClose() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar alumnos desde Excel</DialogTitle>
            <DialogDescription>
              Sube un Excel con los perfiles del alumnado. Los alumnos existentes se actualizarán por su ID externo.
            </DialogDescription>
          </DialogHeader>

          {importResult ? (
            <div className="py-4 text-center">
              <p className="text-green-600 font-semibold text-lg">
                ✓ {importResult.imported} alumnos importados
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                de {importResult.total_rows} filas en el archivo
              </p>
            </div>
          ) : (
            <div className="py-2 space-y-4">
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                {importFile ? (
                  <p className="text-sm font-medium">{importFile.name}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Haz clic para seleccionar un archivo .xlsx o .xls
                  </p>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={e => setImportFile(e.target.files?.[0] ?? null)}
              />
              {importError && (
                <p className="text-sm text-destructive">{importError}</p>
              )}
              <div className="text-xs text-muted-foreground">
                Columnas esperadas: <code>id_alumno, nombre, apellidos, clase_actual, genero, nivel_academico, conducta, necesidades, nota_media, email, observaciones</code>
                <br /><span className="text-amber-600">El campo <strong>email</strong> es necesario para el acceso con Google Workspace.</span>
              </div>
            </div>
          )}

          <DialogFooter>
            {importResult ? (
              <Button onClick={handleImportClose}>Cerrar</Button>
            ) : (
              <>
                <Button variant="outline" onClick={handleImportClose}>Cancelar</Button>
                <Button onClick={handleImport} disabled={!importFile || importing}>
                  {importing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Importar
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
