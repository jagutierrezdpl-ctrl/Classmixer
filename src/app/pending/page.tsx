"use client"

import { createClient } from "@/lib/supabase/client"
import { GraduationCap, Clock, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function PendingPage() {
  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = "/login"
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm text-center">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mb-3">
            <GraduationCap className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold">ClassMixer</h1>
        </div>

        <div className="rounded-xl border bg-card p-8 space-y-4 shadow-sm">
          <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center mx-auto">
            <Clock className="w-7 h-7 text-orange-600" />
          </div>
          <h2 className="text-lg font-semibold">Cuenta pendiente de activación</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Has iniciado sesión correctamente, pero tu cuenta todavía no ha sido
            configurada por el administrador de tu centro educativo.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Contacta con el director o coordinador TIC de tu centro para que
            te asignen el acceso correspondiente.
          </p>
          <Button
            variant="outline"
            className="w-full gap-2 mt-2"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </Button>
        </div>

        <p className="text-xs text-muted-foreground mt-6">
          Plataforma de uso exclusivo para personal autorizado del centro.
        </p>
      </div>
    </div>
  )
}
