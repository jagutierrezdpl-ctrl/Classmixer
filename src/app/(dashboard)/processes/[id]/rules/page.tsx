"use client"

import { use, useEffect, useState, useRef } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { createRuleSchema, type CreateRuleInput } from "@/schemas"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Plus, Trash2, Shield, Search, X, Loader2 } from "lucide-react"
import Link from "next/link"
import type { Rule, Student } from "@/types"

const RULE_LABELS: Record<string, string> = {
  must_separate: "Separar obligatoriamente",
  should_keep_together: "Mantener juntos (recomendado)",
  must_keep_together: "Mantener juntos (obligatorio)",
  keep_at_least_one: "Mantener al menos uno",
  max_from_group: "Máximo por clase",
  lock_student_to_class: "Fijar en clase concreta",
  exclude_student: "Excluir de la mezcla",
  protect_vulnerable: "Proteger alumno vulnerable",
  avoid_tutor: "Evitar tutor (alumno-tutor)",
}

type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning"

const PRIORITY_COLORS: Record<string, BadgeVariant> = {
  obligatoria: "destructive",
  alta: "warning",
  media: "secondary",
  baja: "outline",
}

export default function RulesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const [rules, setRules] = useState<Rule[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [centerUsers, setCenterUsers] = useState<{ id: string; name: string; email: string; role: string }[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedStudents, setSelectedStudents] = useState<Student[]>([])
  const [studentSearch, setStudentSearch] = useState("")
  const [studentDropdownOpen, setStudentDropdownOpen] = useState(false)
  const studentPickerRef = useRef<HTMLDivElement>(null)

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } =
    useForm<CreateRuleInput>({
      resolver: zodResolver(createRuleSchema),
      defaultValues: { priority: "media", rule_type: "must_separate", student_ids: [] },
    })

  const ruleType = watch("rule_type")

  useEffect(() => {
    setValue("student_ids", selectedStudents.map(s => s.id))
  }, [selectedStudents, setValue])

  useEffect(() => {
    if (!studentDropdownOpen) return
    function handle(e: MouseEvent) {
      if (studentPickerRef.current && !studentPickerRef.current.contains(e.target as Node)) {
        setStudentDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [studentDropdownOpen])

  useEffect(() => {
    loadRules()
    Promise.all([
      fetch(`/api/processes/${id}/students`).then(r => r.json()),
      fetch(`/api/users`).then(r => r.json()),
    ]).then(([studentsData, usersData]) => {
      setStudents(Array.isArray(studentsData) ? studentsData : [])
      setCenterUsers(Array.isArray(usersData) ? usersData : [])
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function loadRules() {
    const res = await fetch(`/api/processes/${id}/rules`)
    if (res.ok) setRules(await res.json())
  }

  async function onSubmit(data: CreateRuleInput) {
    setLoading(true)
    try {
      const body: Record<string, unknown> = { ...data, process_id: id, student_ids: selectedStudents.map(s => s.id) }
      if (data.rule_type === "avoid_tutor" && data.tutor_id) {
        body.metadata = { tutor_id: data.tutor_id }
      }
      const res = await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success("Regla creada")
      await loadRules()
      setOpen(false)
      reset()
      setSelectedStudents([])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al crear la regla")
    } finally {
      setLoading(false)
    }
  }

  async function toggleRule(ruleId: string, active: boolean) {
    await fetch(`/api/rules/${ruleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    })
    setRules(prev => prev.map(r => r.id === ruleId ? { ...r, active } : r))
  }

  async function deleteRule(ruleId: string) {
    if (!confirm("¿Eliminar esta regla?")) return
    await fetch(`/api/rules/${ruleId}`, { method: "DELETE" })
    setRules(prev => prev.filter(r => r.id !== ruleId))
    toast.success("Regla eliminada")
  }

  const filteredStudents = students.filter(s => {
    const q = studentSearch.toLowerCase()
    return !q || `${s.first_name} ${s.last_name}`.toLowerCase().includes(q)
  })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/processes/${id}`}><ArrowLeft className="w-4 h-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Reglas</h1>
            <p className="text-muted-foreground text-sm">{rules.length} reglas configuradas</p>
          </div>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4" />
          Nueva regla
        </Button>
      </div>

      {rules.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Shield className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium mb-1">No hay reglas todavía</p>
          <p className="text-sm mb-6">Las reglas definen restricciones entre alumnos para la mezcla</p>
          <Button onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4" />
            Crear primera regla
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map(rule => (
            <Card key={rule.id} className={!rule.active ? "opacity-50" : ""}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-sm">{RULE_LABELS[rule.rule_type] ?? rule.rule_type}</p>
                    <Badge variant={PRIORITY_COLORS[rule.priority] ?? "secondary"} className="text-xs">
                      {rule.priority}
                    </Badge>
                    {!rule.active && <Badge variant="outline" className="text-xs">Desactivada</Badge>}
                  </div>
                  {rule.description && (
                    <p className="text-xs text-muted-foreground">{rule.description}</p>
                  )}
                  {rule.students && rule.students.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {rule.students.map(rs => (
                        <Badge key={rs.id} variant="outline" className="text-xs">
                          {rs.student?.first_name} {rs.student?.last_name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  <Switch
                    checked={rule.active}
                    onCheckedChange={v => toggleRule(rule.id, v)}
                  />
                  <Button variant="ghost" size="icon" onClick={() => deleteRule(rule.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create rule dialog */}
      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) { reset(); setSelectedStudents([]); setStudentSearch(""); setStudentDropdownOpen(false) } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nueva regla</DialogTitle>
            <DialogDescription className="sr-only">Configura los parámetros de la nueva regla de mezcla</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Tipo de regla *</Label>
              <Select value={ruleType} onValueChange={v => setValue("rule_type", v as CreateRuleInput["rule_type"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(RULE_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Prioridad</Label>
                <Select defaultValue="media" onValueChange={v => setValue("priority", v as CreateRuleInput["priority"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="obligatoria">Obligatoria</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                    <SelectItem value="baja">Baja</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {ruleType === "lock_student_to_class" && (
                <div className="space-y-1.5">
                  <Label>Clase destino</Label>
                  <Input placeholder="Ej: 1A" {...register("target_class")} />
                </div>
              )}
              {ruleType === "max_from_group" && (
                <div className="space-y-1.5">
                  <Label>Máximo por clase</Label>
                  <Input type="number" min={1} {...register("max_count", { valueAsNumber: true })} />
                </div>
              )}
            </div>

            {ruleType === "avoid_tutor" && (
              <div className="space-y-1.5">
                <Label>Tutor que debe evitarse *</Label>
                <Select onValueChange={v => setValue("tutor_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar tutor..." /></SelectTrigger>
                  <SelectContent>
                    {centerUsers.map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} — {u.role === "tutor" ? "Tutor" : u.role === "orientador" ? "Orientador" : u.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Los alumnos seleccionados no deberían asignarse a este tutor</p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Motivo / Observación interna</Label>
              <Textarea placeholder="Motivo de la regla (solo visible para el equipo)" rows={2} {...register("description")} />
            </div>

            {/* Student picker */}
            <div className="space-y-2">
              <Label>Alumnos implicados *</Label>
              {errors.student_ids && (
                <p className="text-xs text-destructive">{errors.student_ids.message}</p>
              )}

              {/* Selected chips */}
              {selectedStudents.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selectedStudents.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedStudents(prev => prev.filter(x => x.id !== s.id))}
                      className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium border border-primary/20 hover:bg-primary/20"
                    >
                      {s.first_name} {s.last_name}
                      <span className="text-[10px] text-muted-foreground ml-0.5">{s.current_class}</span>
                      <X className="w-3 h-3 ml-0.5" />
                    </button>
                  ))}
                </div>
              )}

              {/* Combobox */}
              <div ref={studentPickerRef} className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder={students.length === 0 ? "Cargando alumnos..." : `Buscar entre ${students.length} alumnos...`}
                    className="pl-9"
                    value={studentSearch}
                    onChange={e => { setStudentSearch(e.target.value); setStudentDropdownOpen(true) }}
                    onFocus={() => setStudentDropdownOpen(true)}
                    autoComplete="off"
                  />
                </div>

                {studentDropdownOpen && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-52 overflow-y-auto">
                    {filteredStudents.length === 0 ? (
                      <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                        {students.length === 0
                          ? "No hay alumnos en este proceso"
                          : "No se encontraron alumnos con ese nombre"}
                      </div>
                    ) : (
                      <>
                        <div className="px-3 py-1.5 border-b bg-muted/30">
                          <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                            {filteredStudents.length} alumno{filteredStudents.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                        {filteredStudents.map(s => {
                          const isSelected = selectedStudents.some(x => x.id === s.id)
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                setSelectedStudents(prev =>
                                  isSelected ? prev.filter(x => x.id !== s.id) : [...prev, s]
                                )
                                setStudentSearch("")
                              }}
                              className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors border-b last:border-0 ${
                                isSelected ? "bg-primary/8 text-primary" : "hover:bg-muted/50"
                              }`}
                            >
                              <span className={isSelected ? "font-medium" : ""}>
                                {s.last_name}, {s.first_name}
                              </span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <Badge variant="outline" className="text-xs">{s.current_class}</Badge>
                                {isSelected && <span className="text-primary text-xs">✓</span>}
                              </div>
                            </button>
                          )
                        })}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Crear regla"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
