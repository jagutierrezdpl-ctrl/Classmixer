"use client"

import React from "react"
import { useState, use, useEffect } from "react"
import dynamic from "next/dynamic"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { questionnaireSettingsSchema, type QuestionnaireSettingsInput } from "@/schemas"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  ArrowLeft, Loader2, Link2, Copy,
  CheckCircle2, Clock, Users, QrCode, X, Download, Filter, Mail, RotateCcw,
  Square, CheckSquare, MinusSquare,
} from "lucide-react"
import Link from "next/link"
import ImportResponsesDialog from "@/components/questionnaire/ImportResponsesDialog"

const QRCodeSVG = dynamic<{ value: string; size?: number }>(
  () => import("qrcode.react").then(m => m.QRCodeSVG as React.ComponentType<{ value: string; size?: number }>),
  { ssr: false }
)

interface TokenInfo {
  token: string
  student_id: string
  used: boolean
  completed_at?: string
  students?: { first_name: string; last_name: string; current_class?: string }
  url: string
}

export default function QuestionnairePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const [savedSettings, setSavedSettings] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [tokens, setTokens] = useState<TokenInfo[]>([])
  const [, setLoadingTokens] = useState(false)
  const [qrToken, setQrToken] = useState<string | null>(null)
  const [showOnlyPending, setShowOnlyPending] = useState(false)
  const [sortAlpha, setSortAlpha] = useState(false)
  const [filterClass, setFilterClass] = useState<string | null>(null)
  const [sendingReminder, setSendingReminder] = useState(false)
  const [sendingReminderFor, setSendingReminderFor] = useState<string | null>(null)
  const [resettingId, setResettingId] = useState<string | null>(null)
  const [resettingAll, setResettingAll] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [sendingReminderToSelection, setSendingReminderToSelection] = useState(false)

  const { register, handleSubmit, watch, setValue, reset, formState: { isDirty } } =
    useForm<QuestionnaireSettingsInput>({
      resolver: zodResolver(questionnaireSettingsSchema),
      defaultValues: {
        friendship_enabled: true,
        friendship_min: 1,
        friendship_max: 5,
        work_enabled: false,
        work_min: 0,
        work_max: 3,
        emotional_enabled: false,
        emotional_min: 0,
        emotional_max: 3,
        negative_enabled: false,
        negative_max: 2,
        access_mode: "token",
      },
    })

  const watchFriendship = watch("friendship_enabled")
  const watchWork = watch("work_enabled")
  const watchEmotional = watch("emotional_enabled")
  const watchNegative = watch("negative_enabled")

  useEffect(() => {
    fetch(`/api/processes/${id}/questionnaire/settings`)
      .then(r => r.json())
      .then(data => { if (data) reset(data) })
    loadTokens()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function loadTokens() {
    setLoadingTokens(true)
    const res = await fetch(`/api/processes/${id}/questionnaire/generate`)
    if (res.ok) setTokens(await res.json())
    setLoadingTokens(false)
  }

  async function onSaveSettings(data: QuestionnaireSettingsInput) {
    const res = await fetch(`/api/processes/${id}/questionnaire/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      toast.success("Configuración guardada")
      setSavedSettings(true)
    } else {
      toast.error("Error al guardar")
    }
  }

  async function handleGenerate() {
    setGenerating(true)
    try {
      const res = await fetch(`/api/processes/${id}/questionnaire/generate`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`${data.generated} enlaces generados`)
      await loadTokens()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al generar")
    } finally {
      setGenerating(false)
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    toast.success("Copiado al portapapeles")
  }

  const completed = tokens.filter(t => t.used).length
  const pct = tokens.length > 0 ? Math.round((completed / tokens.length) * 100) : 0
  const pendingTokens = tokens.filter(t => !t.used)
  const availableClasses = [...new Set(tokens.map(t => t.students?.current_class).filter(Boolean))].sort() as string[]

  const visibleTokens = (() => {
    let list = showOnlyPending ? pendingTokens : tokens
    if (filterClass) list = list.filter(t => t.students?.current_class === filterClass)
    if (sortAlpha) list = [...list].sort((a, b) => {
      const la = `${a.students?.last_name ?? ""} ${a.students?.first_name ?? ""}`.toLowerCase()
      const lb = `${b.students?.last_name ?? ""} ${b.students?.first_name ?? ""}`.toLowerCase()
      return la.localeCompare(lb, "es")
    })
    return list
  })()

  function copyAllPending() {
    const text = pendingTokens
      .map(t => `${t.students?.first_name ?? ""} ${t.students?.last_name ?? ""}: ${t.url}`)
      .join("\n")
    navigator.clipboard.writeText(text)
    toast.success(`${pendingTokens.length} enlaces copiados`)
  }

  function exportPendingExcel() {
    const rows = [["Nombre", "Apellidos", "Enlace"]]
    for (const t of pendingTokens) {
      rows.push([t.students?.first_name ?? "", t.students?.last_name ?? "", t.url])
    }
    const csvContent = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n")
    const bom = "﻿"
    const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "pendientes_cuestionario.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  async function resetStudent(studentId: string, name: string) {
    if (!confirm(`¿Borrar las respuestas de ${name}? Podrá volver a responder el cuestionario.`)) return
    setResettingId(studentId)
    try {
      const res = await fetch(`/api/processes/${id}/questionnaire/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId }),
      })
      if (res.ok) {
        toast.success(`Respuestas de ${name} eliminadas`)
        await loadTokens()
      } else {
        toast.error("Error al reiniciar")
      }
    } finally {
      setResettingId(null)
    }
  }

  async function resetAll() {
    if (!confirm(`¿Borrar las respuestas de TODOS los alumnos? Esta acción no se puede deshacer.`)) return
    setResettingAll(true)
    try {
      const res = await fetch(`/api/processes/${id}/questionnaire/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Cuestionario reiniciado (${data.reset} alumnos)`)
        await loadTokens()
      } else {
        toast.error("Error al reiniciar")
      }
    } finally {
      setResettingAll(false)
    }
  }

  async function sendReminderToStudent(studentId: string, name: string) {
    setSendingReminderFor(studentId)
    try {
      const res = await fetch(`/api/processes/${id}/questionnaire/remind`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (data.sentIndividual > 0) {
        toast.success(`Email enviado a ${name}`)
      } else if (data.withoutEmail > 0) {
        toast.warning(`${name} no tiene email registrado`)
      } else {
        toast.info(data.reason ?? "No se pudo enviar")
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al enviar")
    } finally {
      setSendingReminderFor(null)
    }
  }

  async function sendReminder() {
    setSendingReminder(true)
    try {
      const res = await fetch(`/api/processes/${id}/questionnaire/remind`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (data.sent) {
        const parts = []
        if (data.sentIndividual > 0) parts.push(`${data.sentIndividual} emails a alumnos`)
        if (data.withoutEmail > 0) parts.push(`${data.withoutEmail} sin email`)
        if (data.adminEmailSent) parts.push("resumen enviado al admin")
        toast.success(`Recordatorio enviado — ${parts.join(" · ")}`)
      } else {
        toast.info(data.reason ?? "Email no configurado — revisa RESEND_API_KEY en entorno")
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al enviar recordatorio")
    } finally {
      setSendingReminder(false)
    }
  }

  function toggleSelect(studentId: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(studentId)) next.delete(studentId)
      else next.add(studentId)
      return next
    })
  }

  function toggleSelectAll() {
    const visibleStudentIds = visibleTokens.map(t => t.student_id)
    const allSelected = visibleStudentIds.every(sid => selectedIds.has(sid))
    if (allSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        visibleStudentIds.forEach(sid => next.delete(sid))
        return next
      })
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev)
        visibleStudentIds.forEach(sid => next.add(sid))
        return next
      })
    }
  }

  function copySelectedLinks() {
    const selected = visibleTokens.filter(t => selectedIds.has(t.student_id))
    const text = selected
      .map(t => `${t.students?.first_name ?? ""} ${t.students?.last_name ?? ""}: ${t.url}`)
      .join("\n")
    navigator.clipboard.writeText(text)
    toast.success(`${selected.length} enlaces copiados`)
  }

  function exportSelectedCSV() {
    const selected = tokens.filter(t => selectedIds.has(t.student_id))
    const rows = [["Nombre", "Apellidos", "Clase", "Estado", "Enlace"]]
    for (const t of selected) {
      rows.push([
        t.students?.first_name ?? "",
        t.students?.last_name ?? "",
        t.students?.current_class ?? "",
        t.used ? "Completado" : "Pendiente",
        t.url,
      ])
    }
    const csvContent = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n")
    const blob = new Blob(["﻿" + csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "seleccion_cuestionario.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  async function sendReminderToSelection() {
    const ids = [...selectedIds]
    setSendingReminderToSelection(true)
    try {
      const res = await fetch(`/api/processes/${id}/questionnaire/remind`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_ids: ids }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (data.sent) {
        const parts = []
        if (data.sentIndividual > 0) parts.push(`${data.sentIndividual} emails enviados`)
        if (data.withoutEmail > 0) parts.push(`${data.withoutEmail} sin email`)
        toast.success(parts.join(" · ") || "Recordatorio enviado")
      } else {
        toast.info(data.reason ?? "Sin pendientes en la selección")
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al enviar")
    } finally {
      setSendingReminderToSelection(false)
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/processes/${id}`}><ArrowLeft className="w-4 h-4" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Cuestionario sociométrico</h1>
          <p className="text-muted-foreground text-sm">Configura y lanza el cuestionario para el alumnado</p>
        </div>
        <ImportResponsesDialog processId={id} onImported={loadTokens} />
      </div>

      {/* Settings */}
      <form onSubmit={handleSubmit(onSaveSettings)} className="space-y-4 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preguntas</CardTitle>
            <CardDescription>Activa las preguntas que quieres incluir</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Friendship */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Switch
                    checked={watchFriendship}
                    onCheckedChange={v => setValue("friendship_enabled", v)}
                  />
                  <Label className="font-medium">Pregunta de amistad</Label>
                </div>
                <p className="text-xs text-muted-foreground pl-8">
                  &ldquo;¿Con quién te gustaría compartir clase?&rdquo;
                </p>
              </div>
              {watchFriendship && (
                <div className="flex items-center gap-2 text-sm shrink-0">
                  <Label className="text-muted-foreground">Min</Label>
                  <Input type="number" className="w-16 h-7 text-xs" {...register("friendship_min", { valueAsNumber: true })} />
                  <Label className="text-muted-foreground">Max</Label>
                  <Input type="number" className="w-16 h-7 text-xs" {...register("friendship_max", { valueAsNumber: true })} />
                </div>
              )}
            </div>

            {/* Work */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Switch
                    checked={watchWork}
                    onCheckedChange={v => setValue("work_enabled", v)}
                  />
                  <Label className="font-medium">Pregunta de trabajo</Label>
                </div>
                <p className="text-xs text-muted-foreground pl-8">
                  &ldquo;¿Con quién trabajas bien en clase?&rdquo;
                </p>
              </div>
              {watchWork && (
                <div className="flex items-center gap-2 text-sm shrink-0">
                  <Label className="text-muted-foreground">Min</Label>
                  <Input type="number" className="w-16 h-7 text-xs" {...register("work_min", { valueAsNumber: true })} />
                  <Label className="text-muted-foreground">Max</Label>
                  <Input type="number" className="w-16 h-7 text-xs" {...register("work_max", { valueAsNumber: true })} />
                </div>
              )}
            </div>

            {/* Emotional */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Switch
                    checked={watchEmotional}
                    onCheckedChange={v => setValue("emotional_enabled", v)}
                  />
                  <Label className="font-medium">Apoyo emocional</Label>
                </div>
                <p className="text-xs text-muted-foreground pl-8">
                  &ldquo;¿Con quién te sientes cómodo?&rdquo; — Solo visible para orientación
                </p>
              </div>
              {watchEmotional && (
                <div className="flex items-center gap-2 text-sm shrink-0">
                  <Label className="text-muted-foreground">Max</Label>
                  <Input type="number" className="w-16 h-7 text-xs" {...register("emotional_max", { valueAsNumber: true })} />
                </div>
              )}
            </div>

            {/* Negative */}
            <div className="flex items-start justify-between gap-4 pb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Switch
                    checked={watchNegative}
                    onCheckedChange={v => setValue("negative_enabled", v)}
                  />
                  <Label className="font-medium text-destructive">Pregunta negativa</Label>
                  <Badge variant="destructive" className="text-xs">Sensible</Badge>
                </div>
                <p className="text-xs text-muted-foreground pl-8">
                  &ldquo;¿Con quién te cuesta trabajar?&rdquo; — Solo visible para orientación/admin
                </p>
              </div>
              {watchNegative && (
                <div className="flex items-center gap-2 text-sm shrink-0">
                  <Label className="text-muted-foreground">Max</Label>
                  <Input type="number" className="w-16 h-7 text-xs" {...register("negative_max", { valueAsNumber: true })} />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Deadline + auto-close */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fecha límite</CardTitle>
            <CardDescription>Cierra automáticamente el cuestionario cuando pase la fecha</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="deadline">Fecha de cierre</Label>
              <Input id="deadline" type="datetime-local" {...register("deadline")} />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={!!watch("auto_close_questionnaire")}
                onCheckedChange={v => setValue("auto_close_questionnaire", v)}
              />
              <div>
                <Label className="font-medium">Cerrar automáticamente al llegar la fecha</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Si está activo, el cuestionario cambiará a &ldquo;cerrado&rdquo; automáticamente. Si no, solo es informativa.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" variant={isDirty ? "default" : "outline"}>
          {savedSettings && !isDirty ? (
            <><CheckCircle2 className="w-4 h-4" /> Configuración guardada</>
          ) : (
            "Guardar configuración"
          )}
        </Button>
      </form>

      {/* Generate tokens */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Generar enlaces</CardTitle>
          <CardDescription>Crea un enlace único para cada alumno</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleGenerate} disabled={generating} className="mb-4">
            {generating ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Generando...</>
            ) : (
              <><Link2 className="w-4 h-4" /> {tokens.length > 0 ? "Regenerar enlaces" : "Generar enlaces"}</>
            )}
          </Button>

          {tokens.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span>{completed}/{tokens.length} completados</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{pct}%</span>
                  <button
                    type="button"
                    onClick={resetAll}
                    disabled={resettingAll}
                    className="text-xs px-2 py-0.5 rounded-full border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-1 disabled:opacity-50"
                    title="Reiniciar todo el cuestionario"
                  >
                    {resettingAll ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                    Reiniciar todo
                  </button>
                </div>
              </div>
              <Progress value={pct} className="mb-3" />

              {/* Sort and filter controls */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setSortAlpha(v => !v)}
                  className={`text-xs px-2 py-0.5 rounded-full border transition-colors flex items-center gap-1 ${
                    sortAlpha
                      ? "bg-primary text-primary-foreground border-primary"
                      : "text-muted-foreground border-border hover:bg-muted/50"
                  }`}
                >
                  A→Z Apellidos
                </button>
                {availableClasses.map(cls => (
                  <button
                    key={cls}
                    type="button"
                    onClick={() => setFilterClass(filterClass === cls ? null : cls)}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                      filterClass === cls
                        ? "bg-primary text-primary-foreground border-primary"
                        : "text-muted-foreground border-border hover:bg-muted/50"
                    }`}
                  >
                    {cls}
                  </button>
                ))}
                {filterClass && (
                  <button
                    type="button"
                    onClick={() => setFilterClass(null)}
                    className="text-xs px-2 py-0.5 rounded-full border border-muted-foreground/30 text-muted-foreground hover:bg-muted/50 flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> Quitar filtro
                  </button>
                )}
              </div>

              {/* Pending controls */}
              {pendingTokens.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mb-3 p-2 bg-amber-50 rounded-lg border border-amber-200">
                  <span className="text-xs text-amber-800 font-medium flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {pendingTokens.length} sin responder
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowOnlyPending(v => !v)}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-colors flex items-center gap-1 ${
                      showOnlyPending
                        ? "bg-amber-600 text-white border-amber-600"
                        : "text-amber-700 border-amber-400 hover:bg-amber-100"
                    }`}
                  >
                    <Filter className="w-3 h-3" />
                    {showOnlyPending ? "Mostrar todos" : "Solo pendientes"}
                  </button>
                  <button
                    type="button"
                    onClick={copyAllPending}
                    className="text-xs px-2 py-0.5 rounded-full border text-amber-700 border-amber-400 hover:bg-amber-100 transition-colors flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    Copiar todos
                  </button>
                  <button
                    type="button"
                    onClick={exportPendingExcel}
                    className="text-xs px-2 py-0.5 rounded-full border text-amber-700 border-amber-400 hover:bg-amber-100 transition-colors flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    Exportar CSV
                  </button>
                  <button
                    type="button"
                    onClick={sendReminder}
                    disabled={sendingReminder}
                    className="text-xs px-2 py-0.5 rounded-full border text-amber-700 border-amber-400 hover:bg-amber-100 transition-colors flex items-center gap-1 disabled:opacity-50"
                  >
                    {sendingReminder ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                    Enviar recordatorio
                  </button>
                </div>
              )}

              {/* Select all toggle */}
              {visibleTokens.length > 0 && (() => {
                const visibleIds = visibleTokens.map(t => t.student_id)
                const allSelected = visibleIds.length > 0 && visibleIds.every(sid => selectedIds.has(sid))
                const someSelected = visibleIds.some(sid => selectedIds.has(sid))
                return (
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-1 mb-1 transition-colors"
                  >
                    {allSelected
                      ? <CheckSquare className="w-3.5 h-3.5 text-primary" />
                      : someSelected
                        ? <MinusSquare className="w-3.5 h-3.5 text-primary" />
                        : <Square className="w-3.5 h-3.5" />}
                    {allSelected ? "Deseleccionar todos" : "Seleccionar todos"}
                    {selectedIds.size > 0 && (
                      <span className="ml-1 text-primary font-medium">{selectedIds.size} seleccionados</span>
                    )}
                  </button>
                )
              })()}

              {/* Selection action bar */}
              {selectedIds.size > 0 && (
                <div className="flex flex-wrap items-center gap-2 mb-2 px-3 py-2 bg-primary/5 rounded-lg border border-primary/20">
                  <span className="text-xs font-medium text-primary">{selectedIds.size} alumno{selectedIds.size !== 1 ? "s" : ""}</span>
                  <button
                    type="button"
                    onClick={copySelectedLinks}
                    className="text-xs px-2 py-0.5 rounded-full border text-primary border-primary/40 hover:bg-primary/10 transition-colors flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" /> Copiar enlaces
                  </button>
                  <button
                    type="button"
                    onClick={sendReminderToSelection}
                    disabled={sendingReminderToSelection}
                    className="text-xs px-2 py-0.5 rounded-full border text-primary border-primary/40 hover:bg-primary/10 transition-colors flex items-center gap-1 disabled:opacity-50"
                  >
                    {sendingReminderToSelection ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                    Enviar email
                  </button>
                  <button
                    type="button"
                    onClick={exportSelectedCSV}
                    className="text-xs px-2 py-0.5 rounded-full border text-primary border-primary/40 hover:bg-primary/10 transition-colors flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" /> Exportar CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedIds(new Set())}
                    className="text-xs px-2 py-0.5 rounded-full border text-muted-foreground border-border hover:bg-muted/50 transition-colors flex items-center gap-1 ml-auto"
                  >
                    <X className="w-3 h-3" /> Limpiar
                  </button>
                </div>
              )}

              <div className="max-h-64 overflow-y-auto space-y-1">
                {visibleTokens.map(t => (
                  <div key={t.token}>
                    <div
                      className={`flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-muted/50 text-sm cursor-pointer ${selectedIds.has(t.student_id) ? "bg-primary/5 border border-primary/20" : ""}`}
                      onClick={() => toggleSelect(t.student_id)}
                    >
                      <div className="flex items-center gap-2">
                        <div className="shrink-0" onClick={e => { e.stopPropagation(); toggleSelect(t.student_id) }}>
                          {selectedIds.has(t.student_id)
                            ? <CheckSquare className="w-4 h-4 text-primary" />
                            : <Square className="w-4 h-4 text-muted-foreground/40" />}
                        </div>
                        {t.used ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                        ) : (
                          <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                        )}
                        <span>{t.students?.last_name}, {t.students?.first_name}</span>
                        {t.students?.current_class && (
                          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{t.students.current_class}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        {!t.used && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-muted-foreground hover:text-blue-600"
                            onClick={() => sendReminderToStudent(t.student_id, `${t.students?.first_name} ${t.students?.last_name}`)}
                            disabled={sendingReminderFor === t.student_id}
                            title="Enviar recordatorio por email"
                          >
                            {sendingReminderFor === t.student_id
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <Mail className="w-3 h-3" />}
                          </Button>
                        )}
                        {t.used && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-muted-foreground hover:text-destructive"
                            onClick={() => resetStudent(t.student_id, `${t.students?.first_name} ${t.students?.last_name}`)}
                            disabled={resettingId === t.student_id}
                            title="Reiniciar respuestas"
                          >
                            {resettingId === t.student_id
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <RotateCcw className="w-3 h-3" />}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => setQrToken(qrToken === t.token ? null : t.token)}
                          title="Ver QR"
                        >
                          {qrToken === t.token ? <X className="w-3 h-3" /> : <QrCode className="w-3 h-3" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => copyToClipboard(t.url)}
                          title="Copiar enlace"
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    {qrToken === t.token && (
                      <div className="mx-3 mb-2 p-3 bg-white border rounded-lg flex flex-col items-center gap-2">
                        <QRCodeSVG value={t.url} size={160} />
                        <p className="text-xs text-muted-foreground break-all text-center">{t.url}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
