"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { GraduationCap, Loader2, CheckCircle2, AlertTriangle } from "lucide-react"

interface Group {
  name: string
  count: number
  female: number
  male: number
  with_needs: number
}

interface Props {
  processId: string
  open: boolean
  onClose: () => void
  onImported: () => void
}

export default function LoadFromProfilesDialog({ processId, open, onClose, onImported }: Props) {
  const [groups, setGroups] = useState<Group[]>([])
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ added: number; skipped: number; message?: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoadingGroups(true)
    fetch("/api/student-profiles/groups")
      .then(r => r.json())
      .then(d => setGroups(Array.isArray(d) ? d : []))
      .finally(() => setLoadingGroups(false))
  }, [open])

  function toggle(name: string) {
    setSelected(s => {
      const next = new Set(s)
      if (next.has(name)) { next.delete(name) } else { next.add(name) }
      return next
    })
  }

  async function handleLoad() {
    if (selected.size === 0) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/processes/${processId}/load-from-profiles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groups: Array.from(selected) }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setResult(data)
        if (data.added > 0) onImported()
      }
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setSelected(new Set())
    setResult(null)
    setError(null)
    onClose()
  }

  const totalSelected = groups
    .filter(g => selected.has(g.name))
    .reduce((sum, g) => sum + g.count, 0)

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5" />
            Cargar desde Alumnado
          </DialogTitle>
          <DialogDescription>
            Selecciona los grupos del registro central para añadirlos a este proceso.
            Los alumnos ya presentes se omitirán automáticamente.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="py-4 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="font-semibold text-lg">{result.added} alumnos añadidos</p>
            {result.skipped > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                {result.skipped} omitidos (ya estaban en el proceso)
              </p>
            )}
            {result.message && (
              <p className="text-sm text-muted-foreground mt-1">{result.message}</p>
            )}
          </div>
        ) : (
          <div className="py-2">
            {loadingGroups ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />Cargando grupos...
              </div>
            ) : groups.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No hay grupos en el registro de alumnado.</p>
                <p className="text-xs mt-1">Importa alumnos en la sección Alumnado primero.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {groups.map(g => (
                  <button
                    key={g.name}
                    type="button"
                    onClick={() => toggle(g.name)}
                    className={`w-full text-left rounded-lg border px-4 py-3 transition-colors ${
                      selected.has(g.name)
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{g.name}</p>
                        <div className="flex gap-2 text-xs text-muted-foreground mt-0.5">
                          <span>{g.count} alumnos</span>
                          {g.female > 0 && <span className="text-pink-600">{g.female}F</span>}
                          {g.male > 0 && <span className="text-blue-600">{g.male}M</span>}
                          {g.with_needs > 0 && (
                            <span className="text-amber-600 flex items-center gap-0.5">
                              <AlertTriangle className="w-3 h-3" />{g.with_needs}
                            </span>
                          )}
                        </div>
                      </div>
                      {selected.has(g.name) && (
                        <Badge className="bg-primary/10 text-primary border-0 text-xs">✓</Badge>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {selected.size > 0 && (
              <p className="text-sm text-muted-foreground mt-3 text-center">
                {selected.size} grupo{selected.size !== 1 ? "s" : ""} seleccionado{selected.size !== 1 ? "s" : ""} · ~{totalSelected} alumnos
              </p>
            )}

            {error && <p className="text-sm text-destructive mt-2">{error}</p>}
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button onClick={handleClose}>Cerrar</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button onClick={handleLoad} disabled={selected.size === 0 || loading || loadingGroups}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Añadir {totalSelected > 0 ? `${totalSelected} alumnos` : ""}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
