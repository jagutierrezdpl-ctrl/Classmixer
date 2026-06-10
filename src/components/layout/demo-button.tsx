"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { FlaskConical, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button as Btn } from "@/components/ui/button"

type DemoState = "idle" | "loading" | "active"

export function DemoButton() {
  const router = useRouter()
  const [state, setState] = useState<DemoState>("idle")
  const [processId, setProcessId] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    fetch("/api/demo")
      .then(r => r.json())
      .then(d => {
        if (d.exists) {
          setState("active")
          setProcessId(d.processId)
        }
      })
      .catch(() => {})
  }, [])

  async function activate() {
    setState("loading")
    try {
      const res = await fetch("/api/demo", { method: "POST" })
      const data = await res.json()
      if (data.processId) {
        setState("active")
        setProcessId(data.processId)
        router.push(`/processes/${data.processId}`)
        router.refresh()
      } else {
        setState("idle")
      }
    } catch {
      setState("idle")
    }
  }

  async function deactivate() {
    setState("loading")
    setConfirmOpen(false)
    try {
      await fetch("/api/demo", { method: "DELETE" })
      setState("idle")
      setProcessId(null)
      router.push("/processes")
      router.refresh()
    } catch {
      setState("active")
    }
  }

  if (state === "loading") {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Cargando demo…</span>
      </div>
    )
  }

  if (state === "active") {
    return (
      <>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                role="button"
                tabIndex={0}
                onClick={() => { if (processId) router.push(`/processes/${processId}`) }}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { if (processId) router.push(`/processes/${processId}`) } }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors cursor-pointer select-none"
              >
                <FlaskConical className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1 text-left">Modo Demo</span>
                <button
                  onClick={e => { e.stopPropagation(); setConfirmOpen(true) }}
                  className="hover:text-red-600 rounded p-0.5 transition-colors"
                  aria-label="Desactivar demo"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Ver proceso demo · haz clic en ✕ para eliminar los datos</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>¿Eliminar datos de demo?</DialogTitle>
              <DialogDescription>
                Se borrarán el proceso demo y todos sus datos (alumnos, respuestas, sociograma, propuestas). Esta acción no se puede deshacer.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Btn variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Btn>
              <Btn
                variant="destructive"
                onClick={deactivate}
              >
                Eliminar demo
              </Btn>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={activate}
            className="w-full justify-start gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <FlaskConical className="h-4 w-4" />
            Cargar demo
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>Genera 30 alumnos de ejemplo con sociograma, reglas y propuestas listas</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
