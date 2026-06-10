"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { ArrowLeft, Plus, Building2, Pencil, Check, X } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface CenterRow {
  id: string
  name: string
  city?: string
  address?: string
  created_at: string
  user_count: number
  process_count: number
}

const PLAN_COLORS: Record<string, string> = {
  free: "bg-gray-100 text-gray-700",
  basic: "bg-blue-100 text-blue-700",
  pro: "bg-violet-100 text-violet-700",
  enterprise: "bg-amber-100 text-amber-700",
}

export default function AdminPage() {
  const [centers, setCenters] = useState<CenterRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: "", city: "", address: "" })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [licenses, setLicenses] = useState<Record<string, string>>({})
  const [editingLicense, setEditingLicense] = useState<string | null>(null)
  const [licensePlan, setLicensePlan] = useState("free")

  async function loadCenters() {
    const res = await fetch("/api/admin/centers")
    if (res.ok) {
      const data = await res.json()
      setCenters(data)
      // Fetch licenses for all centers
      const licMap: Record<string, string> = {}
      await Promise.all(data.map(async (c: CenterRow) => {
        const lr = await fetch(`/api/admin/licenses/${c.id}`)
        if (lr.ok) {
          const ld = await lr.json()
          licMap[c.id] = ld.plan ?? "free"
        } else {
          licMap[c.id] = "free"
        }
      }))
      setLicenses(licMap)
    }
    setLoading(false)
  }

  useEffect(() => { loadCenters() }, [])

  async function handleSaveLicense(centerId: string) {
    await fetch(`/api/admin/licenses/${centerId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: licensePlan }),
    })
    setLicenses(prev => ({ ...prev, [centerId]: licensePlan }))
    setEditingLicense(null)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError("")
    const res = await fetch("/api/admin/centers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name, city: form.city || undefined, address: form.address || undefined }),
    })
    if (res.ok) {
      setForm({ name: "", city: "", address: "" })
      setShowForm(false)
      loadCenters()
    } else {
      const data = await res.json()
      setError(data.error ?? "Error al crear el centro")
    }
    setSaving(false)
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`¿Eliminar el centro "${name}"? Esta acción no se puede deshacer y eliminará todos sus datos.`)) return
    await fetch(`/api/admin/centers/${id}`, { method: "DELETE" })
    loadCenters()
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Super Admin</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Gestión de centros educativos</p>
          </div>
        </div>
        <Button onClick={() => setShowForm(s => !s)}>
          <Plus className="w-4 h-4" />
          Nuevo centro
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <Card className="mb-6 border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Crear centro</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  placeholder="Nombre del centro *"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                />
                <Input
                  placeholder="Localidad"
                  value={form.city}
                  onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                />
                <Input
                  placeholder="Dirección"
                  value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={saving}>
                  {saving ? "Creando..." : "Crear centro"}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Centers list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Centros ({centers.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="text-center py-10 text-muted-foreground text-sm">Cargando...</p>
          ) : centers.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No hay centros registrados.</p>
            </div>
          ) : (
            <div className="divide-y">
              {centers.map(c => (
                <div key={c.id} className="flex items-center gap-4 px-4 py-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    {(c.city || c.address) && (
                      <p className="text-xs text-muted-foreground truncate">
                        {[c.address, c.city].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    <Badge variant="secondary" className="text-xs">
                      {c.user_count} usuario{c.user_count !== 1 ? "s" : ""}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {c.process_count} proceso{c.process_count !== 1 ? "s" : ""}
                    </Badge>
                    {/* License */}
                    {editingLicense === c.id ? (
                      <div className="flex items-center gap-1">
                        <Select value={licensePlan} onValueChange={setLicensePlan}>
                          <SelectTrigger className="h-7 w-28 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="free">Free</SelectItem>
                            <SelectItem value="basic">Basic</SelectItem>
                            <SelectItem value="pro">Pro</SelectItem>
                            <SelectItem value="enterprise">Enterprise</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleSaveLicense(c.id)}>
                          <Check className="w-3.5 h-3.5 text-green-600" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingLicense(null)}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${PLAN_COLORS[licenses[c.id] ?? "free"] ?? "bg-gray-100 text-gray-700"}`}
                        onClick={() => { setEditingLicense(c.id); setLicensePlan(licenses[c.id] ?? "free") }}
                        title="Cambiar licencia"
                      >
                        {(licenses[c.id] ?? "free").charAt(0).toUpperCase() + (licenses[c.id] ?? "free").slice(1)}
                        <Pencil className="w-2.5 h-2.5 opacity-60" />
                      </button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive text-xs"
                      onClick={() => handleDelete(c.id, c.name)}
                    >
                      Eliminar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
