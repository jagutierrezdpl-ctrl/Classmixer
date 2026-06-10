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
import {
  Search, User, ChevronRight, Loader2,
  Upload, Download, Users, LayoutGrid, AlertTriangle
} from "lucide-react"
import Link from "next/link"

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

  const GENDER_COLORS: Record<string, string> = {
    F: "bg-pink-100 text-pink-700",
    M: "bg-blue-100 text-blue-700",
    Otro: "bg-purple-100 text-purple-700",
  }

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
          <Button size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />Importar Excel
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
          {groupsLoading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />Cargando grupos...
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              No hay grupos configurados
              <p className="text-sm mt-1">Los grupos se crean al importar alumnos con clase asignada</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {groups.map(g => (
                <Card key={g.name} className="hover:bg-muted/30 transition-colors">
                  <CardContent className="py-4 px-5">
                    <Link href={`/alumnado/grupos/${encodeURIComponent(g.name)}`} className="block">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-lg">{g.name}</h3>
                            <Badge variant="outline">{g.count} alumnos</Badge>
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
                        </div>
                        <div className="text-right">
                          {g.tutor ? (
                            <div>
                              <p className="text-xs text-muted-foreground">Tutor/a</p>
                              <p className="text-sm font-medium">{g.tutor.name}</p>
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                              Sin tutor
                            </Badge>
                          )}
                        </div>
                      </div>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

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
                Columnas esperadas: <code>id_alumno, nombre, apellidos, clase_actual, genero, nivel_academico, conducta, necesidades, observaciones</code>
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
