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
import { ArrowLeft, Plus, Trash2, Shield, Search, X, Loader2, Pencil, Sparkles, CheckCircle2, XCircle, AlertTriangle, Users, ShieldAlert } from "lucide-react"
import Link from "next/link"
import type { Rule, Student } from "@/types"
import type { ProposedRule } from "@/app/api/processes/[id]/sociogram/proposed-rules/route"
import { useConfirm } from "@/components/ui/ConfirmDialog"

const RULE_LABELS: Record<string, string> = {
  must_separate: "Separar obligatoriamente",
  should_keep_together: "Mantener juntos (recomendado)",
  must_keep_together: "Mantener juntos (obligatorio)",
  keep_at_least_one: "Mantener al menos uno",
  max_from_group: "Máximo por clase",
  lock_student_to_class: "Fijar en clase concreta",
  with_tutor: "Asignar con tutor concreto",
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

  const confirmFn = useConfirm()
  const [rules, setRules] = useState<Rule[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [centerUsers, setCenterUsers] = useState<{ id: string; name: string; email: string; role: string }[]>([])
  const [open, setOpen] = useState(false)
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // AI proposals state
  const [aiOpen, setAiOpen] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [proposals, setProposals] = useState<ProposedRule[]>([])
  const [dismissed, setDismissed] = useState<Set<number>>(new Set())
  const [applying, setApplying] = useState<Set<number>>(new Set())
  const [applied, setApplied] = useState<Set<number>>(new Set())
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

  function openCreate() {
    setEditingRuleId(null)
    reset({ priority: "media", rule_type: "must_separate", student_ids: [] })
    setSelectedStudents([])
    setStudentSearch("")
    setOpen(true)
  }

  function openEdit(rule: Rule) {
    setEditingRuleId(rule.id)
    reset({
      rule_type: rule.rule_type,
      priority: rule.priority,
      description: rule.description ?? "",
      target_class: rule.target_class ?? "",
      max_count: rule.max_count ?? undefined,
      student_ids: (rule.students ?? []).map(rs => rs.student_id),
    })
    // Pre-populate selected students from the rule's student list
    const preSelected: Student[] = []
    for (const rs of rule.students ?? []) {
      if (rs.student) {
        preSelected.push({
          id: rs.student_id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          first_name: (rs.student as any).first_name,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          last_name: (rs.student as any).last_name,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          current_class: (rs.student as any).current_class,
        } as Student)
      }
    }
    setSelectedStudents(preSelected)
    setStudentSearch("")
    setOpen(true)
  }

  function closeDialog() {
    setOpen(false)
    setEditingRuleId(null)
    reset()
    setSelectedStudents([])
    setStudentSearch("")
    setStudentDropdownOpen(false)
  }

  async function onSubmit(data: CreateRuleInput) {
    setLoading(true)
    try {
      const studentIds = selectedStudents.map(s => s.id)

      if (editingRuleId) {
        // Edit existing rule
        const body: Record<string, unknown> = {
          ...data,
          student_ids: studentIds,
        }
        if (data.rule_type === "avoid_tutor" && data.tutor_id) {
          body.metadata = { tutor_id: data.tutor_id }
        }
        const res = await fetch(`/api/rules/${editingRuleId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        if (!res.ok) throw new Error((await res.json()).error)
        toast.success("Regla actualizada")
      } else {
        // Create new rule
        const body: Record<string, unknown> = { ...data, process_id: id, student_ids: studentIds }
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
      }

      await loadRules()
      closeDialog()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar la regla")
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
    const ok = await confirmFn({ title: "Eliminar regla", description: "¿Eliminar esta regla?", confirmLabel: "Eliminar", variant: "destructive" })
    if (!ok) return
    await fetch(`/api/rules/${ruleId}`, { method: "DELETE" })
    setRules(prev => prev.filter(r => r.id !== ruleId))
    toast.success("Regla eliminada")
  }

  async function deleteAllRules() {
    const ok = await confirmFn({
      title: "Eliminar todas las reglas",
      description: `Se eliminarán las ${rules.length} reglas configuradas. Esta acción no se puede deshacer.`,
      confirmLabel: "Eliminar todas",
      variant: "destructive",
    })
    if (!ok) return
    const res = await fetch(`/api/processes/${id}/rules`, { method: "DELETE" })
    if (!res.ok) { toast.error("Error al eliminar las reglas"); return }
    setRules([])
    toast.success("Todas las reglas eliminadas")
  }

  async function resetAndRegenerate() {
    const ok = await confirmFn({
      title: "Limpiar y regenerar reglas",
      description: `Se eliminarán las ${rules.length} reglas actuales y se generarán nuevas sugerencias con los datos actuales del sociograma.`,
      confirmLabel: "Limpiar y regenerar",
      variant: "destructive",
    })
    if (!ok) return
    const res = await fetch(`/api/processes/${id}/rules`, { method: "DELETE" })
    if (!res.ok) { toast.error("Error al eliminar las reglas"); return }
    setRules([])
    await loadAiSuggestions()
  }

  async function loadAiSuggestions() {
    setAiLoading(true)
    setProposals([])
    setDismissed(new Set())
    setApplied(new Set())
    try {
      const res = await fetch(`/api/processes/${id}/sociogram/proposed-rules`)
      if (!res.ok) throw new Error((await res.json()).error ?? "Error al cargar sugerencias")
      setProposals(await res.json())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al cargar sugerencias")
    } finally {
      setAiLoading(false)
    }
  }

  async function openAiSuggestions() {
    setAiOpen(true)
    if (proposals.length > 0) return // already loaded; user can force refresh via button
    await loadAiSuggestions()
  }

  async function applyProposal(index: number) {
    const p = proposals[index]
    setApplying(prev => new Set([...prev, index]))
    try {
      const body: Record<string, unknown> = {
        rule_type: p.rule_type,
        priority: p.priority,
        description: p.description,
        student_ids: p.student_ids,
        process_id: id,
        ...(p.max_count != null ? { max_count: p.max_count } : {}),
      }
      const res = await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setApplied(prev => new Set([...prev, index]))
      await loadRules()
      toast.success("Regla creada")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al crear la regla")
    } finally {
      setApplying(prev => { const s = new Set(prev); s.delete(index); return s })
    }
  }

  async function applyAllProposals() {
    const pending = proposals
      .map((_, i) => i)
      .filter(i => !dismissed.has(i) && !applied.has(i))
    for (const i of pending) await applyProposal(i)
  }

  const filteredStudents = students.filter(s => {
    const q = studentSearch.toLowerCase()
    return !q || `${s.first_name} ${s.last_name}`.toLowerCase().includes(q)
  })

  const isEditing = !!editingRuleId

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
        <div className="flex items-center gap-2">
          {rules.length > 0 && (
            <Button variant="outline" className="text-destructive hover:text-destructive" onClick={deleteAllRules}>
              <Trash2 className="w-4 h-4" />
              Eliminar todas
            </Button>
          )}
          <Button variant="outline" onClick={openAiSuggestions}>
            <Sparkles className="w-4 h-4" />
            Aplicar reglas del análisis
          </Button>
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4" />
            Nueva regla
          </Button>
        </div>
      </div>

      {rules.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Shield className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium mb-1">No hay reglas todavía</p>
          <p className="text-sm mb-6">Las reglas definen restricciones entre alumnos para la mezcla</p>
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4" />
            Crear primera regla
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map(rule => (
            <Card key={rule.id} className={!rule.active ? "opacity-50" : ""}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="font-medium text-sm">{RULE_LABELS[rule.rule_type] ?? rule.rule_type}</p>
                    <Badge variant={PRIORITY_COLORS[rule.priority] ?? "secondary"} className="text-xs">
                      {rule.priority}
                    </Badge>
                    {!rule.active && <Badge variant="outline" className="text-xs">Desactivada</Badge>}
                    {rule.target_class && (
                      <Badge variant="outline" className="text-xs font-mono">{rule.target_class}</Badge>
                    )}
                    {rule.max_count != null && (
                      <Badge variant="outline" className="text-xs">Máx. {rule.max_count}</Badge>
                    )}
                  </div>
                  {rule.description && (
                    <p className="text-xs text-muted-foreground">{rule.description}</p>
                  )}
                  {rule.students && rule.students.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {rule.students.map(rs => (
                        <Badge key={rs.id} variant="outline" className="text-xs">
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          {(rs.student as any)?.first_name} {(rs.student as any)?.last_name}
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          {(rs.student as any)?.current_class && (
                            <span className="text-muted-foreground ml-1">
                              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                              ({(rs.student as any).current_class})
                            </span>
                          )}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 ml-4 shrink-0">
                  <Switch
                    checked={rule.active}
                    onCheckedChange={v => toggleRule(rule.id, v)}
                  />
                  <Button variant="ghost" size="icon" onClick={() => openEdit(rule)}>
                    <Pencil className="w-4 h-4 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteRule(rule.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── AI proposals dialog ── */}
      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-500" />
              Reglas sugeridas por el análisis sociométrico
            </DialogTitle>
            <DialogDescription>
              Generadas automáticamente a partir del sociograma. Revisa cada una y aplica las que consideres oportunas.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 py-1">
            {aiLoading ? (
              <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
                Analizando el sociograma…
              </div>
            ) : proposals.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No hay sugerencias disponibles</p>
                <p className="text-sm mt-1">El sociograma no detecta situaciones que requieran reglas específicas, o el cuestionario aún no tiene respuestas suficientes.</p>
              </div>
            ) : (
              <div className="space-y-2 pr-1">
                {proposals.map((p, i) => {
                  const isDone = applied.has(i)
                  const isDismissed = dismissed.has(i)
                  const isApplying = applying.has(i)
                  if (isDismissed) return null

                  const icon = p.reason_type === "bullying_risk" || p.reason_type === "active_rejection"
                    ? <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    : p.reason_type === "isolated_anchor" || p.reason_type === "vulnerable_anchor"
                    ? <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    : p.reason_type === "bridge_protected"
                    ? <ShieldAlert className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                    : <Users className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />

                  const priorityColor: Record<string, string> = {
                    obligatoria: "bg-red-100 text-red-800",
                    alta: "bg-orange-100 text-orange-800",
                    media: "bg-yellow-100 text-yellow-800",
                    baja: "bg-slate-100 text-slate-600",
                  }

                  return (
                    <div
                      key={i}
                      className={`rounded-lg border p-3 transition-all ${
                        isDone ? "bg-green-50 border-green-200 opacity-70" : "bg-card border-border"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {icon}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-xs font-semibold">
                              {RULE_LABELS[p.rule_type] ?? p.rule_type}
                            </span>
                            <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${priorityColor[p.priority] ?? ""}`}>
                              {p.priority}
                            </span>
                            {isDone && (
                              <span className="text-[11px] text-green-700 font-medium flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Aplicada
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">{p.description}</p>
                          <div className="flex flex-wrap gap-1">
                            {p.students_info.map(s => (
                              <span key={s.id} className="text-[11px] bg-muted rounded-full px-2 py-0.5 text-muted-foreground">
                                {s.first_name} {s.last_name}
                                {s.current_class && <span className="opacity-60 ml-1">({s.current_class})</span>}
                              </span>
                            ))}
                          </div>
                        </div>
                        {!isDone && (
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() => setDismissed(prev => new Set([...prev, i]))}
                              title="Ignorar"
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => applyProposal(i)}
                              disabled={isApplying}
                            >
                              {isApplying
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : <><CheckCircle2 className="w-3 h-3" /> Aplicar</>
                              }
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="border-t pt-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {proposals.length > 0 && !aiLoading && (
                <p className="text-xs text-muted-foreground">
                  {applied.size} de {proposals.length - dismissed.size} reglas aplicadas
                </p>
              )}
            </div>
            <div className="flex gap-2 flex-wrap justify-end">
              {rules.length > 0 && !aiLoading && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={resetAndRegenerate}
                  disabled={aiLoading}
                >
                  <Trash2 className="w-3 h-3" />
                  Limpiar y regenerar
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={loadAiSuggestions}
                disabled={aiLoading}
              >
                {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                Regenerar
              </Button>
              <Button variant="outline" size="sm" onClick={() => setAiOpen(false)}>
                Cerrar
              </Button>
              {proposals.length > 0 && !aiLoading && (
                <Button
                  size="sm"
                  onClick={applyAllProposals}
                  disabled={proposals.every((_, i) => applied.has(i) || dismissed.has(i))}
                >
                  <Sparkles className="w-3 h-3" />
                  Aplicar todas
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create / Edit rule dialog */}
      <Dialog open={open} onOpenChange={v => { if (!v) closeDialog(); else setOpen(v) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Editar regla" : "Nueva regla"}</DialogTitle>
            <DialogDescription className="sr-only">
              {isEditing ? "Modifica los parámetros de esta regla" : "Configura los parámetros de la nueva regla de mezcla"}
            </DialogDescription>
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
                <Select value={watch("priority")} onValueChange={v => setValue("priority", v as CreateRuleInput["priority"])}>
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

            {(ruleType === "avoid_tutor" || ruleType === "with_tutor") && (
              <div className="space-y-1.5">
                <Label>{ruleType === "with_tutor" ? "Tutor asignado *" : "Tutor que debe evitarse *"}</Label>
                <Select value={watch("tutor_id") ?? ""} onValueChange={v => setValue("tutor_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar tutor..." /></SelectTrigger>
                  <SelectContent>
                    {centerUsers.map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} — {u.role === "tutor" ? "Tutor" : u.role === "orientador" ? "Orientador" : u.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {ruleType === "with_tutor"
                  ? <p className="text-xs text-muted-foreground">Los alumnos seleccionados se fijarán en la clase que imparta este tutor</p>
                  : <p className="text-xs text-muted-foreground">Los alumnos seleccionados no deberían asignarse a este tutor</p>
                }
              </div>
            )}
            {(ruleType === "with_tutor" || ruleType === "avoid_tutor") && (
              <div className="space-y-1.5">
                <Label>Clase {ruleType === "with_tutor" ? "destino *" : "a evitar *"}</Label>
                <Input placeholder="Ej: 1A" {...register("target_class")} />
                <p className="text-xs text-muted-foreground">
                  {ruleType === "with_tutor"
                    ? "Clase que impartirá el tutor seleccionado"
                    : "Clase asignada al tutor que estos alumnos deben evitar"}
                </p>
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
              <Button type="button" variant="outline" onClick={closeDialog}>Cancelar</Button>
              <Button type="submit" disabled={loading}>
                {loading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : isEditing ? "Guardar cambios" : "Crear regla"
                }
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
