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
  CheckCircle2, Clock, Users, QrCode, X, Download, Filter, Mail,
} from "lucide-react"
import Link from "next/link"

const QRCodeSVG = dynamic<{ value: string; size?: number }>(
  () => import("qrcode.react").then(m => m.QRCodeSVG as React.ComponentType<{ value: string; size?: number }>),
  { ssr: false }
)

interface TokenInfo {
  token: string
  student_id: string
  used: boolean
  completed_at?: string
  students?: { first_name: string; last_name: string }
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
  const [sendingReminder, setSendingReminder] = useState(false)

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
  const visibleTokens = showOnlyPending ? pendingTokens : tokens

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

  async function sendReminder() {
    setSendingReminder(true)
    try {
      const res = await fetch(`/api/processes/${id}/questionnaire/remind`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (data.sent) {
        toast.success(`Recordatorio enviado (${data.pending} alumnos pendientes)`)
      } else {
        toast.info(data.reason ?? "Email no configurado — revisa RESEND_API_KEY en entorno")
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al enviar recordatorio")
    } finally {
      setSendingReminder(false)
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/processes/${id}`}><ArrowLeft className="w-4 h-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Cuestionario sociométrico</h1>
          <p className="text-muted-foreground text-sm">Configura y lanza el cuestionario para el alumnado</p>
        </div>
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
                <span className="text-sm font-medium">{pct}%</span>
              </div>
              <Progress value={pct} className="mb-3" />

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

              <div className="max-h-64 overflow-y-auto space-y-1">
                {visibleTokens.map(t => (
                  <div key={t.token}>
                    <div className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-muted/50 text-sm">
                      <div className="flex items-center gap-2">
                        {t.used ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                        ) : (
                          <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                        )}
                        <span>{t.students?.first_name} {t.students?.last_name}</span>
                      </div>
                      <div className="flex items-center gap-1">
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
