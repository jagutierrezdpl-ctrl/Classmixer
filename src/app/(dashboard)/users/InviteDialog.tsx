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
import { UserPlus, Loader2, CheckCircle2 } from "lucide-react"
import { useRouter } from "next/navigation"

export default function InviteDialog() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ name: "", email: "", role: "tutor" })
  const router = useRouter()

  async function handleInvite() {
    if (!form.name || !form.email) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setSuccess(form.email)
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
    setForm({ name: "", email: "", role: "tutor" })
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <UserPlus className="w-4 h-4 mr-2" />Invitar usuario
      </Button>

      <Dialog open={open} onOpenChange={open => { if (!open) handleClose() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invitar usuario al centro</DialogTitle>
            <DialogDescription>
              Se enviará un email de invitación. El usuario podrá acceder sin necesidad de registrarse.
            </DialogDescription>
          </DialogHeader>

          {success ? (
            <div className="py-6 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="font-semibold">Invitación enviada</p>
              <p className="text-sm text-muted-foreground mt-1">
                Se ha enviado un email a <strong>{success}</strong>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                El enlace expira en 24 horas
              </p>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div>
                <Label>Nombre completo</Label>
                <Input
                  placeholder="Ana García"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="ana.garcia@colegio.es"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div>
                <Label>Rol</Label>
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
                <Button onClick={handleInvite} disabled={!form.name || !form.email || loading}>
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Enviar invitación
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
