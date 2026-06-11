"use client"

import { useState, use, useEffect, useRef } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Upload, Download, CheckCircle, XCircle, AlertTriangle,
  Users, Search, ArrowLeft, Loader2, FileSpreadsheet, RefreshCw, Trash2,
} from "lucide-react"
import Link from "next/link"
import type { ImportPreview, Student } from "@/types"
import LoadFromProfilesDialog from "@/components/students/LoadFromProfilesDialog"

// ── Color maps ────────────────────────────────────────────────────────────────

const BEHAVIOR_STYLES: Record<string, string> = {
  Positiva:    "bg-green-100 text-green-800 border-green-200 hover:bg-green-200",
  Normal:      "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200",
  Seguimiento: "bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200",
  Conflictiva: "bg-red-100 text-red-800 border-red-200 hover:bg-red-200",
}

const NEEDS_STYLES: Record<string, string> = {
  No:                    "bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200",
  Sí:                    "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200",
  ACNEAE:                "bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-200",
  NEE:                   "bg-pink-100 text-pink-800 border-pink-200 hover:bg-pink-200",
  Refuerzo:              "bg-cyan-100 text-cyan-800 border-cyan-200 hover:bg-cyan-200",
  "Altas capacidades":   "bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200",
  "Observación interna": "bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200",
}

const BEHAVIOR_OPTIONS = ["Positiva", "Normal", "Seguimiento", "Conflictiva"]
const NEEDS_OPTIONS = ["No", "Sí", "ACNEAE", "NEE", "Refuerzo", "Altas capacidades", "Observación interna"]

// ── Inline editable badge ─────────────────────────────────────────────────────

