"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { KeyRound, Loader2, CheckCircle2 } from "lucide-react"

export default function ChangePasswordPage() {
  const [password, setPassword] = useState("")
  const [password2, setPassword2] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace("/login")
      else setChecking(false)
    })
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { setError("La contraseña debe tener al menos 8 caracteres"); return }
    if (password !== password2) { setError("Las contraseñas no coinciden"); return }

    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: { must_change_password: false },
    })
    setLoading(false)

    if (updateError) {
      setError(updateError.message)
    } else {
      setDone(true)
      setTimeout(() => router.replace("/dashboard"), 2000)
    }
  }

  if (checking) return null

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center pb-2">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <KeyRound className="w-6 h-6 text-primary" />
          </div>
          <CardTitle>Cambia tu contraseña</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Es tu primer acceso. Elige una contraseña personal para continuar.
          </p>
        </CardHeader>
        <CardContent>
          {done ? (
            <div className="text-center py-4">
              <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
              <p className="font-medium">Contraseña actualizada</p>
              <p className="text-sm text-muted-foreground mt-1">Redirigiendo al panel...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="pwd">Nueva contraseña</Label>
                <Input
                  id="pwd"
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pwd2">Confirmar contraseña</Label>
                <Input
                  id="pwd2"
                  type="password"
                  placeholder="Repite la contraseña"
                  value={password2}
                  onChange={e => setPassword2(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading || !password || !password2}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Guardar contraseña
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
