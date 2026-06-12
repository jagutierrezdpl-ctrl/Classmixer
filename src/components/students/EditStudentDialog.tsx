"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Pencil, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

interface Props {
  processId: string
  studentId: string
  initial: {
    average_grade: number | null
    academic_level: string | null
    behavior_level: string | null
    needs_type: string | null
    observations: string | null
  }
}

const LEVELS    = ["Alto", "Medio-alto", "Medio", "Medio-bajo", "Bajo"]
const BEHAVIORS = ["Positiva", "Normal", "Seguimiento", "Conflictiva"]
const NEEDS     = ["No", "Sí", "ACNEAE", "NEE", "Refuerzo", "Altas capacidades", "Observación interna"]

function inferLevel(grade: number): string {
  if (grade >= 8.5) return "Alto"
  if (grade >= 7)   return "Medio-alto"
  if (grade >= 5.5) return "Medio"
  if (grade >= 4)   return "Medio-bajo"
  return "Bajo"
}

export default function EditStudentDialog({ processId, studentId, initial }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [grade, setGrade]    = useState(initial.average_grade?.toString() ?? "")
  const [level, setLevel]    = useState(initial.academic_level ?? "")
  const [behavior, setBehavior] = useState(initial.behavior_level ?? "")
  const [needs, setNeeds]    = useState(initial.needs_type ?? "")
  const [obs, setObs]        = useState(initial.observations ?? "")

  function handleGradeChange(val: string) {
    setGrade(val)
    const n = parseFloat(val)
    if (!isNaN(n) && n >= 0 && n <= 10) setLevel(inferLevel(n))
  }

  async function handleSave() {
    const gradeNum = parseFloat(grade)
    if (grade !== "" && (isNaN(gradeNum) || gradeNum < 0 || gradeNum > 10)) {
      toast.error("La nota debe ser un número entre 0 y 10")
      return
    }
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        academic_level: level || null,
        behavior_level: behavior || null,
        needs_type: needs || null,
        observations: obs || null,
      }
      if (grade !== "") body.average_grade = gradeNum

      const res = await fetch(`/api/processes/${processId}/students/${studentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? "Error al guardar")
      }
      toast.success("Datos actualizados")
      setOpen(false)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="w-4 h-4" />
        Editar datos
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar datos académicos</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="grade">Nota media (0–10)</Label>
                <Input
                  id="grade"
                  type="number"
                  min={0}
                  max={10}
                  step={0.1}
                  value={grade}
                  onChange={e => handleGradeChange(e.target.value)}
                  placeholder="Ej: 7.5"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Nivel académico</Label>
                <Select value={level} onValueChange={setLevel}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Conducta</Label>
                <Select value={behavior} onValueChange={setBehavior}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {BEHAVIORS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Nec. educativas</Label>
                <Select value={needs} onValueChange={setNeeds}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {NEEDS.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="obs">Observaciones</Label>
              <Textarea
                id="obs"
                rows={3}
                value={obs}
                onChange={e => setObs(e.target.value)}
                placeholder="Observaciones internas sobre el alumno..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
