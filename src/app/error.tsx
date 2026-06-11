"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { GraduationCap, RefreshCw } from "lucide-react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-center px-4">
      <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mb-6">
        <GraduationCap className="w-8 h-8 text-destructive" />
      </div>
      <h2 className="text-xl font-semibold mb-2">Algo ha ido mal</h2>
      <p className="text-muted-foreground text-sm mb-8 max-w-sm">
        Se ha producido un error inesperado. Puedes intentar recargar la página o volver al inicio.
      </p>
      <div className="flex gap-3">
        <Button onClick={reset} variant="outline">
          <RefreshCw className="w-4 h-4" />
          Reintentar
        </Button>
        <Button onClick={() => { window.location.href = "/dashboard" }}>
          Ir al dashboard
        </Button>
      </div>
      {error.digest && (
        <p className="mt-6 text-xs text-muted-foreground/50 font-mono">
          Error: {error.digest}
        </p>
      )}
    </div>
  )
}
