"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, Loader2, Sparkles } from "lucide-react"
import { getQuestionIcon } from "@/lib/questionnaire/icons"

interface AdvancedQuestion {
  question_type_id: string
  code: string
  category: string
  label: string
  description?: string
  icon?: string
  sensitivity: "normal" | "sensitive" | "very_sensitive"
  input_mode: "choice" | "scale" | "climate"
  enabled: boolean
  min: number
  max: number
}

interface Template {
  id: string
  name: string
  description?: string
  is_system: boolean
  questionnaire_template_questions?: { question_type_id: string }[]
}

const CATEGORY_LABELS: Record<string, string> = {
  role_nomination: "Roles sociales",
  peer_choice: "Autopercepción",
  climate: "Clima de aula",
  bullying: "Convivencia",
  peer_scale: "Relaciones (intensidad)",
}

const CATEGORY_ORDER = ["role_nomination", "peer_choice", "peer_scale", "climate", "bullying"]

export default function AdvancedQuestionsCard({ processId }: { processId: string }) {
  const [questions, setQuestions] = useState<AdvancedQuestion[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [applyingTemplate, setApplyingTemplate] = useState<string | null>(null)
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set())

  useEffect(() => {
    Promise.all([
      fetch(`/api/processes/${processId}/questionnaire/advanced`).then(r => r.json()),
      fetch(`/api/questionnaire/templates`).then(r => r.json()),
    ]).then(([q, t]) => {
      setQuestions(Array.isArray(q) ? q : [])
      setTemplates(Array.isArray(t) ? t : [])
    }).finally(() => setLoading(false))
  }, [processId])

  function toggleCategory(cat: string) {
    setOpenCategories(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  function updateQuestion(typeId: string, patch: Partial<AdvancedQuestion>) {
    setQuestions(prev => prev.map(q => q.question_type_id === typeId ? { ...q, ...patch } : q))
  }

  async function saveQuestions() {
    setSaving(true)
    try {
      const res = await fetch(`/api/processes/${processId}/questionnaire/advanced`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questions: questions.map(q => ({
            question_type_id: q.question_type_id,
            enabled: q.enabled,
            min: q.min,
            max: q.max,
          })),
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success("Preguntas avanzadas guardadas")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar")
    } finally {
      setSaving(false)
    }
  }

  async function applyTemplate(template: Template) {
    if (!confirm(`¿Aplicar la plantilla "${template.name}"? Activará su preset de preguntas avanzadas (no afecta a amistad/trabajo/emocional/negativa, que se configuran arriba).`)) return
    setApplyingTemplate(template.id)
    try {
      const res = await fetch(`/api/processes/${processId}/questionnaire/apply-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_id: template.id }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const refreshed = await fetch(`/api/processes/${processId}/questionnaire/advanced`).then(r => r.json())
      setQuestions(Array.isArray(refreshed) ? refreshed : [])
      toast.success(`Plantilla "${template.name}" aplicada`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al aplicar la plantilla")
    } finally {
      setApplyingTemplate(null)
    }
  }

  if (loading) {
    return (
      <Card className="mb-4">
        <CardContent className="py-6 flex items-center justify-center text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Cargando preguntas avanzadas...
        </CardContent>
      </Card>
    )
  }

  const byCategory = CATEGORY_ORDER
    .map(cat => ({ cat, items: questions.filter(q => q.category === cat) }))
    .filter(g => g.items.length > 0)

  const enabledCount = questions.filter(q => q.enabled).length

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-muted-foreground" />
          Preguntas avanzadas
          {enabledCount > 0 && <Badge variant="secondary" className="text-xs">{enabledCount} activas</Badge>}
        </CardTitle>
        <CardDescription>
          Roles sociales, autopercepción, clima de aula y convivencia — opcional, además de las preguntas de arriba.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {templates.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pb-3 border-b">
            <span className="text-xs text-muted-foreground mr-1">Plantillas:</span>
            {templates.map(t => (
              <Button
                key={t.id}
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={applyingTemplate === t.id}
                onClick={() => applyTemplate(t)}
                title={t.description}
              >
                {applyingTemplate === t.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                {t.name}
              </Button>
            ))}
          </div>
        )}

        {byCategory.map(({ cat, items }) => {
          const open = openCategories.has(cat)
          const activeInCategory = items.filter(q => q.enabled).length
          return (
            <div key={cat} className="border rounded-lg">
              <button
                type="button"
                onClick={() => toggleCategory(cat)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium hover:bg-muted/40 rounded-lg"
              >
                <span className="flex items-center gap-2">
                  {CATEGORY_LABELS[cat] ?? cat}
                  {activeInCategory > 0 && <Badge variant="secondary" className="text-xs">{activeInCategory}</Badge>}
                  {cat === "bullying" && <Badge variant="destructive" className="text-xs">Muy sensible</Badge>}
                </span>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
              </button>

              {open && (
                <div className="px-3 pb-3 space-y-3 border-t pt-3">
                  {cat === "bullying" && (
                    <p className="text-xs text-muted-foreground bg-red-50 border border-red-200 rounded-md px-2.5 py-1.5">
                      Estas preguntas solo serán visibles para orientación y administración (nunca para tutores) y cada acceso queda registrado en el log de auditoría.
                    </p>
                  )}
                  {items.map(q => {
                    const Icon = getQuestionIcon(q.icon)
                    return (
                      <div key={q.question_type_id} className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Switch
                              checked={q.enabled}
                              onCheckedChange={v => updateQuestion(q.question_type_id, { enabled: v })}
                            />
                            <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                            <Label className="font-medium">{q.label}</Label>
                            {q.sensitivity === "sensitive" && <Badge variant="outline" className="text-xs">Sensible</Badge>}
                            {q.sensitivity === "very_sensitive" && <Badge variant="destructive" className="text-xs">Muy sensible</Badge>}
                          </div>
                          {q.description && (
                            <p className="text-xs text-muted-foreground pl-8">&ldquo;{q.description}&rdquo;</p>
                          )}
                        </div>
                        {q.enabled && q.input_mode !== "climate" && (
                          <div className="flex items-center gap-2 text-sm shrink-0">
                            <Label className="text-muted-foreground">Min</Label>
                            <Input
                              type="number"
                              className="w-16 h-7 text-xs"
                              value={q.min}
                              onChange={e => updateQuestion(q.question_type_id, { min: Number(e.target.value) })}
                            />
                            <Label className="text-muted-foreground">Max</Label>
                            <Input
                              type="number"
                              className="w-16 h-7 text-xs"
                              value={q.max}
                              onChange={e => updateQuestion(q.question_type_id, { max: Number(e.target.value) })}
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        <Button type="button" onClick={saveQuestions} disabled={saving} variant="outline">
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : "Guardar preguntas avanzadas"}
        </Button>
      </CardContent>
    </Card>
  )
}
