"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"

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
    <html lang="es">
      <body>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "1rem", fontFamily: "system-ui, sans-serif" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.5rem" }}>Error crítico</h2>
          <p style={{ color: "#666", fontSize: "0.875rem", marginBottom: "1.5rem", maxWidth: "24rem" }}>
            La aplicación ha encontrado un error crítico. Por favor, recarga la página.
          </p>
          <Button onClick={reset} variant="outline">
            <RefreshCw className="w-4 h-4" />
            Recargar
          </Button>
        </div>
      </body>
    </html>
  )
}
