"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import {
  ArrowLeft, Plus, Building2, Pencil, Check, X, CheckCircle2,
  Users, FolderOpen, GraduationCap, Zap, BookOpen, BarChart3,
  ChevronRight, Loader2,
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface GlobalStats {
  total_centers: number
  total_users: number
  total_students: number
  total_processes: number
  active_processes: number
  open_questionnaires: number
  pending_tokens: number
  approved_proposals: number
}

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

function StatCard({ icon: Icon, label, value, color = "text-primary" }: {
  icon: React.ElementType
  label: string
  value: number | null
  color?: string
}) {
  return (
    <Card>
      <CardContent className="py-4 px-5 flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0`}>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
        <div>
          <p className="text-2xl font-bold leading-tight">
            {value === null ? <Loader2 className="w-5 h-5 animate-spin" /> : value.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

export default function AdminPage() {
  const [stats, setStats] = useState<GlobalStats | null>(null)
  const [centers, setCenters] = useState<CenterRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: "", city: "", address: "", admin_name: "", admin_email: "" })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [successEmail, setSuccessEmail] = useState("")
  const [licenses, setLicenses] = useState<Record<string, string>>({})
  const [editingLicense, setEditingLicense] = useState<string | null>(null)
  const [licensePlan, setLicensePlan] = useState("free")
  const [search, setSearch] = useState("")

  async function loadData() {
    setLoading(true)
    const [statsRes, centersRes] = await Promise.all([
      fetch("/api/admin/stats"),
      fetch("/api/admin/centers"),
    ])
    if (statsRes.ok) setStats(await statsRes.json())
    if (centersRes.ok) {
      const data = await centersRes.json()
      setCenters(data)
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

  useEffect(() => { loadData() }, [])

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
    setSuccessEmail("")
    const res = await fetch("/api/admin/centers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        city: form.city || undefined,
        address: form.address || undefined,
        admin_name: form.admin_name,
        admin_email: form.admin_email,
      }),
    })
    const data = await res.json()
    if (res.ok) {
      setSuccessEmail(form.admin_email)
      setForm({ name: "", city: "", address: "", admin_name: "", admin_email: "" })
      setShowForm(false)
      loadData()
    } else {
      setError(typeof data.error === "string" ? data.error : "Error al crear el centro")
    }
    setSaving(false)
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`¿Eliminar el centro "${name}"? Esta acción no se puede deshacer y eliminará todos sus datos.`)) return
    await fetch(`/api/admin/centers/${id}`, { method: "DELETE" })
    loadData()
  }

  const filteredCenters = centers.filter(c => {
    const q = search.toLowerCase()
    return !q || c.name.toLowerCase().includes(q) || c.city?.toLowerCase().includes(q)
  })

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Super Admin</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Panel de gestión global de ClassMixer</p>
          </div>
        </div>
        <Button onClick={() => setShowForm(s => !s)}>
          <Plus className="w-4 h-4" />
          Nuevo centro
        </Button>
      </div>

      {/* Global stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Building2} label="Centros" value={stats?.total_centers ?? null} color="text-blue-600" />
        <StatCard icon={Users} label="Usuarios" value={stats?.total_users ?? null} color="text-indigo-600" />
        <StatCard icon={GraduationCap} label="Alumnos activos" value={stats?.total_students ?? null} color="text-emerald-600" />
        <StatCard icon={FolderOpen} label="Procesos activos" value={stats?.active_processes ?? null} color="text-amber-600" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard icon={BookOpen} label="Cuestionarios abiertos" value={stats?.open_questionnaires ?? null} color="text-pink-600" />
        <StatCard icon={BarChart3} label="Respuestas pendientes" value={stats?.pending_tokens ?? null} color="text-orange-600" />
        <StatCard icon={Zap} label="Propuestas aprobadas" value={stats?.approved_proposals ?? null} color="text-violet-600" />
        <StatCard icon={FolderOpen} label="Procesos totales" value={stats?.total_processes ?? null} color="text-slate-600" />
      </div>

      {/* Success banner */}
      {successEmail && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
          <div className="text-sm text-green-800">
            Centro creado. Invitación enviada a <strong>{successEmail}</strong>.
          </div>
          <button className="ml-auto text-green-600 hover:text-green-800" onClick={() => setSuccessEmail("")}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <Card className="mb-6 border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Crear centro educativo</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Datos del centro</p>
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
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Administrador del centro</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    placeholder="Nombre completo *"
                    value={form.admin_name}
                    onChange={e => setForm(f => ({ ...f, admin_name: e.target.value }))}
                    required
                  />
                  <Input
                    type="email"
                    placeholder="Email del administrador *"
                    value={form.admin_email}
                    onChange={e => setForm(f => ({ ...f, admin_email: e.target.value }))}
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Se enviará un email de invitación para que active su cuenta.
                </p>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={saving || !form.name || !form.admin_name || !form.admin_email}>
                  {saving ? "Creando..." : "Crear centro e invitar admin"}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setShowForm(false); setError("") }}>
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
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-base">Centros ({centers.length})</CardTitle>
            <div className="relative w-64">
              <Input
                placeholder="Buscar centro..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredCenters.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{search ? "Sin resultados" : "No hay centros registrados."}</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredCenters.map(c => (
                <div key={c.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
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
                        <button onClick={() => handleSaveLicense(c.id)} className="text-green-600 hover:text-green-700">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditingLicense(null)} className="text-muted-foreground hover:text-foreground">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingLicense(c.id); setLicensePlan(licenses[c.id] ?? "free") }}
                        className={`px-2 py-0.5 rounded text-xs font-medium ${PLAN_COLORS[licenses[c.id] ?? "free"]} hover:opacity-80 transition-opacity flex items-center gap-1`}
                      >
                        {licenses[c.id] ?? "free"}
                        <Pencil className="w-2.5 h-2.5" />
                      </button>
                    )}
                    {/* Actions */}
                    <Link href={`/admin/centers/${c.id}`}>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                        Ver detalle
                        <ChevronRight className="w-3 h-3" />
                      </Button>
                    </Link>
                    <button
                      onClick={() => handleDelete(c.id, c.name)}
                      className="text-destructive/60 hover:text-destructive transition-colors ml-1"
                      title="Eliminar centro"
                    >
                      <X className="w-4 h-4" />
                    </button>
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
