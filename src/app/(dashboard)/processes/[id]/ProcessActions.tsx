"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { ChevronRight, Archive, Trash2 } from "lucide-react"

interface Transition {
  label: string
  nextStatus: string
  variant?: "default" | "outline" | "ghost" | "destructive"
}

const TRANSITIONS: Record<string, Transition[]> = {
  borrador: [
    { label: "Abrir cuestionario", nextStatus: "cuestionario_abierto" },
  ],
  cuestionario_abierto: [
    { label: "Cerrar cuestionario", nextStatus: "cuestionario_cerrado", variant: "outline" },
  ],
  cuestionario_cerrado: [
    { label: "Iniciar análisis", nextStatus: "en_analisis" },
  ],
  en_analisis: [],
  propuestas_generadas: [],
  propuesta_seleccionada: [
    { label: "Cerrar proceso", nextStatus: "cerrado", variant: "outline" },
  ],
  cerrado: [
    { label: "Archivar", nextStatus: "archivado", variant: "ghost" },
  ],
  archivado: [],
}

interface ProcessActionsProps {
  processId: string
  status: string
  isAdmin: boolean
}

export default function ProcessActions({ processId, status, isAdmin }: ProcessActionsProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const transitions = TRANSITIONS[status] ?? []

  async function handleTransition(nextStatus: string) {
    setLoading(true)
    await fetch(`/api/processes/${processId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    })
    setLoading(false)
    router.refresh()
  }

  async function handleDelete() {
    if (!confirm("¿Eliminar este proceso? Se borrarán todos los alumnos, respuestas, reglas y propuestas. Esta acción no se puede deshacer.")) return
    setLoading(true)
    const res = await fetch(`/api/processes/${processId}`, { method: "DELETE" })
    setLoading(false)
    if (res.ok) router.push("/processes")
  }

  if (!isAdmin && transitions.length === 0) return null

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {transitions.map(t => (
        <Button
          key={t.nextStatus}
          variant={t.variant ?? "default"}
          size="sm"
          onClick={() => handleTransition(t.nextStatus)}
          disabled={loading}
          className="gap-1.5"
        >
          {t.label}
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      ))}

      {isAdmin && status !== "archivado" && transitions.every(t => t.nextStatus !== "archivado") && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleTransition("archivado")}
          disabled={loading}
          className="gap-1.5 text-muted-foreground"
        >
          <Archive className="w-3.5 h-3.5" />
          Archivar
        </Button>
      )}

      {isAdmin && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          disabled={loading}
          className="gap-1.5 text-destructive hover:text-destructive"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Eliminar
        </Button>
      )}
    </div>
  )
}
