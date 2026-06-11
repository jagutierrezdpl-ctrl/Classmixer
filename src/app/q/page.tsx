"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { GraduationCap, Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function StudentLoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tokenInput, setTokenInput] = useState("")

  const urlError = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("error")
    : null

  async function handleGoogleLogin() {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/student-callback`,
        queryParams: {
          hd: "leon.anamogas.org",
          prompt: "select_account",
        },
      },
    })
    if (error) {
      setError("No se pudo iniciar sesión. Inténtalo de nuevo.")
      setLoading(false)
    }
  }

  function handleTokenAccess(e: React.FormEvent) {
    e.preventDefault()
    const t = tokenInput.trim()
    if (t) window.location.href = `/q/${t}`
  }

  const errorMessages: Record<string, string> = {
    not_registered: "Tu cuenta no está registrada en ningún proceso activo. Habla con tu tutor.",
    no_questionnaire: "No tienes cuestionarios pendientes en este momento.",
    domain_not_allowed: "Debes acceder con tu cuenta del colegio (@leon.anamogas.org).",
    auth_failed: "Error al iniciar sesión. Inténtalo de nuevo.",
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Cuestionario escolar</h1>
          <p className="text-gray-500 mt-1 text-sm">Accede con tu cuenta del colegio</p>
        </div>

        {/* Error from redirect */}
        {(error ?? urlError) && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm mb-4">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error ?? errorMessages[urlError ?? ""] ?? "Error desconocido."}</span>
          </div>
        )}

        {/* Google login */}
        <div className="bg-white rounded-2xl shadow-sm border p-6 mb-4">
          <Button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full h-12 text-base gap-3"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            {loading ? "Conectando..." : "Entrar con Google del colegio"}
          </Button>
          <p className="text-center text-xs text-gray-400 mt-3">
            Usa tu cuenta <strong>@leon.anamogas.org</strong>
          </p>
        </div>

        {/* Token fallback */}
        <details className="bg-white rounded-2xl shadow-sm border p-5">
          <summary className="text-sm font-medium text-gray-600 cursor-pointer select-none">
            ¿Tienes un código de acceso?
          </summary>
          <form onSubmit={handleTokenAccess} className="mt-4 space-y-3">
            <div>
              <Label htmlFor="token" className="text-xs text-gray-500">Código o enlace</Label>
              <Input
                id="token"
                value={tokenInput}
                onChange={e => setTokenInput(e.target.value)}
                placeholder="Pega aquí tu código"
                className="mt-1"
              />
            </div>
            <Button type="submit" variant="outline" className="w-full" disabled={!tokenInput.trim()}>
              Acceder con código
            </Button>
          </form>
        </details>

      </div>
    </div>
  )
}
