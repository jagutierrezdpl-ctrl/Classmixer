"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { ArrowLeft, Check } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { z } from "zod"

const centerSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  address: z.string().optional(),
  city: z.string().optional(),
})

interface Center {
  id: string
  name: string
  address?: string
  city?: string
  country?: string
}

export default function SettingsPage() {
  const [center, setCenter] = useState<Center | null>(null)
  const [form, setForm] = useState({ name: "", address: "", city: "" })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from("users").select("center_id").eq("id", user.id).single()
      if (!profile) return
      const { data: centerData } = await supabase
        .from("centers").select("*").eq("id", profile.center_id).single()
      if (centerData) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const c = centerData as any
        setCenter(c)
        setForm({
          name: c.name ?? "",
          address: c.address ?? "",
          city: c.city ?? "",
        })
      }
    }
    load()
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!center) return
    const parsed = centerSchema.safeParse(form)
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {}
      for (const [field, msgs] of Object.entries(parsed.error.flatten().fieldErrors)) {
        fieldErrors[field] = (msgs as string[])[0] ?? ""
      }
      setErrors(fieldErrors)
      return
    }
    setErrors({})
    setSaving(true)
    const supabase = createClient()
    await supabase
      .from("centers")
      .update({ name: parsed.data.name, address: parsed.data.address || null, city: parsed.data.city || null })
      .eq("id", center.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
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
              <Label htmlFor="name">Nombre del centro</Label>
              <Input
                id="name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="IES / CEIP..."
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
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
            <div className="space-y-1.5">
              <Label htmlFor="city">Localidad</Label>
              <Input
                id="city"
                value={form.city}
                onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                placeholder="Ciudad"
              />
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando..." : "Guardar cambios"}
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
    </div>
  )
}
