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
import { UserPlus, Loader2, CheckCircle2, Mail, KeyRound } from "lucide-react"
import { useRouter } from "next/navigation"

type Mode = "invite" | "create"

export default function InviteDialog() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>("create")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ name: "", email: "", role: "tutor", password: "", password2: "" })
  const router = useRouter()

  async function handleSubmit() {
    if (!form.name || !form.email) return
    if (mode === "create") {
      if (!form.password) { setError("Introduce una contraseña provisional"); return }
      if (form.password.length < 8) { setError("La contraseña debe tener al menos 8 caracteres"); return }
      if (form.password !== form.password2) { setError("Las contraseñas no coinciden"); return }
    }

    setLoading(true)
    setError(null)
    try {
      const url = mode === "invite" ? "/api/users/invite" : "/api/users/create"
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email, role: form.role, password: form.password }),
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
    setForm({ name: "", email: "", role: "tutor", password: "", password2: "" })
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <UserPlus className="w-4 h-4 mr-2" />Añadir usuario
      </Button>

      <Dialog open={open} onOpenChange={o => { if (!o) handleClose() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Añadir usuario al centro</DialogTitle>
            <DialogDescription>
              {mode === "invite"
                ? "Se enviará un email de invitación al usuario."
                : "El usuario accede con la contraseña provisional y la cambia en su primer acceso."}
            </DialogDescription>
          </DialogHeader>

          {success ? (
            <div className="py-6 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="font-semibold">
                {mode === "invite" ? "Invitación enviada" : "Usuario creado"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {mode === "invite"
                  ? <>Se ha enviado un email a <strong>{success}</strong></>
                  : <>El usuario <strong>{success}</strong> ya puede acceder</>}
              </p>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {/* Mode toggle */}
              <div className="flex rounded-lg border p-1 gap-1">
                <button
                  type="button"
                  onClick={() => { setMode("create"); setError(null) }}
                  className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    mode === "create" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  Contraseña provisional
                </button>
                <button
                  type="button"
                  onClick={() => { setMode("invite"); setError(null) }}
                  className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    mode === "invite" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  Invitar por email
                </button>
              </div>

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

              {mode === "create" && (
                <>
                  <div>
                    <Label>Contraseña provisional</Label>
                    <Input
                      type="password"
                      placeholder="Mínimo 8 caracteres"
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Confirmar contraseña</Label>
                    <Input
                      type="password"
                      placeholder="Repite la contraseña"
                      value={form.password2}
                      onChange={e => setForm(f => ({ ...f, password2: e.target.value }))}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    El usuario deberá cambiar la contraseña la primera vez que acceda.
                  </p>
                </>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          )}

          <DialogFooter>
            {success ? (
              <Button onClick={handleClose}>Cerrar</Button>
            ) : (
              <>
                <Button variant="outline" onClick={handleClose}>Cancelar</Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!form.name || !form.email || loading}
                >
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {mode === "invite" ? "Enviar invitación" : "Crear usuario"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
