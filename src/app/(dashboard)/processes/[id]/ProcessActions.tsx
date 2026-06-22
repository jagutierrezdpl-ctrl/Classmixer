"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { ChevronRight, Archive, Trash2, Copy, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useConfirm } from "@/components/ui/ConfirmDialog"

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
  const confirmFn = useConfirm()

  const transitions = TRANSITIONS[status] ?? []

  async function handleTransition(nextStatus: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/processes/${processId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "Error al actualizar estado")
      }
      const STATUS_LABELS: Record<string, string> = {
        cuestionario_abierto: "Cuestionario abierto",
        cuestionario_cerrado: "Cuestionario cerrado",
        en_analisis: "En análisis",
        propuestas_generadas: "Propuestas generadas",
        cerrado: "Proceso cerrado",
        archivado: "Proceso archivado",
      }
      toast.success(`Estado actualizado: ${STATUS_LABELS[nextStatus] ?? nextStatus}`)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al actualizar estado")
    } finally {
      setLoading(false)
    }
  }

  async function handleDuplicate() {
    setLoading(true)
    try {
      const res = await fetch(`/api/processes/${processId}/duplicate`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`Proceso duplicado: «${data.name}»`)
      router.push(`/processes/${data.id}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al duplicar")
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    const ok = await confirmFn({ title: "Eliminar proceso", description: "Se borrarán todos los alumnos, respuestas, reglas y propuestas. Esta acción no se puede deshacer.", confirmLabel: "Eliminar", variant: "destructive" })
    if (!ok) return
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

      {isAdmin && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDuplicate}
          disabled={loading}
          className="gap-1.5 text-muted-foreground"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
          Duplicar
        </Button>
      )}

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