function EditableBadge({
  value,
  options,
  styles,
  emptyLabel,
  onSave,
}: {
  value: string | null
  options: string[]
  styles: Record<string, string>
  emptyLabel: string
  onSave: (v: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [open])

  async function handleSelect(v: string) {
    setSaving(true)
    setOpen(false)
    await onSave(v)
    setSaving(false)
  }

  const displayStyle = value ? (styles[value] ?? "bg-gray-100 text-gray-600 border-gray-200") : "bg-gray-50 text-gray-400 border-dashed border-gray-300 hover:bg-gray-100"

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={saving}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border cursor-pointer transition-colors select-none ${displayStyle}`}
        title="Clic para cambiar"
      >
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
        {value ?? emptyLabel}
        <span className="opacity-40 text-[10px]">▾</span>
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 py-1 bg-white rounded-lg shadow-lg border min-w-[140px]">
          {options.map(opt => (
            <button
              key={opt}
              onClick={() => handleSelect(opt)}
              className={`w-full text-left px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-2 ${
                opt === value ? "bg-primary/10 text-primary" : "hover:bg-muted/60"
              }`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                styles[opt]?.includes("green") ? "bg-green-500" :
                styles[opt]?.includes("amber") ? "bg-amber-500" :
                styles[opt]?.includes("red") ? "bg-red-500" :
                styles[opt]?.includes("blue") ? "bg-blue-500" :
                styles[opt]?.includes("purple") ? "bg-purple-500" :
                styles[opt]?.includes("pink") ? "bg-pink-500" :
                styles[opt]?.includes("cyan") ? "bg-cyan-500" :
                styles[opt]?.includes("emerald") ? "bg-emerald-500" :
                styles[opt]?.includes("orange") ? "bg-orange-500" :
                "bg-gray-400"
              }`} />
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function StudentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const [view, setView] = useState<"list" | "import" | "preview" | "update-grades" | "update-grades-preview">("list")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [gradesPreview, setGradesPreview] = useState<{
    total: number; matched: number; unmatched: number; unmatched_list: string[];
    preview: { name: string; grade: number; level: string }[];
    file?: File;
  } | null>(null)
  const [loadFromProfilesOpen, setLoadFromProfilesOpen] = useState(false)
  const [students, setStudents] = useState<Student[]>([])
  const [loadingStudents, setLoadingStudents] = useState(true)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [importing, setImporting] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [search, setSearch] = useState("")

  // Load students on mount
  useEffect(() => {
    fetch(`/api/processes/${id}/students`)
      .then(r => r.json())
      .then(data => {
        setStudents(Array.isArray(data) ? data : [])
        setLoadingStudents(false)
      })
      .catch(() => setLoadingStudents(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

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

  async function handleBulkDelete() {
    if (selected.size === 0) return
    if (!confirm(`¿Eliminar ${selected.size} alumno${selected.size > 1 ? "s" : ""} de este proceso? Esta acción no se puede deshacer.`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/processes/${id}/students`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_ids: [...selected] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`${data.deleted} alumnos eliminados`)
      setStudents(prev => prev.filter(s => !selected.has(s.id)))
      setSelected(new Set())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al eliminar")
    } finally {
      setDeleting(false)
    }
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === filteredStudents.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filteredStudents.map(s => s.id)))
    }
  }

  async function updateStudent(studentId: string, field: string, value: string) {
    const res = await fetch(`/api/processes/${id}/students/${studentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    })
    if (!res.ok) {
      toast.error("Error al guardar")
      return
    }
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, [field]: value } : s))
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

      {loadingStudents ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : students.length === 0 ? (
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
            {selected.size > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-destructive/10 border border-destructive/20">
                <span className="text-sm font-medium text-destructive">{selected.size} seleccionados</span>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7"
                  onClick={handleBulkDelete}
                  disabled={deleting}
                >
                  {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Eliminar
                </Button>
                <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setSelected(new Set())}>
                  Cancelar
                </button>
              </div>
            )}
          </div>

          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-3 py-3 w-8">
                    <input
                      type="checkbox"
                      className="rounded border-border"
                      checked={filteredStudents.length > 0 && selected.size === filteredStudents.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
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
                  <tr key={s.id} className={`hover:bg-muted/30 transition-colors ${selected.has(s.id) ? "bg-primary/5" : ""}`}>
                    <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="rounded border-border"
                        checked={selected.has(s.id)}
                        onChange={() => toggleSelect(s.id)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/processes/${id}/students/${s.id}`} className="block hover:underline">
                        <p className="font-medium">{s.first_name} {s.last_name}</p>
                        <p className="text-xs text-muted-foreground">{s.external_id}</p>
                      </Link>
                    </td>
                    <td className="px-4 py-3"><Badge variant="outline">{s.current_class}</Badge></td>
                    <td className="px-4 py-3 text-muted-foreground">{s.gender}</td>
                    <td className="px-4 py-3 font-medium">{s.average_grade}</td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <EditableBadge
                        value={s.academic_level ?? null}
                        options={["Alto", "Medio-alto", "Medio", "Medio-bajo", "Bajo"]}
                        styles={{
                          Alto:         "bg-green-100 text-green-800 border-green-200 hover:bg-green-200",
                          "Medio-alto": "bg-teal-100 text-teal-800 border-teal-200 hover:bg-teal-200",
                          Medio:        "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200",
                          "Medio-bajo": "bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200",
                          Bajo:         "bg-red-100 text-red-800 border-red-200 hover:bg-red-200",
                        }}
                        emptyLabel="Sin definir"
                        onSave={v => updateStudent(s.id, "academic_level", v)}
                      />
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <EditableBadge
                        value={s.behavior_level ?? null}
                        options={BEHAVIOR_OPTIONS}
                        styles={BEHAVIOR_STYLES}
                        emptyLabel="Sin definir"
                        onSave={v => updateStudent(s.id, "behavior_level", v)}
                      />
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <EditableBadge
                        value={s.needs_type ?? null}
                        options={NEEDS_OPTIONS}
                        styles={NEEDS_STYLES}
                        emptyLabel="Sin definir"
                        onSave={v => updateStudent(s.id, "needs_type", v)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredStudents.length === 0 && search && (
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
