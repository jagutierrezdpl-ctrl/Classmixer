"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Check, Loader2, Sparkles, Trash2, ImageIcon } from "lucide-react"

const OPENROUTER_MODELS = [
  { id: "anthropic/claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 — rápido, económico (por defecto)" },
  { id: "anthropic/claude-sonnet-4-6", label: "Claude Sonnet 4.6 — equilibrado, alta calidad" },
  { id: "anthropic/claude-opus-4-8", label: "Claude Opus 4.8 — máxima calidad" },
  { id: "openai/gpt-4o-mini", label: "GPT-4o Mini — rápido, económico" },
  { id: "openai/gpt-4o", label: "GPT-4o — alta calidad" },
  { id: "google/gemini-flash-1.5", label: "Gemini Flash 1.5 — muy rápido" },
  { id: "google/gemini-pro-1.5", label: "Gemini Pro 1.5 — alta calidad" },
  { id: "meta-llama/llama-3.3-70b-instruct", label: "LLaMA 3.3 70B — open source" },
  { id: "__custom__", label: "Otro modelo (escribe el ID manualmente)..." },
]

interface Center {
  id: string
  name: string
  address?: string | null
  city?: string | null
  country?: string | null
  openrouter_key_set?: boolean
  openrouter_model?: string | null
  logo_url?: string | null
}

