"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Download, Loader2, CheckCircle, AlertTriangle, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog"

interface SourceProcess {
  id: string
  name: string
  school_year: string
  source_level: string
  status: string
}

interface Preview {
  source_name: string
  total_source_students: number
  matched_students: number
  unmatched_students: number
  total_responses: number
  importable_responses: number
  sample_matched: string[]
}

interface Props {
  processId: string
  onImported: () => void
}

type Step = "select" | "preview" | "done"

export default function ImportResponsesDialog({ processId, onImported }: Props) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>("select")
  const [loading, setLoading] = useState(false)
  const [sources, setSources] = useState<SourceProcess[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)

  useEffect(() => {
    if (!open) return
    setStep("select")
    setSelectedId(null)
    setPreview(null)
    setLoading(true)
    fetch(`/api/processes/${processId}/questionnaire/import-responses`)
      .then(r => r.json())
      .then(data => setSources(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))
  }, [open, processId])

  async function handlePreview() {
    if (!selectedId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/processes/${processId}/questionnaire/import-responses?action=preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceProcessId: selectedId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPreview(data)
      setStep("preview")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al previsualizar")
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm() {
    if (!selectedId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/processes/${processId}/questionnaire/import-responses?action=confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceProcessId: selectedId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`${data.imported} respuestas importadas de ${data.matched_students} alumnos`)
      setOpen(false)
      onImported()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al importar")
    } finally {
      setLoading(false)
    }
  }

  const matchPct = preview ? Math.round((preview.matched_students / preview.total_source_students) * 100) : 0

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Download className="w-4 h-4" />
        Importar respuestas de otro proceso
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Importar respuestas de sociograma</DialogTitle>
            <DialogDescription>
              Copia las relaciones de un proceso anterior para evitar repetir el cuestionario.
            </DialogDescription>
          </DialogHeader>

          {/* Step 1 — select source */}
          {step === "select" && (
            <div className="space-y-3 py-2">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : sources.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <AlertTriangle className="w-8 h-8 mx-auto mb-3 opacity-40" />
                  No hay otros procesos con respuestas en este centro.
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">Selecciona el proceso del que quieres copiar las respuestas:</p>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {sources.map(s => (
                      <button
                        key={s.id}
                        onClick={() => setSelectedId(s.id)}
                        className={`w-full text-left rounded-lg border px-4 py-3 transition-colors ${
                          selectedId === s.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/40 hover:bg-muted/40"
                        }`}
                      >
                        <p className="text-sm font-medium">{s.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {s.source_level} · {s.school_year}
                        </p>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 2 — preview */}
          {step === "preview" && preview && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <p className="text-sm font-semibold">Origen: {preview.source_name}</p>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-white border p-3 text-center">
                    <p className={`text-2xl font-bold ${matchPct >= 80 ? "text-green-600" : matchPct >= 50 ? "text-amber-600" : "text-red-600"}`}>
                      {preview.matched_students}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Alumnos coincidentes</p>
                    <p className="text-xs font-medium mt-0.5">{matchPct}% del origen</p>
                  </div>
                  <div className="rounded-lg bg-white border p-3 text-center">
                    <p className="text-2xl font-bold text-indigo-600">{preview.importable_responses}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Respuestas a importar</p>
                    <p className="text-xs font-medium mt-0.5">de {preview.total_responses} totales</p>
                  </div>
                </div>

                {preview.unmatched_students > 0 && (
                  <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg p-2.5 border border-amber-200">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{preview.unmatched_students} alumnos del proceso origen no se encontraron en este proceso. Sus respuestas no se importarán.</span>
                  </div>
                )}

                {preview.sample_matched.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium">Ejemplos coincidentes: </span>
                    {preview.sample_matched.join(", ")}
                    {preview.matched_students > preview.sample_matched.length && ` y ${preview.matched_students - preview.sample_matched.length} más`}
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                Las respuestas actuales de este proceso se reemplazarán completamente.
              </div>
            </div>
          )}

          <DialogFooter>
            {step === "select" && (
              <>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={handlePreview} disabled={!selectedId || loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Ver previsualización <ChevronRight className="w-4 h-4" /></>}
                </Button>
              </>
            )}
            {step === "preview" && (
              <>
                <Button variant="outline" onClick={() => setStep("select")}>Volver</Button>
                <Button onClick={handleConfirm} disabled={loading || (preview?.importable_responses ?? 0) === 0}>
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Importando...</>
                    : <><CheckCircle className="w-4 h-4" /> Confirmar importación</>
                  }
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
