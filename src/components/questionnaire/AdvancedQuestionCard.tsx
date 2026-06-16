"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search, X, CheckCircle } from "lucide-react"
import { getQuestionIcon } from "@/lib/questionnaire/icons"

export interface AdvancedQuestionConfig {
  code: string
  category: string
  label: string
  description?: string
  icon?: string
  input_mode: "choice" | "scale" | "climate"
  sensitivity: "normal" | "sensitive" | "very_sensitive"
  min: number
  max: number
}

interface Student {
  id: string
  first_name: string
  last_name: string
  current_class: string
}

const ORDER_LABELS = ["1ª", "2ª", "3ª", "4ª", "5ª", "6ª", "7ª", "8ª", "9ª", "10ª"]
const CLIMATE_LABELS = ["Nada de acuerdo", "Poco de acuerdo", "Neutral", "Bastante de acuerdo", "Totalmente de acuerdo"]
const FREQUENCY_OPTIONS = ["Una vez", "Algunas veces", "Frecuentemente", "Casi todos los días"]

interface Props {
  question: AdvancedQuestionConfig
  availableStudents: Student[]
  selected: string[]
  scaleValues: Record<string, number>
  climateValue?: number
  metadata?: { frequency?: string; context?: string }
  search: string
  onSearchChange: (value: string) => void
  onAdd: (studentId: string) => void
  onRemove: (studentId: string) => void
  onScaleChange: (studentId: string, value: number) => void
  onClimateChange: (value: number) => void
  onMetadataChange: (meta: { frequency?: string; context?: string }) => void
}

export default function AdvancedQuestionCard({
  question: q,
  availableStudents,
  selected,
  scaleValues,
  climateValue,
  metadata,
  search,
  onSearchChange,
  onAdd,
  onRemove,
  onScaleChange,
  onClimateChange,
  onMetadataChange,
}: Props) {
  const Icon = getQuestionIcon(q.icon)
  const isBullying = q.category === "bullying"

  if (q.input_mode === "climate") {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Icon className="w-5 h-5 text-sky-500" />
            <CardTitle className="text-base">{q.label}</CardTitle>
          </div>
          <CardDescription>{q.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-1.5">
            {CLIMATE_LABELS.map((label, i) => {
              const value = i + 1
              const active = climateValue === value
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => onClimateChange(value)}
                  className={`flex flex-col items-center gap-1 rounded-lg border py-2.5 px-1 text-center transition-colors touch-manipulation ${
                    active ? "bg-sky-500 text-white border-sky-500" : "border-border hover:bg-muted/50"
                  }`}
                >
                  <span className="text-sm font-bold">{value}</span>
                  <span className="text-[10px] leading-tight hidden sm:block">{label}</span>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>
    )
  }

  const filtered = availableStudents.filter(s => {
    const name = `${s.first_name} ${s.last_name}`.toLowerCase()
    return !selected.includes(s.id) && (!search || name.includes(search.toLowerCase()))
  })

  return (
    <Card className={isBullying ? "border-red-200" : undefined}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${isBullying ? "text-red-500" : "text-muted-foreground"}`} />
          <CardTitle className="text-base">{q.label}</CardTitle>
          {q.min === 0 && <Badge variant="outline" className="text-xs ml-auto">Opcional</Badge>}
        </div>
        <CardDescription>{q.description}</CardDescription>
        <p className="text-xs text-muted-foreground">
          {selected.length} de {q.max} elegidos
          {q.min > 0 && <span className="text-destructive ml-1">(mínimo {q.min})</span>}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {selected.length > 0 && (
          <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
            {selected.map((sid, idx) => {
              const s = availableStudents.find(st => st.id === sid)
              return (
                <div key={sid} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2.5 shadow-sm">
                  {q.input_mode === "scale" ? (
                    <div className="flex gap-1 shrink-0">
                      {[1, 2, 3, 4, 5].map(v => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => onScaleChange(sid, v)}
                          className={`w-6 h-6 rounded-full text-xs font-semibold transition-colors ${
                            (scaleValues[sid] ?? 0) >= v ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs font-bold text-primary w-6 shrink-0">{ORDER_LABELS[idx]}</span>
                  )}
                  <span className="text-sm flex-1 font-medium">{s?.first_name} {s?.last_name}</span>
                  <Badge variant="outline" className="text-xs shrink-0 hidden sm:inline-flex">{s?.current_class}</Badge>
                  <button
                    onClick={() => onRemove(sid)}
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
                placeholder="Buscar y añadir..."
                className="pl-9 h-11 text-base"
                value={search}
                onChange={e => onSearchChange(e.target.value)}
                autoComplete="off"
                autoCorrect="off"
              />
            </div>
            <div className="max-h-56 overflow-y-auto rounded-md border divide-y">
              {filtered.map(s => (
                <button
                  key={s.id}
                  onClick={() => { onAdd(s.id); onSearchChange("") }}
                  className="w-full flex items-center justify-between px-3 py-3 text-sm text-left hover:bg-muted/50 active:bg-muted transition-colors touch-manipulation"
                >
                  <span className="font-medium">{s.first_name} {s.last_name}</span>
                  <Badge variant="outline" className="text-xs hidden sm:inline-flex">{s.current_class}</Badge>
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
            Máximo alcanzado ({q.max}).
          </div>
        )}

        {isBullying && selected.length > 0 && (
          <div className="pt-2 border-t space-y-2">
            <p className="text-xs font-medium text-muted-foreground">¿Con qué frecuencia? (opcional)</p>
            <div className="flex flex-wrap gap-1.5">
              {FREQUENCY_OPTIONS.map(freq => (
                <button
                  key={freq}
                  type="button"
                  onClick={() => onMetadataChange({ ...metadata, frequency: metadata?.frequency === freq ? undefined : freq })}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    metadata?.frequency === freq
                      ? "bg-red-500 text-white border-red-500"
                      : "text-muted-foreground border-border hover:bg-muted/50"
                  }`}
                >
                  {freq}
                </button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
