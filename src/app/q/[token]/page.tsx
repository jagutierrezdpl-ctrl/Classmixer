"use client"
import LogoBrand from "@/components/ui/LogoBrand"

import { use, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search, X, CheckCircle, Loader2, Heart, Briefcase, Users, LayoutGrid, List } from "lucide-react"
import { toast } from "sonner"
import { StudentCardGrid } from "@/components/questionnaire/StudentCardGrid"
import AdvancedQuestionCard, { type AdvancedQuestionConfig } from "@/components/questionnaire/AdvancedQuestionCard"

interface Student {
  id: string
  first_name: string
  last_name: string
  current_class: string
}

interface QuestionConfig {
  type: "friendship" | "work" | "emotional" | "negative"
  label: string
  description: string
  supportText?: string
  max: number
  min: number
  icon: React.ReactNode
  color: string
  bgColor: string
}

const ORDER_LABELS = ["1ª", "2ª", "3ª", "4ª", "5ª", "6ª", "7ª", "8ª", "9ª", "10ª"]

export default function QuestionnairePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [studentName, setStudentName] = useState("")
  const [processName, setProcessName] = useState("")
  const [questions, setQuestions] = useState<QuestionConfig[]>([])
  const [availableStudents, setAvailableStudents] = useState<Student[]>([])
  // selections stores ordered arrays — index 0 = 1st choice (highest priority)
  const [selections, setSelections] = useState<Record<string, string[]>>({})
  const [searches, setSearches] = useState<Record<string, string>>({})

  // Preguntas avanzadas (capa adicional sobre las 4 de siempre) — estado en paralelo,
  // el de arriba no se toca para no arriesgar el comportamiento ya existente.
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid")  // grid = visual/gamified, list = classic

  const [advancedQuestions, setAdvancedQuestions] = useState<AdvancedQuestionConfig[]>([])
  const [advancedChoices, setAdvancedChoices] = useState<Record<string, string[]>>({})
  const [advancedScaleValues, setAdvancedScaleValues] = useState<Record<string, Record<string, number>>>({})
  const [climateValues, setClimateValues] = useState<Record<string, number>>({})
  const [bullyingMeta, setBullyingMeta] = useState<Record<string, { frequency?: string; context?: string }>>({})
  const [advancedSearches, setAdvancedSearches] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch(`/api/q/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return }
        setStudentName(data.student_name)
        setProcessName(data.process_name)
        setAvailableStudents(data.students)

        const qs: QuestionConfig[] = []
        if (data.settings.friendship_enabled) {
          qs.push({ type: "friendship", label: "Amistad", description: "Elige con quién te gustaría compartir clase. El primero que elijas es tu preferencia más importante.", max: data.settings.friendship_max, min: data.settings.friendship_min, icon: <Heart className="w-5 h-5" />, color: "text-pink-500", bgColor: "bg-pink-50 border-pink-200" })
        }
        if (data.settings.work_enabled) {
          qs.push({ type: "work", label: "Trabajo en clase", description: "Elige con quién trabajas bien. El orden también importa.", max: data.settings.work_max, min: data.settings.work_min, icon: <Briefcase className="w-5 h-5" />, color: "text-blue-500", bgColor: "bg-blue-50 border-blue-200" })
        }
        if (data.settings.emotional_enabled) {
          qs.push({ type: "emotional", label: "Apoyo", description: "Elige a compañeros con quienes te sientes cómodo o tranquilo.", max: data.settings.emotional_max, min: data.settings.emotional_min, icon: <Users className="w-5 h-5" />, color: "text-purple-500", bgColor: "bg-purple-50 border-purple-200" })
        }
        if (data.settings.negative_enabled) {
          qs.push({ type: "negative", label: "Convivencia", description: "¿Con qué compañeros te resulta más difícil convivir o tienes más conflictos?", supportText: "Piensa en clase, recreo y actividades del colegio. No es para culpar a nadie, sino para ayudar a mejorar la convivencia.", max: data.settings.negative_max, min: data.settings.negative_min ?? 0, icon: <X className="w-5 h-5" />, color: "text-red-400", bgColor: "bg-red-50 border-red-200" })
        }
        setQuestions(qs)
        const initial: Record<string, string[]> = {}
        qs.forEach(q => { initial[q.type] = [] })

        // Restore draft from localStorage if available
        try {
          const saved = localStorage.getItem(`q_draft_${token}`)
          if (saved) {
            const { selections: savedSels, timestamp } = JSON.parse(saved)
            if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
              // Merge saved with initial — only restore types that exist in current questions
              const merged = { ...initial }
              for (const q of qs) {
                if (Array.isArray(savedSels?.[q.type]) && savedSels[q.type].length > 0) {
                  merged[q.type] = savedSels[q.type]
                }
              }
              setSelections(merged)
              toast.info("Hemos recuperado tus respuestas guardadas. Puedes editarlas o enviarlas.", { duration: 4000 })
            } else {
              localStorage.removeItem(`q_draft_${token}`)
              setSelections(initial)
            }
          } else {
            setSelections(initial)
          }
        } catch {
          setSelections(initial)
        }
        setSearches(Object.fromEntries(qs.map(q => [q.type, ""])))

        const advanced: AdvancedQuestionConfig[] = Array.isArray(data.advanced_questions) ? data.advanced_questions : []
        setAdvancedQuestions(advanced)
        setAdvancedChoices(Object.fromEntries(advanced.filter(q => q.input_mode === "choice").map(q => [q.code, []])))
        setAdvancedScaleValues(Object.fromEntries(advanced.filter(q => q.input_mode === "scale").map(q => [q.code, {}])))
        setAdvancedSearches(Object.fromEntries(advanced.filter(q => q.input_mode !== "climate").map(q => [q.code, ""])))
      })
      .catch(() => setError("Error al cargar el cuestionario"))
      .finally(() => setLoading(false))
  }, [token])

  // Auto-save to localStorage whenever selections change
  useEffect(() => {
    if (questions.length === 0 || submitted) return
    const hasAny = Object.values(selections).some(arr => arr.length > 0)
    if (!hasAny) return
    try {
      localStorage.setItem(`q_draft_${token}`, JSON.stringify({ selections, timestamp: Date.now() }))
    } catch { /* no-op */ }
  }, [selections, questions, token, submitted])

  function addStudent(questionType: string, studentId: string, max: number) {
    setSelections(prev => {
      const current = prev[questionType] ?? []
      if (current.includes(studentId)) return prev
      if (current.length >= max) {
        toast.error(`Puedes elegir hasta ${max} compañeros en esta pregunta`)
        return prev
      }
      return { ...prev, [questionType]: [...current, studentId] }
    })
  }

  function removeStudent(questionType: string, studentId: string) {
    setSelections(prev => ({
      ...prev,
      [questionType]: (prev[questionType] ?? []).filter(id => id !== studentId),
    }))
  }

  function addAdvancedChoice(code: string, studentId: string, max: number) {
    setAdvancedChoices(prev => {
      const current = prev[code] ?? []
      if (current.includes(studentId)) return prev
      if (current.length >= max) {
        toast.error(`Puedes elegir hasta ${max} compañeros en esta pregunta`)
        return prev
      }
      return { ...prev, [code]: [...current, studentId] }
    })
  }

  function removeAdvancedChoice(code: string, studentId: string) {
    setAdvancedChoices(prev => ({
      ...prev,
      [code]: (prev[code] ?? []).filter(id => id !== studentId),
    }))
    setAdvancedScaleValues(prev => {
      if (!prev[code] || !(studentId in prev[code])) return prev
      const next = { ...prev[code] }
      delete next[studentId]
      return { ...prev, [code]: next }
    })
  }

  async function handleSubmit() {
    for (const q of questions) {
      if (q.min > 0 && (selections[q.type]?.length ?? 0) < q.min) {
        toast.error(`Debes elegir al menos ${q.min} compañero(s) para "${q.label}"`)
        return
      }
    }

    for (const q of advancedQuestions) {
      if (q.input_mode === "scale") {
        if (q.min > 0 && (advancedChoices[q.code]?.length ?? 0) < q.min) {
          toast.error(`Debes elegir al menos ${q.min} compañero(s) para "${q.label}"`)
          return
        }
        const unrated = (advancedChoices[q.code] ?? []).filter(sid => typeof advancedScaleValues[q.code]?.[sid] !== "number")
        if (unrated.length > 0) {
          toast.error(`Debes valorar a todos los compañeros seleccionados en "${q.label}"`)
          return
        }
        continue
      }
      if (q.input_mode === "choice" && q.min > 0 && (advancedChoices[q.code]?.length ?? 0) < q.min) {
        toast.error(`Debes elegir al menos ${q.min} compañero(s) para "${q.label}"`)
        return
      }
      if (q.input_mode === "climate" && q.min > 0 && typeof climateValues[q.code] !== "number") {
        toast.error(`Debes valorar "${q.label}" antes de enviar`)
        return
      }
    }

    setSubmitting(true)
    try {
      // Send ordered selections — server uses array index as selection_order
      const res = await fetch(`/api/q/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selections,
          advanced: {
            choices: advancedChoices,
            scales: advancedScaleValues,
            climate: climateValues,
            metadata: bullyingMeta,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      try { localStorage.removeItem(`q_draft_${token}`) } catch { /* no-op */ }
      setSubmitted(true)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al enviar")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8">
            <X className="w-12 h-12 mx-auto mb-4 text-destructive" />
            <h2 className="text-lg font-semibold mb-2">No se puede cargar el cuestionario</h2>
            <p className="text-muted-foreground text-sm">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8">
            <CheckCircle className="w-14 h-14 mx-auto mb-4 text-green-500" />
            <h2 className="text-xl font-bold mb-2">¡Gracias, {studentName.split(" ")[0]}!</h2>
            <p className="text-muted-foreground text-sm">
              Tus respuestas han sido registradas. Ya puedes cerrar esta página.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const advancedRequired = advancedQuestions.filter(q => q.input_mode === "choice" && q.min > 0).reduce((s, q) => s + q.min, 0)
  const advancedSelected = advancedQuestions.filter(q => q.input_mode === "choice" && q.min > 0).reduce((s, q) => s + Math.min(advancedChoices[q.code]?.length ?? 0, q.min), 0)
  const totalRequired = questions.filter(q => q.min > 0).reduce((s, q) => s + q.min, 0) + advancedRequired
  const totalSelected = questions.filter(q => q.min > 0).reduce((s, q) => s + Math.min(selections[q.type]?.length ?? 0, q.min), 0) + advancedSelected
  const progressPct = totalRequired > 0 ? Math.round((totalSelected / totalRequired) * 100) : 100

  const canSubmit =
    questions.length > 0 &&
    questions.every(q => !q.min || (selections[q.type]?.length ?? 0) >= q.min) &&
    advancedQuestions.every(q => {
      if (q.input_mode === "scale") {
        const selected = advancedChoices[q.code] ?? []
        const hasMin = !q.min || selected.length >= q.min
        const allRated = selected.every(sid => typeof advancedScaleValues[q.code]?.[sid] === "number")
        return hasMin && allRated
      }
      if (!q.min) return true
      if (q.input_mode === "choice") return (advancedChoices[q.code]?.length ?? 0) >= q.min
      if (q.input_mode === "climate") return typeof climateValues[q.code] === "number"
      return true
    })

  const pendingLabels = [
    ...questions.filter(q => !!q.min && (selections[q.type]?.length ?? 0) < q.min).map(q => q.label),
    ...advancedQuestions.filter(q => {
      if (q.input_mode === "scale") {
        const selected = advancedChoices[q.code] ?? []
        return (!!q.min && selected.length < q.min) ||
          selected.some(sid => typeof advancedScaleValues[q.code]?.[sid] !== "number")
      }
      if (!q.min) return false
      if (q.input_mode === "climate") return typeof climateValues[q.code] !== "number"
      return (advancedChoices[q.code]?.length ?? 0) < q.min
    }).map(q => q.label),
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <LogoBrand size="sm" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{processName}</p>
            <p className="text-xs text-muted-foreground">Hola, {studentName.split(" ")[0]}</p>
          </div>
          {totalRequired > 0 && (
            <div className="shrink-0 text-right">
              <p className="text-xs font-medium text-primary">{progressPct}%</p>
              <p className="text-xs text-muted-foreground">completado</p>
            </div>
          )}
        </div>
        {totalRequired > 0 && (
          <div className="h-1 bg-muted">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        )}
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold">Cuestionario sociométrico</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Tus respuestas son confidenciales. El <strong>primer compañero que elijas</strong> será tu preferencia principal.
            </p>
          </div>
          <div className="flex gap-1 shrink-0 bg-muted rounded-lg p-1">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md transition-colors ${viewMode === "grid" ? "bg-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              title="Modo visual"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              title="Modo lista"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {questions.map(q => {
          const selected = selections[q.type] ?? []
          const search = searches[q.type] ?? ""
          const filtered = availableStudents.filter(s => {
            const name = `${s.first_name} ${s.last_name}`.toLowerCase()
            return !selected.includes(s.id) && (!search || name.includes(search.toLowerCase()))
          })

          return (
            <Card key={q.type}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <span className={q.color}>{q.icon}</span>
                  <CardTitle className="text-base">{q.label}</CardTitle>
                  {q.type === "negative" || q.min === 0 ? (
                    selected.length > 0
                      ? <CheckCircle className="w-4 h-4 text-green-500 ml-auto shrink-0" />
                      : <Badge variant="outline" className="text-xs ml-auto text-muted-foreground">Opcional</Badge>
                  ) : selected.length >= q.min ? (
                    <CheckCircle className="w-4 h-4 text-green-500 ml-auto shrink-0" />
                  ) : (
                    <Badge variant="outline" className="text-xs ml-auto text-destructive border-destructive/40">Obligatoria</Badge>
                  )}
                </div>
                <CardDescription>{q.description}</CardDescription>
                {q.supportText && (
                  <p className="text-xs text-muted-foreground italic leading-relaxed">{q.supportText}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {selected.length} de {q.max} elegidos
                  {q.min > 0 && <span className="text-destructive ml-1">(mínimo {q.min})</span>}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* GRID mode: visual card picker */}
                {viewMode === "grid" ? (
                  <StudentCardGrid
                    students={availableStudents}
                    selected={selected}
                    max={q.max}
                    color={q.type === "friendship" ? "pink" : q.type === "work" ? "blue" : q.type === "emotional" ? "purple" : "red"}
                    onToggle={sid => {
                      if (selected.includes(sid)) removeStudent(q.type, sid)
                      else addStudent(q.type, sid, q.max)
                    }}
                  />
                ) : (
                  <>
                    {/* LIST mode: classic ordered selection */}
                    {selected.length > 0 && (
                      <div className={`rounded-lg border p-3 space-y-2 ${q.bgColor}`}>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Tus elecciones (en orden de preferencia):</p>
                        {selected.map((sid, idx) => {
                          const s = availableStudents.find(st => st.id === sid)
                          return (
                            <div key={sid} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2.5 shadow-sm">
                              <span className="text-xs font-bold text-primary w-6 shrink-0">{ORDER_LABELS[idx]}</span>
                              <span className="text-sm flex-1 font-medium">{s?.first_name} {s?.last_name}</span>
                              <Badge variant="outline" className="text-xs shrink-0 hidden sm:inline-flex">{s?.current_class}</Badge>
                              <button
                                onClick={() => removeStudent(q.type, sid)}
                                className="text-muted-foreground hover:text-destructive transition-colors p-2 -mr-1 touch-manipulation"
                                aria-label={`Eliminar ${s?.first_name}`}
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {selected.length < q.max && (
                      <>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            placeholder={`Buscar y añadir ${selected.length === 0 ? "(1ª elección)" : `(${ORDER_LABELS[selected.length]} elección)`}...`}
                            className="pl-9 h-11 text-base"
                            value={search}
                            onChange={e => setSearches(prev => ({ ...prev, [q.type]: e.target.value }))}
                            autoComplete="off"
                            autoCorrect="off"
                          />
                        </div>

                        <div className="max-h-56 overflow-y-auto rounded-md border divide-y">
                          {filtered.map(s => (
                            <button
                              key={s.id}
                              onClick={() => { addStudent(q.type, s.id, q.max); setSearches(prev => ({ ...prev, [q.type]: "" })) }}
                              className="w-full flex items-center justify-between px-3 py-3 text-sm text-left hover:bg-muted/50 active:bg-muted transition-colors touch-manipulation"
                            >
                              <span className="font-medium">{s.first_name} {s.last_name}</span>
                              <div className="flex items-center gap-2 shrink-0">
                                <Badge variant="outline" className="text-xs hidden sm:inline-flex">{s.current_class}</Badge>
                                <span className="text-xs text-primary font-semibold">{ORDER_LABELS[selected.length]}</span>
                              </div>
                            </button>
                          ))}
                          {filtered.length === 0 && (
                            <p className="text-center py-5 text-sm text-muted-foreground">
                              {search ? "Sin resultados" : "Ya has seleccionado todos los disponibles"}
                            </p>
                          )}
                        </div>
                      </>
                    )}

                    {selected.length >= q.max && (
                      <div className="flex items-center justify-center gap-1.5 py-2 text-xs text-emerald-600 font-medium">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Máximo alcanzado ({q.max}). Toca la X para cambiar alguna elección.
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )
        })}

        {advancedQuestions.map(q => (
          <AdvancedQuestionCard
            key={q.code}
            question={q}
            availableStudents={availableStudents}
            selected={advancedChoices[q.code] ?? []}
            scaleValues={advancedScaleValues[q.code] ?? {}}
            climateValue={climateValues[q.code]}
            metadata={bullyingMeta[q.code]}
            search={advancedSearches[q.code] ?? ""}
            onSearchChange={value => setAdvancedSearches(prev => ({ ...prev, [q.code]: value }))}
            onAdd={studentId => addAdvancedChoice(q.code, studentId, q.max)}
            onRemove={studentId => removeAdvancedChoice(q.code, studentId)}
            onScaleChange={(studentId, value) => setAdvancedScaleValues(prev => ({ ...prev, [q.code]: { ...prev[q.code], [studentId]: value } }))}
            onClimateChange={value => setClimateValues(prev => ({ ...prev, [q.code]: value }))}
            onMetadataChange={meta => setBullyingMeta(prev => ({ ...prev, [q.code]: meta }))}
          />
        ))}

        <div className="sticky bottom-4 space-y-2">
          <Button
            size="lg"
            className="w-full h-12 text-base shadow-lg"
            onClick={handleSubmit}
            disabled={submitting || !canSubmit}
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
            ) : (
              "Enviar respuestas"
            )}
          </Button>
          {!canSubmit && pendingLabels.length > 0 && (
            <p className="text-center text-xs text-muted-foreground">
              Faltan por completar: <span className="font-medium text-foreground">{pendingLabels.join(", ")}</span>
            </p>
          )}
        </div>

        <p className="text-xs text-center text-muted-foreground pb-8">
          Tus respuestas son confidenciales y solo visibles para el equipo educativo.
        </p>
      </div>
    </div>
  )
}
