"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { ArrowLeft, Check, Loader2, Sparkles, Trash2 } from "lucide-react"

interface Center {
  id: string
  name: string
  address?: string | null
  city?: string | null
  country?: string | null
  openrouter_key_set?: boolean
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
        }
      })
  }, [])

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
        body: JSON.stringify({ ...form, openrouterApiKey: newKey }),
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
        </CardContent>
      </Card>
    </div>
  )
}
