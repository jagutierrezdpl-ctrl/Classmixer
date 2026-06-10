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
}

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
  const [selections, setSelections] = useState<Record<string, string[]>>({})
  const [searches, setSearches] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch(`/api/q/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setError(data.error)
          return
        }
        setStudentName(data.student_name)
        setProcessName(data.process_name)
        setAvailableStudents(data.students)

        const qs: QuestionConfig[] = []
        if (data.settings.friendship_enabled) {
          qs.push({
            type: "friendship",
            label: "Amistad",
            description: "Elige con quién te gustaría compartir clase el próximo curso.",
            max: data.settings.friendship_max,
            min: data.settings.friendship_min,
            icon: <Heart className="w-5 h-5" />,
            color: "text-pink-500",
          })
        }
        if (data.settings.work_enabled) {
          qs.push({
            type: "work",
            label: "Trabajo en clase",
            description: "Elige con quién trabajas bien en clase.",
            max: data.settings.work_max,
            min: data.settings.work_min,
            icon: <Briefcase className="w-5 h-5" />,
            color: "text-blue-500",
          })
        }
        if (data.settings.emotional_enabled) {
          qs.push({
            type: "emotional",
            label: "Apoyo",
            description: "Elige a compañeros con quienes te sientes cómodo o tranquilo.",
            max: data.settings.emotional_max,
            min: data.settings.emotional_min,
            icon: <Users className="w-5 h-5" />,
            color: "text-purple-500",
          })
        }
        if (data.settings.negative_enabled) {
          qs.push({
            type: "negative",
            label: "Dificultad",
            description: "¿Hay algún compañero con quien te cuesta trabajar en clase? (máximo 2, opcional)",
            max: data.settings.negative_max,
            min: 0,
            icon: <X className="w-5 h-5" />,
            color: "text-red-400",
          })
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

  function toggleStudent(questionType: string, studentId: string, max: number) {
    setSelections(prev => {
      const current = prev[questionType] ?? []
      if (current.includes(studentId)) {
        return { ...prev, [questionType]: current.filter(id => id !== studentId) }
      }
      if (current.length >= max) {
        toast.error(`Puedes elegir hasta ${max} compañeros en esta pregunta`)
        return prev
      }
      return { ...prev, [questionType]: [...current, studentId] }
    })
  }

  async function handleSubmit() {
    // Validate minimums
    for (const q of questions) {
      if (q.min > 0 && (selections[q.type]?.length ?? 0) < q.min) {
        toast.error(`Debes elegir al menos ${q.min} compañero(s) para "${q.label}"`)
        return
      }
    }

    setSubmitting(true)
    try {
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
      {/* Header */}
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
            Tus respuestas son confidenciales. Nadie más verá tus elecciones.
          </p>
        </div>

        {questions.map(q => {
          const selected = selections[q.type] ?? []
          const search = searches[q.type] ?? ""
          const filtered = availableStudents.filter(s => {
            const name = `${s.first_name} ${s.last_name}`.toLowerCase()
            return !search || name.includes(search.toLowerCase())
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
                  {q.min > 0 && <span className="text-destructive"> (mínimo {q.min})</span>}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Selected chips */}
                {selected.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selected.map(sid => {
                      const s = availableStudents.find(st => st.id === sid)
                      return (
                        <button
                          key={sid}
                          onClick={() => toggleStudent(q.type, sid, q.max)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                        >
                          {s?.first_name} {s?.last_name}
                          <X className="w-3 h-3" />
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar compañero..."
                    className="pl-9"
                    value={search}
                    onChange={e => setSearches(prev => ({ ...prev, [q.type]: e.target.value }))}
                  />
                </div>

                {/* Student list */}
                <div className="max-h-56 overflow-y-auto rounded-md border divide-y">
                  {filtered.map(s => {
                    const isSelected = selected.includes(s.id)
                    return (
                      <button
                        key={s.id}
                        onClick={() => toggleStudent(q.type, s.id, q.max)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 text-sm text-left transition-colors ${
                          isSelected
                            ? "bg-primary/5 text-primary font-medium"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <span>{s.first_name} {s.last_name}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{s.current_class}</Badge>
                          {isSelected && <CheckCircle className="w-4 h-4 text-primary" />}
                        </div>
                      </button>
                    )
                  })}
                  {filtered.length === 0 && (
                    <p className="text-center py-4 text-sm text-muted-foreground">
                      No se encontraron resultados
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}

        <Button
          size="lg"
          className="w-full"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
          ) : (
            "Enviar respuestas"
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground pb-8">
          Tus respuestas son confidenciales y solo son visibles para el equipo educativo.
        </p>
      </div>
    </div>
  )
}