export default function SettingsPage() {
  const [center, setCenter] = useState<Center | null>(null)
  const [form, setForm] = useState({ name: "", address: "", city: "", country: "" })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [openrouterKey, setOpenrouterKey] = useState("")
  const [savingAi, setSavingAi] = useState(false)
  const [savedAi, setSavedAi] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  // Model selector state
  const [selectedModel, setSelectedModel] = useState("")
  const [customModel, setCustomModel] = useState("")
  const [savingModel, setSavingModel] = useState(false)
  const [savedModel, setSavedModel] = useState(false)
  const [modelError, setModelError] = useState<string | null>(null)

  // Logo state
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoError, setLogoError] = useState<string | null>(null)
  const [logoSaved, setLogoSaved] = useState(false)

  useEffect(() => {
    fetch("/api/settings/center")
      .then(r => r.json())
      .then(data => {
        if (data.id) {
          setCenter(data)
          setForm({
            name: data.name ?? "",
            address: data.address ?? "",
            city: data.city ?? "",
            country: data.country ?? "",
          })
          // Initialise model selector from saved value
          if (data.openrouter_model) {
            const knownModel = OPENROUTER_MODELS.find(m => m.id === data.openrouter_model && m.id !== "__custom__")
            if (knownModel) {
              setSelectedModel(data.openrouter_model)
            } else {
              setSelectedModel("__custom__")
              setCustomModel(data.openrouter_model)
            }
          } else {
            setSelectedModel("")
          }
        }
      })
  }, [])

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoError(null)
    setLogoUploading(true)
    try {
      const fd = new FormData()
      fd.append("logo", file)
      const res = await fetch("/api/settings/center/logo", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) {
        setLogoError(data.error ?? "Error al subir el logo")
      } else {
        setCenter(c => c ? { ...c, logo_url: data.logo_url } : c)
        setLogoSaved(true)
        setTimeout(() => setLogoSaved(false), 2500)
      }
    } catch {
      setLogoError("Error de red al subir el logo")
    } finally {
      setLogoUploading(false)
      e.target.value = ""
    }
  }

  async function handleLogoDelete() {
    setLogoError(null)
    setLogoUploading(true)
    try {
      const res = await fetch("/api/settings/center/logo", { method: "DELETE" })
      if (res.ok) setCenter(c => c ? { ...c, logo_url: null } : c)
    } catch {
      setLogoError("Error al eliminar el logo")
    } finally {
      setLogoUploading(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || form.name.trim().length < 2) {
      setError("El nombre debe tener al menos 2 caracteres")
      return
    }
    setError(null)
    setSaving(true)
    try {
      const res = await fetch("/api/settings/center", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Error al guardar")
      } else {
        setCenter(data)
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      }
    } catch {
      setError("Error de red al guardar")
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveAiKey(newKey: string) {
    setAiError(null)
    setSavingAi(true)
    try {
      const res = await fetch("/api/settings/center", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openrouterApiKey: newKey }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAiError(data.error ?? "Error al guardar")
      } else {
        setCenter(data)
        setOpenrouterKey("")
        setSavedAi(true)
        setTimeout(() => setSavedAi(false), 2500)
      }
    } catch {
      setAiError("Error de red al guardar")
    } finally {
      setSavingAi(false)
    }
  }

  async function handleSaveModel() {
    const modelValue = selectedModel === "__custom__" ? customModel.trim() : selectedModel
    setModelError(null)
    setSavingModel(true)
    try {
      const res = await fetch("/api/settings/center", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openrouterModel: modelValue || null }),
      })
      const data = await res.json()
      if (!res.ok) {
        setModelError(data.error ?? "Error al guardar")
      } else {
        setCenter(data)
        setSavedModel(true)
        setTimeout(() => setSavedModel(false), 2500)
      }
    } catch {
      setModelError("Error de red al guardar")
    } finally {
      setSavingModel(false)
    }
  }

  return (
    <div className="p-8 max-w-xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-2xl font-bold">Configuración del centro</h1>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Datos del centro</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nombre del centro *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="IES / CEIP..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address">Dirección</Label>
              <Input
                id="address"
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                placeholder="Calle, número..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="city">Localidad</Label>
                <Input
                  id="city"
                  value={form.city}
                  onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                  placeholder="Ciudad"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="country">País</Label>
                <Input
                  id="country"
                  value={form.country}
                  onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
                  placeholder="España"
                />
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={saving || !center}>
                {saving
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Guardando...</>
                  : "Guardar cambios"}
              </Button>
              {saved && (
                <span className="text-sm text-green-600 flex items-center gap-1">
                  <Check className="w-4 h-4" /> Guardado
                </span>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ImageIcon className="w-4 h-4" />
            Logo del centro
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            El logo aparecerá en todos los informes PDF junto a la marca ClassMixer. Formatos: PNG, JPEG, WEBP o SVG (máx. 512 KB).
          </p>

          {center?.logo_url ? (
            <div className="flex items-center gap-3">
              <div className="relative w-24 h-16 border rounded bg-muted/20 flex items-center justify-center overflow-hidden">
                <Image src={center.logo_url} alt="Logo del centro" fill className="object-contain p-1" unoptimized />
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={logoUploading}
                  onClick={() => document.getElementById("logo-upload")?.click()}
                >
                  {logoUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Cambiar logo
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  disabled={logoUploading}
                  onClick={handleLogoDelete}
                >
                  <Trash2 className="w-4 h-4 mr-1.5" /> Quitar logo
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={logoUploading || !center}
              onClick={() => document.getElementById("logo-upload")?.click()}
            >
              {logoUploading
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Subiendo...</>
                : <><ImageIcon className="w-4 h-4 mr-2" />Subir logo</>}
            </Button>
          )}

          <input
            id="logo-upload"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={handleLogoUpload}
          />

          {logoError && <p className="text-sm text-destructive">{logoError}</p>}
          {logoSaved && (
            <span className="text-sm text-green-600 flex items-center gap-1">
              <Check className="w-4 h-4" /> Logo guardado
            </span>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Inteligencia artificial
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Los resúmenes explicativos del sociograma y de las propuestas usan una clave de{" "}
            <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" className="underline">OpenRouter</a> propia
            de este centro si la configuras aquí. Si no hay clave, se usa la IA por defecto de la plataforma (si está disponible).
          </p>

          {center?.openrouter_key_set ? (
            <div className="flex items-center justify-between rounded-md border px-3 py-2 bg-muted/40">
              <span className="text-sm flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                Clave de OpenRouter configurada
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={savingAi}
                onClick={() => handleSaveAiKey("")}
              >
                <Trash2 className="w-4 h-4 mr-1.5" />
                Quitar
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                type="password"
                placeholder="sk-or-v1-..."
                value={openrouterKey}
                onChange={e => setOpenrouterKey(e.target.value)}
              />
              <Button
                type="button"
                disabled={savingAi || !openrouterKey.trim()}
                onClick={() => handleSaveAiKey(openrouterKey)}
              >
                {savingAi ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
              </Button>
            </div>
          )}

          {aiError && <p className="text-sm text-destructive">{aiError}</p>}
          {savedAi && (
            <span className="text-sm text-green-600 flex items-center gap-1">
              <Check className="w-4 h-4" /> Guardado
            </span>
          )}

          <div className="border-t pt-3 space-y-2">
            <Label htmlFor="ai-model">Modelo de IA</Label>
            <p className="text-xs text-muted-foreground">
              Selecciona el modelo que usará OpenRouter para generar los análisis. Si no seleccionas ninguno se usa <code>claude-haiku-4-5</code> por defecto.
            </p>
            <select
              id="ai-model"
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">— Usar modelo por defecto —</option>
              {OPENROUTER_MODELS.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>

            {selectedModel === "__custom__" && (
              <Input
                placeholder="ej. mistralai/mistral-7b-instruct"
                value={customModel}
                onChange={e => setCustomModel(e.target.value)}
              />
            )}

            <div className="flex items-center gap-3 pt-1">
              <Button
                type="button"
                size="sm"
                disabled={savingModel || !center || (selectedModel === "__custom__" && !customModel.trim())}
                onClick={handleSaveModel}
              >
                {savingModel ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar modelo"}
              </Button>
              {savedModel && (
                <span className="text-sm text-green-600 flex items-center gap-1">
                  <Check className="w-4 h-4" /> Guardado
                </span>
              )}
              {center?.openrouter_model && (
                <span className="text-xs text-muted-foreground">
                  Actual: <code>{center.openrouter_model}</code>
                </span>
              )}
            </div>
            {modelError && <p className="text-sm text-destructive">{modelError}</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
