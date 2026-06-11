"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, User, Lock, CheckCircle2, Eye, EyeOff } from "lucide-react"

export default function ProfilePage() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("")
  const [loading, setLoading] = useState(true)
  const [savingName, setSavingName] = useState(false)
  const [nameOk, setNameOk] = useState(false)
  const [nameError, setNameError] = useState("")

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordOk, setPasswordOk] = useState(false)
  const [passwordError, setPasswordError] = useState("")
  const [showPasswords, setShowPasswords] = useState(false)

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/auth/me")
      const data = await res.json()
      setName(data.name ?? "")
      setEmail(data.email ?? "")
      setRole(data.role ?? "")
      setLoading(false)
    }
    load()
  }, [])

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault()
    setSavingName(true)
    setNameError("")
    setNameOk(false)
    const res = await fetch("/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
    const data = await res.json()
    if (data.error) { setNameError(data.error) } else { setNameOk(true); setTimeout(() => setNameOk(false), 3000) }
    setSavingName(false)
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError("")
    setPasswordOk(false)
    if (newPassword !== confirmPassword) { setPasswordError("Las contraseñas no coinciden"); return }
    if (newPassword.length < 8) { setPasswordError("Mínimo 8 caracteres"); return }
    setSavingPassword(true)
    // Re-authenticate then update password
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: currentPassword })
    if (signInError) { setPasswordError("Contraseña actual incorrecta"); setSavingPassword(false); return }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) { setPasswordError(error.message) } else {
      setPasswordOk(true)
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setTimeout(() => setPasswordOk(false), 3000)
    }
    setSavingPassword(false)
  }

  const ROLE_LABELS: Record<string, string> = {
    superadmin: "Superadministrador",
    admin: "Administrador de centro",
    tutor: "Tutor/a",
    orientador: "Orientador/a",
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />Cargando...
      </div>
    )
  }

  return (
    <div className="p-8 max-w-xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Mi perfil</h1>
        <p className="text-muted-foreground text-sm mt-1">{email} · {ROLE_LABELS[role] ?? role}</p>
      </div>

      {/* Name */}
      <Card className="mb-6">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4" />Datos personales
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveName} className="space-y-4">
            <div>
              <Label>Nombre completo</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre" />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={email} disabled className="bg-muted/50 text-muted-foreground" />
              <p className="text-xs text-muted-foreground mt-1">El email no se puede cambiar desde aquí</p>
            </div>
            {nameError && <p className="text-sm text-destructive">{nameError}</p>}
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={savingName || !name}>
                {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar cambios"}
              </Button>
              {nameOk && <CheckCircle2 className="w-5 h-5 text-green-600" />}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="w-4 h-4" />Cambiar contraseña
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <Label>Contraseña actual</Label>
              <div className="relative">
                <Input
                  type={showPasswords ? "text" : "password"}
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••"
                />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPasswords(v => !v)}>
                  {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label>Nueva contraseña</Label>
              <Input type={showPasswords ? "text" : "password"} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 8 caracteres" autoComplete="new-password" />
            </div>
            <div>
              <Label>Confirmar nueva contraseña</Label>
              <Input type={showPasswords ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repite la contraseña" autoComplete="new-password" />
            </div>
            {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}>
                {savingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : "Cambiar contraseña"}
              </Button>
              {passwordOk && <CheckCircle2 className="w-5 h-5 text-green-600" />}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
