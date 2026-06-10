"use client"

import { use, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { GraduationCap, Search, X, CheckCircle, Loader2, Heart, Briefcase, Users } from "lucide-react"
import { toast } from "sonner"

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
          qs.push({ type: "negative", label: "Dificultad", description: "¿Hay algún compañero con quien te cuesta trabajar? (opcional)", max: data.settings.negative_max, min: 0, icon: <X className="w-5 h-5" />, color: "text-red-400", bgColor: "bg-red-50 border-red-200" })
        }
        setQuestions(qs)
        const initial: Record<string, string[]> = {}
        qs.forEach(q => { initial[q.type] = [] })
        setSelections(initial)
        setSearches(Object.fromEntries(qs.map(q => [q.type, ""])))
      })
      .catch(() => setError("Error al cargar el cuestionario"))
      .finally(() => setLoading(false))
  }, [token])

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

  async function handleSubmit() {
    for (const q of questions) {
      if (q.min > 0 && (selections[q.type]?.length ?? 0) < q.min) {
        toast.error(`Debes elegir al menos ${q.min} compañero(s) para "${q.label}"`)
        return
      }
    }

    setSubmitting(true)
    try {
      // Send ordered selections — server uses array index as selection_order
      const res = await fetch(`/api/q/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selections }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
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

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-2xl mx-auto px-4 py-5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-sm">{processName}</p>
            <p className="text-xs text-muted-foreground">Hola, {studentName}</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-bold">Cuestionario sociométrico</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tus respuestas son confidenciales. El orden en que eliges a tus compañeros también se tiene en cuenta: el primero que selecciones será el más importante.
          </p>
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
                  {q.type === "negative" && (
                    <Badge variant="outline" className="text-xs ml-auto">Opcional</Badge>
                  )}
                </div>
                <CardDescription>{q.description}</CardDescription>
                <p className="text-xs text-muted-foreground">
                  {selected.length} de {q.max} elegidos
                  {q.min > 0 && <span className="text-destructive ml-1">(mínimo {q.min})</span>}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">

                {/* Ordered selection list */}
                {selected.length > 0 && (
                  <div className={`rounded-lg border p-3 space-y-2 ${q.bgColor}`}>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Tus elecciones (en orden de preferencia):</p>
                    {selected.map((sid, idx) => {
                      const s = availableStudents.find(st => st.id === sid)
                      return (
                        <div key={sid} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm">
                          <span className="text-xs font-bold text-primary w-6 shrink-0">{ORDER_LABELS[idx]}</span>
                          <span className="text-sm flex-1 font-medium">{s?.first_name} {s?.last_name}</span>
                          <Badge variant="outline" className="text-xs shrink-0">{s?.current_class}</Badge>
                          <button
                            onClick={() => removeStudent(q.type, sid)}
                            className="text-muted-foreground hover:text-destructive transition-colors p-0.5"
                            aria-label={`Eliminar ${s?.first_name}`}
                          >
                            <X className="w-3.5 h-3.5" />
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
                        className="pl-9"
                        value={search}
                        onChange={e => setSearches(prev => ({ ...prev, [q.type]: e.target.value }))}
                      />
                    </div>

                    <div className="max-h-52 overflow-y-auto rounded-md border divide-y">
                      {filtered.map(s => (
                        <button
                          key={s.id}
                          onClick={() => { addStudent(q.type, s.id, q.max); setSearches(prev => ({ ...prev, [q.type]: "" })) }}
                          className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-left hover:bg-muted/50 transition-colors"
                        >
                          <span>{s.first_name} {s.last_name}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">{s.current_class}</Badge>
                            <span className="text-xs text-primary font-medium">{ORDER_LABELS[selected.length]}</span>
                          </div>
                        </button>
                      ))}
                      {filtered.length === 0 && (
                        <p className="text-center py-4 text-sm text-muted-foreground">
                          {search ? "No se encontraron resultados" : "Ya has seleccionado todos los disponibles"}
                        </p>
                      )}
                    </div>
                  </>
                )}

                {selected.length >= q.max && (
                  <p className="text-xs text-center text-muted-foreground py-2">
                    Has llegado al máximo de {q.max} elecciones. Elimina alguna para cambiar.
                  </p>
                )}
              </CardContent>
            </Card>
          )
        })}

        <Button size="lg" className="w-full" onClick={handleSubmit} disabled={submitting}>
          {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</> : "Enviar respuestas"}
        </Button>

        <p className="text-xs text-center text-muted-foreground pb-8">
          Tus respuestas son confidenciales y solo son visibles para el equipo educativo.
        </p>
      </div>
    </div>
  )
}
