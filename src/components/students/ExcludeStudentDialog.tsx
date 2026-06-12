"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { AlertTriangle, Loader2, UserX, UserCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

interface AffectedStudent {
  id: string
  first_name: string
  last_name: string
  current_class?: string
}

interface ExcludeInfo {
  student: { id: string; first_name: string; last_name: string }
  excluded_from_mix: boolean
  excluded_reason: string | null
  affected_count: number
  affected_students: AffectedStudent[]
}

interface Props {
  processId: string
  studentId: string
  studentName: string
  currentlyExcluded: boolean
  onChanged: (excluded: boolean) => void
}

export default function ExcludeStudentDialog({
  processId,
  studentId,
  studentName,
  currentlyExcluded,
  onChanged,
}: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [info, setInfo] = useState<ExcludeInfo | null>(null)
  const [reason, setReason] = useState("")

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch(`/api/processes/${processId}/students/${studentId}/exclude`)
      .then(r => r.json())
      .then(data => {
        setInfo(data)
        setReason(data.excluded_reason ?? "")
      })
      .finally(() => setLoading(false))
  }, [open, processId, studentId])

  async function handleConfirm() {
    setSaving(true)
    try {
      const res = await fetch(`/api/processes/${processId}/students/${studentId}/exclude`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exclude: !currentlyExcluded, reason: reason || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(
        currentlyExcluded
          ? `${studentName} reincorporado al proceso`
          : `${studentName} excluido del proceso`
      )
      onChanged(!currentlyExcluded)
      setOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al actualizar")
    } finally {
      setSaving(false)
    }
  }

  const isExcluding = !currentlyExcluded

  return (
    <>
      <Button
        variant={currentlyExcluded ? "outline" : "ghost"}
        size="sm"
        onClick={() => setOpen(true)}
        className={currentlyExcluded
          ? "text-green-700 border-green-300 hover:bg-green-50"
          : "text-muted-foreground hover:text-destructive"
        }
      >
        {currentlyExcluded
          ? <><UserCheck className="w-4 h-4" /> Reincorporar</>
          : <><UserX className="w-4 h-4" /> Dar de baja</>
        }
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isExcluding
                ? <><UserX className="w-5 h-5 text-destructive" /> Dar de baja a {studentName}</>
                : <><UserCheck className="w-5 h-5 text-green-600" /> Reincorporar a {studentName}</>
              }
            </DialogTitle>
            <DialogDescription>
              {isExcluding
                ? "Este alumno no se incluirá en propuestas de mezcla ni en el sociograma. Sus datos y respuestas se conservan."
                : "El alumno volverá a aparecer en el sociograma y en las propuestas de mezcla."
              }
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {/* Affected students warning */}
              {isExcluding && info && info.affected_count > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                  <div className="flex items-start gap-2 text-sm text-amber-800">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      <strong>{info.affected_count} alumno{info.affected_count !== 1 ? "s" : ""}</strong> eligieron a {studentName} en el cuestionario.
                      Al excluirlo, quedarán sin ese vínculo.
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 pl-6">
                    {info.affected_students.slice(0, 8).map(s => (
                      <Badge key={s.id} variant="outline" className="text-xs bg-white">
                        {s.first_name} {s.last_name}
                        {s.current_class && <span className="text-muted-foreground ml-1">({s.current_class})</span>}
                      </Badge>
                    ))}
                    {info.affected_count > 8 && (
                      <Badge variant="outline" className="text-xs bg-white text-muted-foreground">
                        +{info.affected_count - 8} más
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {isExcluding && info && info.affected_count === 0 && (
                <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                  Ningún alumno eligió a {studentName} en el cuestionario.
                </div>
              )}

              {/* Reason field (only when excluding) */}
              {isExcluding && (
                <div className="space-y-1.5">
                  <Label htmlFor="reason">Motivo <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                  <Input
                    id="reason"
                    placeholder="Ej: traslado de centro, baja médica…"
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                  />
                </div>
              )}

              {/* Current exclusion reason when re-including */}
              {!isExcluding && info?.excluded_reason && (
                <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                  <span className="text-muted-foreground">Motivo de baja: </span>
                  {info.excluded_reason}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleConfirm}
              disabled={saving || loading}
              variant={isExcluding ? "destructive" : "default"}
            >
              {saving
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
                : isExcluding
                  ? <><UserX className="w-4 h-4" /> Confirmar baja</>
                  : <><UserCheck className="w-4 h-4" /> Reincorporar</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
