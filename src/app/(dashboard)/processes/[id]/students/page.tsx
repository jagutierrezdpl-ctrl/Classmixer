"use client"

import { useState, use } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Upload, Download, CheckCircle, XCircle, AlertTriangle,
  Users, Search, ArrowLeft, Loader2, FileSpreadsheet, RefreshCw,
} from "lucide-react"
import Link from "next/link"
import type { ImportPreview, Student } from "@/types"
import LoadFromProfilesDialog from "@/components/students/LoadFromProfilesDialog"

type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning"

const BEHAVIOR_COLORS: Record<string, BadgeVariant> = {
  Positiva: "success",
  Normal: "secondary",
  Seguimiento: "warning",
  Conflictiva: "destructive",
}

const LEVEL_COLORS: Record<string, BadgeVariant> = {
  Alto: "success",
  "Medio-alto": "secondary",
  Medio: "secondary",
  "Medio-bajo": "warning",
  Bajo: "destructive",
}

export default function StudentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const [view, setView] = useState<"list" | "import" | "preview" | "update-grades" | "update-grades-preview">("list")
  const [gradesPreview, setGradesPreview] = useState<{
    total: number; matched: number; unmatched: number; unmatched_list: string[];
    preview: { name: string; grade: number; level: string }[];
    file?: File;
  } | null>(null)
  const [loadFromProfilesOpen, setLoadFromProfilesOpen] = useState(false)
  const [students, setStudents] = useState<Student[]>([])
  const [, setLoadingInit] = useState(true)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [importing, setImporting] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [search, setSearch] = useState("")

  // Load students on mount
  useState(() => {
    fetch(`/api/processes/${id}/students`)
      .then(r => r.json())
      .then(data => {
        setStudents(Array.isArray(data) ? data : [])
        setLoadingInit(false)
      })
      .catch(() => setLoadingInit(false))
  })

  async function handleFileUpload(file: File) {
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      toast.error("Solo se admiten archivos Excel (.xlsx, .xls)")
      return
    }
    setImporting(true)
    const formData = new FormData()
    formData.append("file", file)

    try {
      const res = await fetch(`/api/processes/${id}/students?action=preview`, {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (data.errors?.length && data.errors[0]?.field === "columnas") {
        toast.error(data.errors[0].message)
        setImporting(false)
        return
      }
      setPreview(data)
      setView("preview")
    } catch {
      toast.error("Error al procesar el archivo")
    } finally {
      setImporting(false)
    }
  }

  async function handleConfirmImport() {
    if (!preview) return
    setImporting(true)
    try {
      const res = await fetch(`/api/processes/${id}/students?action=confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: preview.rows }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`${data.imported} alumnos importados correctamente`)
      const updated = await fetch(`/api/processes/${id}/students`).then(r => r.json())
      setStudents(Array.isArray(updated) ? updated : [])
      setView("list")
      setPreview(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al importar")
    } finally {
      setImporting(false)
    }
  }

  async function downloadTemplate() {
    const res = await fetch(`/api/processes/${id}/students?action=template`, { method: "POST" })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "plantilla_alumnos.xlsx"
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleGradesFileUpload(file: File) {
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      toast.error("Solo se admiten archivos Excel (.xlsx, .xls)")
      return
    }
    setImporting(true)
    const formData = new FormData()
    formData.append("file", file)
    try {
      const res = await fetch(`/api/processes/${id}/students/update-grades?action=preview`, {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? "Error al procesar"); return }
      setGradesPreview({ ...data, file })
      setView("update-grades-preview")
    } catch {
      toast.error("Error al procesar el archivo")
    } finally {
      setImporting(false)
    }
  }

  async function handleConfirmGradesUpdate() {
    if (!gradesPreview?.file) return
    setImporting(true)
    const formData = new FormData()
    formData.append("file", gradesPreview.file)
    try {
      const res = await fetch(`/api/processes/${id}/students/update-grades?action=confirm`, {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`${data.updated} alumnos actualizados`)
      const updated = await fetch(`/api/processes/${id}/students`).then(r => r.json())
      setStudents(Array.isArray(updated) ? updated : [])
      setView("list")
      setGradesPreview(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al actualizar")
    } finally {
      setImporting(false)
    }
  }

  const filteredStudents = students.filter(s => {
    const q = search.toLowerCase()
    return !q || `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) || s.current_class.toLowerCase().includes(q)
  })

  // ── IMPORT VIEW ─────────────────────────────────────────────────────────────
  if (view === "import") {
    return (
      <div className="p-8 max-w-2xl">
        <div className="flex items-center gap-3 mb-8">
          <Button variant="ghost" size="icon" onClick={() => setView("list")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Importar alumnos</h1>
            <p className="text-muted-foreground text-sm">Sube un Excel con los datos del alumnado</p>
          </div>
        </div>

        <div className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
              dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            }`}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => {
              e.preventDefault()
              setDragging(false)
              const file = e.dataTransfer.files[0]
              if (file) handleFileUpload(file)
            }}
            onClick={() => document.getElementById("file-input")?.click()}
          >
            {importing ? (
              <Loader2 className="w-10 h-10 mx-auto mb-3 animate-spin text-primary" />
            ) : (
              <FileSpreadsheet className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            )}
            <p className="font-medium mb-1">
              {importing ? "Procesando..." : "Arrastra tu Excel aquí"}
            </p>
            <p className="text-sm text-muted-foreground">o haz clic para seleccionar</p>
            <p className="text-xs text-muted-foreground mt-2">.xlsx o .xls</p>
            <input
              id="file-input"
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
            />
          </div>

          <Button variant="outline" className="w-full" onClick={downloadTemplate}>
            <Download className="w-4 h-4" />
            Descargar plantilla Excel
          </Button>
        </div>
      </div>
    )
  }

  // ── PREVIEW VIEW ─────────────────────────────────────────────────────────────
  if (view === "preview" && preview) {
    const valid = preview.valid
    const total = preview.total
    const errCount = preview.rows.filter(r => r.status === "error").length
    const warnCount = preview.warnings.length

    return (
      <div className="p-8 max-w-4xl">
        <div className="flex items-center gap-3 mb-8">
          <Button variant="ghost" size="icon" onClick={() => { setView("import"); setPreview(null) }}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Revisar importación</h1>
            <p className="text-muted-foreground text-sm">Verifica los datos antes de guardar</p>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-2xl font-bold">{total}</p>
              <p className="text-xs text-muted-foreground">Detectados</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-2xl font-bold text-green-600">{valid}</p>
              <p className="text-xs text-muted-foreground">Válidos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-2xl font-bold text-red-600">{errCount}</p>
              <p className="text-xs text-muted-foreground">Con errores</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-2xl font-bold text-yellow-600">{warnCount}</p>
              <p className="text-xs text-muted-foreground">Advertencias</p>
            </CardContent>
          </Card>
        </div>

        {/* Gender and grade stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Distribución por género</CardTitle>
            </CardHeader>
            <CardContent>
              {Object.entries(preview.gender_distribution).map(([g, n]) => (
                <div key={g} className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground">{g}</span>
                  <span className="font-medium">{n}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Clases detectadas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1">
                {preview.detected_classes.map(c => (
                  <Badge key={c} variant="outline">{c}</Badge>
                ))}
              </div>
              <p className="text-sm mt-3">
                Nota media: <span className="font-semibold">{preview.average_grade}</span>
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Errors */}
        {preview.errors.length > 0 && (
          <Card className="mb-4 border-destructive/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                <XCircle className="w-4 h-4" /> Errores ({preview.errors.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {preview.errors.map((e, i) => (
                  <p key={i} className="text-xs text-destructive">
                    Fila {e.row}: {e.message}
                  </p>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Warnings */}
        {preview.warnings.length > 0 && (
          <Card className="mb-6 border-yellow-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-yellow-700">
                <AlertTriangle className="w-4 h-4" /> Advertencias ({preview.warnings.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {preview.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-yellow-700">
                    Fila {w.row}: {w.message}
                  </p>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {valid > 0 && (
            <Button onClick={handleConfirmImport} disabled={importing} className="flex-1">
              {importing ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Importando...</>
              ) : (
                <><CheckCircle className="w-4 h-4" /> Confirmar importación ({valid} alumnos)</>
              )}
            </Button>
          )}
          <Button variant="outline" onClick={() => { setView("import"); setPreview(null) }}>
            Volver a subir
          </Button>
        </div>
      </div>
    )
  }

  // ── UPDATE GRADES VIEW ───────────────────────────────────────────────────────
  if (view === "update-grades") {
    return (
      <div className="p-8 max-w-2xl">
        <div className="flex items-center gap-3 mb-8">
          <Button variant="ghost" size="icon" onClick={() => setView("list")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Actualizar notas</h1>
            <p className="text-muted-foreground text-sm">
              Sube un Excel con <strong>id_alumno</strong> (o nombre+apellidos) y <strong>nota_media</strong>
            </p>
          </div>
        </div>
        <div
          className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
            dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
          }`}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => {
            e.preventDefault()
            setDragging(false)
            const file = e.dataTransfer.files[0]
            if (file) handleGradesFileUpload(file)
          }}
          onClick={() => document.getElementById("grades-file-input")?.click()}
        >
          {importing ? (
            <Loader2 className="w-10 h-10 mx-auto mb-3 animate-spin text-primary" />
          ) : (
            <RefreshCw className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
          )}
          <p className="font-medium mb-1">{importing ? "Procesando..." : "Arrastra tu Excel aquí"}</p>
          <p className="text-sm text-muted-foreground">o haz clic para seleccionar</p>
          <p className="text-xs text-muted-foreground mt-2">Solo columnas: id_alumno / nota_media</p>
          <input
            id="grades-file-input"
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={e => e.target.files?.[0] && handleGradesFileUpload(e.target.files[0])}
          />
        </div>
      </div>
    )
  }

  // ── UPDATE GRADES PREVIEW VIEW ───────────────────────────────────────────────
  if (view === "update-grades-preview" && gradesPreview) {
    return (
      <div className="p-8 max-w-2xl">
        <div className="flex items-center gap-3 mb-8">
          <Button variant="ghost" size="icon" onClick={() => { setView("update-grades"); setGradesPreview(null) }}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Confirmar actualización de notas</h1>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card><CardContent className="pt-4 pb-4">
            <p className="text-2xl font-bold">{gradesPreview.total}</p>
            <p className="text-xs text-muted-foreground">Filas en Excel</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-4">
            <p className="text-2xl font-bold text-green-600">{gradesPreview.matched}</p>
            <p className="text-xs text-muted-foreground">Se actualizarán</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-4">
            <p className="text-2xl font-bold text-yellow-600">{gradesPreview.unmatched}</p>
            <p className="text-xs text-muted-foreground">Sin coincidencia</p>
          </CardContent></Card>
        </div>
        {gradesPreview.unmatched_list.length > 0 && (
          <Card className="mb-4 border-yellow-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-yellow-700">
                <AlertTriangle className="w-4 h-4" /> Sin coincidencia (primeros {gradesPreview.unmatched_list.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {gradesPreview.unmatched_list.map((name, i) => (
                <p key={i} className="text-xs text-yellow-700">{name}</p>
              ))}
            </CardContent>
          </Card>
        )}
        {gradesPreview.preview.length > 0 && (
          <Card className="mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Vista previa (primeros {gradesPreview.preview.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead><tr className="border-b">
                  <th className="text-left py-1 text-muted-foreground">Alumno</th>
                  <th className="text-center py-1 text-muted-foreground">Nueva nota</th>
                  <th className="text-center py-1 text-muted-foreground">Nivel inferido</th>
                </tr></thead>
                <tbody>{gradesPreview.preview.map((p, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-1">{p.name}</td>
                    <td className="py-1 text-center font-medium">{p.grade.toFixed(1)}</td>
                    <td className="py-1 text-center text-muted-foreground">{p.level}</td>
                  </tr>
                ))}</tbody>
              </table>
            </CardContent>
          </Card>
        )}
        <div className="flex gap-3">
          {gradesPreview.matched > 0 && (
            <Button onClick={handleConfirmGradesUpdate} disabled={importing}>
              {importing ? <><Loader2 className="w-4 h-4 animate-spin" /> Actualizando...</> : (
                <><CheckCircle className="w-4 h-4" /> Actualizar {gradesPreview.matched} alumnos</>
              )}
            </Button>
          )}
          <Button variant="outline" onClick={() => { setView("update-grades"); setGradesPreview(null) }}>
            Volver
          </Button>
        </div>
      </div>
    )
  }

  // ── LIST VIEW ────────────────────────────────────────────────────────────────
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/processes/${id}`}><ArrowLeft className="w-4 h-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Alumnos</h1>
            <p className="text-muted-foreground text-sm">{students.length} alumnos en este proceso</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setLoadFromProfilesOpen(true)}>
            <Users className="w-4 h-4" />
            Desde Alumnado
          </Button>
          {students.length > 0 && (
            <Button variant="outline" onClick={() => setView("update-grades")}>
              <RefreshCw className="w-4 h-4" />
              Actualizar notas
            </Button>
          )}
          <Button onClick={() => setView("import")}>
            <Upload className="w-4 h-4" />
            Importar Excel
          </Button>
        </div>
      </div>

      <LoadFromProfilesDialog
        processId={id}
        open={loadFromProfilesOpen}
        onClose={() => setLoadFromProfilesOpen(false)}
        onImported={() => {
          fetch(`/api/processes/${id}/students`).then(r => r.json()).then(data => {
            setStudents(Array.isArray(data) ? data : [])
          })
        }}
      />

      {students.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium mb-1">No hay alumnos todavía</p>
          <p className="text-sm mb-6">Importa un Excel o carga desde el registro de Alumnado</p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => setLoadFromProfilesOpen(true)}>
              <Users className="w-4 h-4" />
              Desde Alumnado
            </Button>
            <Button onClick={() => setView("import")}>
              <Upload className="w-4 h-4" />
              Importar Excel
            </Button>
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="w-4 h-4" />
              Descargar plantilla
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar alumno o clase..."
                className="pl-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Alumno</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Clase</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Género</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nota</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nivel</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Conducta</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Necesidades</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredStudents.map(s => (
                  <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium">{s.first_name} {s.last_name}</p>
                      <p className="text-xs text-muted-foreground">{s.external_id}</p>
                    </td>
                    <td className="px-4 py-3"><Badge variant="outline">{s.current_class}</Badge></td>
                    <td className="px-4 py-3 text-muted-foreground">{s.gender}</td>
                    <td className="px-4 py-3 font-medium">{s.average_grade}</td>
                    <td className="px-4 py-3">
                      {s.academic_level && (
                        <Badge variant={LEVEL_COLORS[s.academic_level] ?? "secondary"} className="text-xs">
                          {s.academic_level}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {s.behavior_level && (
                        <Badge variant={BEHAVIOR_COLORS[s.behavior_level] ?? "secondary"} className="text-xs">
                          {s.behavior_level}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {s.needs_type ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredStudents.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No hay resultados para &quot;{search}&quot;
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
