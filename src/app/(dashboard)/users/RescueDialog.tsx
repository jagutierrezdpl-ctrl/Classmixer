"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
import { ShieldCheck, Loader2, CheckCircle2 } from "lucide-react"
import { useRouter } from "next/navigation"

export default function RescueDialog() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ email: "", role: "tutor" })
  const router = useRouter()

  async function handleSubmit() {
    if (!form.email) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/users/rescue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setSuccess(data.name ?? form.email)
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setOpen(false)
    setSuccess(null)
    setError(null)
    setForm({ email: "", role: "tutor" })
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <ShieldCheck className="w-4 h-4 mr-2" /> Activar cuenta pendiente
      </Button>

      <Dialog open={open} onOpenChange={o => { if (!o) handleClose() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Activar cuenta pendiente</DialogTitle>
            <DialogDescription>
              Si un usuario entró por Google u otro método antes de recibir su invitación,
              su cuenta quedó pendiente. Introduce su email para asignarle acceso al centro.
            </DialogDescription>
          </DialogHeader>

          {success ? (
            <div className="py-6 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="font-semibold">Cuenta activada</p>
              <p className="text-sm text-muted-foreground mt-1">
                <strong>{success}</strong> ya puede acceder al centro. Puede que necesite cerrar sesión y volver a entrar.
              </p>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div>
                <Label>Email del usuario</Label>
                <Input
                  type="email"
                  placeholder="usuario@colegio.es"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div>
                <Label>Rol que se le asignará</Label>
                <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tutor">Tutor</SelectItem>
                    <SelectItem value="orientador">Orientador</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          )}

          <DialogFooter>
            {success ? (
              <Button onClick={handleClose}>Cerrar</Button>
            ) : (
              <>
                <Button variant="outline" onClick={handleClose}>Cancelar</Button>
                <Button onClick={handleSubmit} disabled={!form.email || loading}>
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Activar cuenta
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
