"use client"

import { use, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Zap, Loader2, AlertTriangle, CheckCircle2, Brain, GraduationCap, Heart, Shield, Shuffle, Users, Hash, SlidersHorizontal, RotateCcw, Network, Sparkles, Bot } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Textarea } from "@/components/ui/textarea"
import type { AlgorithmProfile, AlgorithmWeights } from "@/types"
import { WEIGHT_PROFILES, DEFAULT_WEIGHTS, WEIGHT_LABELS, WEIGHT_TOOLTIPS } from "@/lib/algorithm/weights"
import { DEFAULT_CONSTRAINTS } from "@/lib/algorithm/heuristic"
import type { AlgorithmConstraints } from "@/lib/algorithm/heuristic"

const PROFILES: { id: Exclude<AlgorithmProfile, "personalizado">; label: string; description: string; icon: React.ElementType; color: string }[] = [
  {
    id: "equilibrado",
    label: "Equilibrado",
    description: "Balance entre todos los factores. Recomendado para la mayoría de los casos.",
    icon: Brain,
    color: "bg-blue-500",
  },
  {
    id: "social",
    label: "Social",
    description: "Prioriza las relaciones de amistad y evita el aislamiento social.",
    icon: Heart,
    color: "bg-pink-500",
  },
  {
    id: "academico",
    label: "Académico",
    description: "Maximiza el equilibrio de notas y nivel académico entre clases.",
    icon: GraduationCap,
    color: "bg-amber-500",
  },
  {
    id: "convivencia",
    label: "Convivencia",
    description: "Enfocado en separar conflictos y distribuir conducta difícil.",
    icon: Shield,
    color: "bg-green-500",
  },
]

export default function AlgorithmPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [mode, setMode] = useState<"algorithm" | "ai">("algorithm")
  const [profile, setProfile] = useState<AlgorithmProfile>("equilibrado")
  const [baseProfile, setBaseProfile] = useState<Exclude<AlgorithmProfile, "personalizado">>("equilibrado")
  const [weights, setWeights] = useState<AlgorithmWeights>(DEFAULT_WEIGHTS)
  const [constraints, setConstraints] = useState<AlgorithmConstraints>(DEFAULT_CONSTRAINTS)
  const [numProposals, setNumProposals] = useState(3)
  const [aiNumProposals, setAiNumProposals] = useState(1)
  const [aiInstructions, setAiInstructions] = useState("")
  const [useSociogram, setUseSociogram] = useState(true)
  const [running, setRunning] = useState(false)
  const [infeasibility, setInfeasibility] = useState<{ blocking_rules: string[]; explanation: string[] } | null>(null)
  const [responseCount, setResponseCount] = useState<number | null>(null)

  useEffect(() => {
    fetch(`/api/processes/${id}/responses`)
      .then(r => r.json())
      .then(d => setResponseCount(Array.isArray(d) ? d.length : (d.count ?? 0)))
      .catch(() => {})

    // Restore last-used settings from localStorage
    try {
      const saved = localStorage.getItem(`classmixer_algorithm_${id}`)
      if (saved) {
        const s = JSON.parse(saved)
        if (s.mode) setMode(s.mode)
        if (s.profile) setProfile(s.profile)
        if (s.baseProfile) setBaseProfile(s.baseProfile)
        if (s.weights) setWeights(s.weights)
        if (s.constraints) setConstraints(s.constraints)
        if (typeof s.numProposals === "number") setNumProposals(s.numProposals)
        if (typeof s.useSociogram === "boolean") setUseSociogram(s.useSociogram)
        if (typeof s.aiNumProposals === "number") setAiNumProposals(s.aiNumProposals)
      }
    } catch { /* ignore bad localStorage data */ }
  }, [id])

  function selectProfile(p: Exclude<AlgorithmProfile, "personalizado">) {
    setProfile(p)
    setBaseProfile(p)
    setWeights(WEIGHT_PROFILES[p])
  }

  function updateWeight(key: keyof AlgorithmWeights, value: number) {
    setProfile("personalizado")
    setWeights(prev => ({ ...prev, [key]: value }))
  }

  function resetToBase() {
    setProfile(baseProfile)
    setWeights(WEIGHT_PROFILES[baseProfile])
  }

  async function handleRun() {
    setRunning(true)
    setInfeasibility(null)
    // Persist settings so the proposals page can offer "back to algorithm"
    try {
      localStorage.setItem(`classmixer_algorithm_${id}`, JSON.stringify({
        mode, profile, baseProfile, weights, constraints, numProposals, useSociogram, aiNumProposals,
      }))
    } catch { /* ignore */ }
    try {
      if (mode === "ai") {
        const res = await fetch(`/api/processes/${id}/proposals/generate-ai`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ num_proposals: aiNumProposals, instructions: aiInstructions }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        toast.success(`${data.generated} propuesta${data.generated !== 1 ? "s" : ""} generadas con IA`)
        router.push(`/processes/${id}/proposals`)
        return
      }

      const effectiveWeights = useSociogram ? weights : {
        ...weights,
        avoid_isolation: 0,
        reciprocal_friendships: 0,
        chosen_friendships: 0,
        work_relations: 0,
      }
      const res = await fetch(`/api/processes/${id}/proposals/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weights: effectiveWeights, constraints, num_proposals: numProposals, use_sociogram: useSociogram }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.infeasibility) {
          setInfeasibility(data.infeasibility)
          toast.error("No se puede generar: hay reglas incompatibles")
        } else {
          throw new Error(data.error)
        }
        return
      }
      toast.success(`${data.generated} propuestas generadas correctamente`)
      router.push(`/processes/${id}/proposals`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al generar propuestas")
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/processes/${id}`}>
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Configurar algoritmo</h1>
          <p className="text-muted-foreground text-sm">
            Ajusta los criterios de mezcla y genera propuestas de distribución
          </p>
        </div>
      </div>

      {/* Mode selector */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          onClick={() => setMode("algorithm")}
          className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
            mode === "algorithm"
              ? "border-primary bg-primary/5"
              : "border-border hover:border-muted-foreground/30 hover:bg-muted/30"
          }`}
        >
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${mode === "algorithm" ? "bg-primary" : "bg-muted"}`}>
            <Zap className={`w-5 h-5 ${mode === "algorithm" ? "text-white" : "text-muted-foreground"}`} />
          </div>
          <div>
            <p className={`font-semibold text-sm ${mode === "algorithm" ? "text-primary" : ""}`}>Algoritmo heurístico</p>
            <p className="text-xs text-muted-foreground mt-0.5">Optimización automática con reglas y pesos configurables</p>
          </div>
          {mode === "algorithm" && <CheckCircle2 className="w-4 h-4 text-primary ml-auto shrink-0" />}
        </button>
        <button
          onClick={() => setMode("ai")}
          className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
            mode === "ai"
              ? "border-violet-500 bg-violet-500/5"
              : "border-border hover:border-muted-foreground/30 hover:bg-muted/30"
          }`}
        >
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${mode === "ai" ? "bg-violet-500" : "bg-muted"}`}>
            <Sparkles className={`w-5 h-5 ${mode === "ai" ? "text-white" : "text-muted-foreground"}`} />
          </div>
          <div>
            <p className={`font-semibold text-sm ${mode === "ai" ? "text-violet-700" : ""}`}>IA Copiloto</p>
            <p className="text-xs text-muted-foreground mt-0.5">La IA distribuye las clases aplicando criterios pedagógicos</p>
          </div>
          {mode === "ai" && <CheckCircle2 className="w-4 h-4 text-violet-500 ml-auto shrink-0" />}
        </button>
      </div>

      {/* AI mode card */}
      {mode === "ai" && (
        <Card className="mb-6 border-violet-200">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-violet-600" />
              <CardTitle className="text-base text-violet-800">Generación con IA</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              La IA analizará los datos del sociograma, las reglas y el perfil académico de cada alumno para proponer la distribución más equilibrada. Puedes añadir instrucciones adicionales.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Instrucciones adicionales (opcional)</Label>
              <Textarea
                placeholder="Ej: Asegúrate de que los alumnos con NEE queden distribuidos equitativamente. Prioriza mantener juntos a los que tienen relaciones recíprocas fuertes..."
                value={aiInstructions}
                onChange={e => setAiInstructions(e.target.value)}
                rows={3}
                className="text-sm resize-none"
                maxLength={1200}
              />
              <p className="text-xs text-muted-foreground text-right">{aiInstructions.length}/1200</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Número de propuestas</Label>
                <span className="text-lg font-bold text-violet-700">{aiNumProposals}</span>
              </div>
              <Slider
                min={1} max={3} step={1}
                value={[aiNumProposals]}
                onValueChange={([v]) => setAiNumProposals(v)}
                className="cursor-pointer"
              />
              <p className="text-xs text-muted-foreground">
                Máximo 3 propuestas con IA. Cada una será distinta en criterios de distribución.
              </p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
              La IA respeta las reglas obligatorias (separaciones, bloqueos de clase) pero puede no cumplir al 100% las reglas blandas. Revisa siempre el resultado.
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sociogram toggle */}
      {mode === "algorithm" && <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Network className="w-4 h-4 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">Considerar sociograma</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Usa las respuestas del cuestionario sociométrico al generar la mezcla
                </p>
              </div>
            </div>
            <Switch checked={useSociogram} onCheckedChange={setUseSociogram} />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {useSociogram && (responseCount ?? 0) > 0 && (
            <p className="text-xs text-green-700 bg-green-50 rounded px-2 py-1.5">
              {responseCount} respuestas disponibles. El algoritmo intentará preservar amistades y evitar aislamientos.
            </p>
          )}
          {useSociogram && responseCount === 0 && (
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                Sin respuestas del cuestionario. El factor social no aportará nada aunque esté activado.{" "}
                <Link href={`/processes/${id}/questionnaire`} className="underline font-medium">Ir al cuestionario →</Link>
              </p>
            </div>
          )}
          {!useSociogram && (
            <p className="text-xs text-muted-foreground">
              Solo se usarán datos académicos y demográficos. Los pesos de amistad y aislamiento se ignorarán.
            </p>
          )}
        </CardContent>
      </Card>}

      {/* Infeasibility alert */}
      {infeasibility && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-800 mb-2">Reglas incompatibles detectadas</p>
              <ul className="space-y-1">
                {infeasibility.explanation.map((msg, i) => (
                  <li key={i} className="text-sm text-red-700">{msg}</li>
                ))}
              </ul>
              <p className="text-sm text-red-600 mt-2">
                Revisa las reglas del proceso para resolver los conflictos antes de ejecutar.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Algorithm-only sections */}
      {mode === "algorithm" && <>

      {/* Profile selector */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Perfil de configuración</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {PROFILES.map(p => {
              const Icon = p.icon
              const active = profile === p.id
              return (
                <button
                  key={p.id}
                  onClick={() => selectProfile(p.id)}
                  className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-center transition-all ${
                    active
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/30 hover:bg-muted/30"
                  }`}
                >
                  {active && (
                    <CheckCircle2 className="absolute top-2 right-2 w-4 h-4 text-primary" />
                  )}
                  <div className={`w-9 h-9 rounded-lg ${p.color} flex items-center justify-center`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <p className={`text-sm font-semibold ${active ? "text-primary" : ""}`}>{p.label}</p>
                  <p className="text-xs text-muted-foreground leading-tight">{p.description}</p>
                </button>
              )
            })}
            {/* Personalizado tile */}
            <button
              onClick={() => setProfile("personalizado")}
              className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-center transition-all ${
                profile === "personalizado"
                  ? "border-primary bg-primary/5"
                  : "border-dashed border-border hover:border-muted-foreground/30 hover:bg-muted/30"
              }`}
            >
              {profile === "personalizado" && (
                <CheckCircle2 className="absolute top-2 right-2 w-4 h-4 text-primary" />
              )}
              <div className="w-9 h-9 rounded-lg bg-slate-500 flex items-center justify-center">
                <SlidersHorizontal className="w-5 h-5 text-white" />
              </div>
              <p className={`text-sm font-semibold ${profile === "personalizado" ? "text-primary" : ""}`}>Personalizado</p>
              <p className="text-xs text-muted-foreground leading-tight">Ajusta cada peso manualmente</p>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Weight sliders */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="text-base">Pesos del algoritmo</CardTitle>
              {profile === "personalizado" && (
                <button
                  onClick={resetToBase}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  title={`Restablecer a perfil "${baseProfile}"`}
                >
                  <RotateCcw className="w-3 h-3" />
                  Restablecer
                </button>
              )}
            </div>
            <span className="text-xs text-muted-foreground">0 = ignorar · 100 = máxima prioridad</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(Object.keys(weights) as (keyof AlgorithmWeights)[]).map(key => {
              const isModified = profile === "personalizado" && weights[key] !== WEIGHT_PROFILES[baseProfile][key]
              return (
                <div key={key} className={isModified ? "rounded-lg bg-blue-50 p-3 -m-3" : ""}>
                  <div className="flex justify-between items-center mb-1">
                    <label className={`text-sm font-medium ${isModified ? "text-blue-800" : ""}`}>
                      {WEIGHT_LABELS[key]}
                      {isModified && (
                        <span className="ml-2 text-xs text-blue-500">
                          (era {WEIGHT_PROFILES[baseProfile][key]})
                        </span>
                      )}
                    </label>
                    <span className={`text-sm font-bold w-8 text-right ${isModified ? "text-blue-700" : "text-primary"}`}>
                      {weights[key]}
                    </span>
                  </div>
                  <p className={`text-xs leading-snug mb-2 ${isModified ? "text-blue-600/80" : "text-muted-foreground"}`}>
                    {WEIGHT_TOOLTIPS[key]}
                  </p>
                  <Slider
                    min={0}
                    max={100}
                    step={5}
                    value={[weights[key]]}
                    onValueChange={([v]) => updateWeight(key, v)}
                    className="cursor-pointer"
                  />
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Distribution constraints */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Restricciones de distribución</CardTitle>
          <p className="text-xs text-muted-foreground">Condiciones obligatorias que el algoritmo debe cumplir al repartir alumnos</p>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Origin mix */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shuffle className="w-4 h-4 text-muted-foreground" />
                <div>
                  <Label className="text-sm font-medium">Evitar que los alumnos de la misma clase original se agrupen</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Limita cuántos alumnos de la misma clase de origen pueden coincidir en una nueva clase. Porcentaje más bajo = mezcla más intensa.
                  </p>
                </div>
              </div>
              <Switch
                checked={constraints.enforce_origin_mix}
                onCheckedChange={v => setConstraints(prev => ({ ...prev, enforce_origin_mix: v }))}
              />
            </div>
            {constraints.enforce_origin_mix && (
              <div className="pl-6 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Máximo de la misma clase original por grupo</span>
                  <span className="text-sm font-bold text-primary">{constraints.max_origin_pct}%</span>
                </div>
                <Slider
                  min={30} max={70} step={5}
                  value={[constraints.max_origin_pct]}
                  onValueChange={([v]) => setConstraints(prev => ({ ...prev, max_origin_pct: v }))}
                  className="cursor-pointer"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>30% — Mezcla máxima</span>
                  <span className="font-medium text-primary">
                    {constraints.max_origin_pct <= 40 ? "Mezcla muy intensa" :
                     constraints.max_origin_pct <= 55 ? "Equilibrada" :
                     "Mezcla suave"}
                  </span>
                  <span>70% — Mezcla mínima</span>
                </div>
                <p className="text-xs text-blue-700 bg-blue-50 rounded px-2 py-1">
                  Con el {constraints.max_origin_pct}%, como máximo el {constraints.max_origin_pct}% de una clase nueva puede provenir de la misma clase original (p.ej. máx. {Math.round(25 * constraints.max_origin_pct / 100)} de 25 alumnos).
                </p>
              </div>
            )}
          </div>

          <div className="border-t" />

          {/* Gender balance */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <div>
                  <Label className="text-sm font-medium">Equilibrio de género entre clases</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Garantiza que cada nueva clase tenga una proporción de género similar al grupo completo
                  </p>
                </div>
              </div>
              <Switch
                checked={constraints.enforce_gender_balance}
                onCheckedChange={v => setConstraints(prev => ({ ...prev, enforce_gender_balance: v }))}
              />
            </div>
            {constraints.enforce_gender_balance && (
              <div className="pl-6 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Tolerancia máxima de desviación</span>
                  <span className="text-sm font-bold text-primary">±{constraints.gender_tolerance}%</span>
                </div>
                <Slider
                  min={5} max={25} step={5}
                  value={[constraints.gender_tolerance]}
                  onValueChange={([v]) => setConstraints(prev => ({ ...prev, gender_tolerance: v }))}
                  className="cursor-pointer"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>5% — Muy estricto</span>
                  <span>25% — Flexible</span>
                </div>
                <p className="text-xs text-blue-700 bg-blue-50 rounded px-2 py-1">
                  Si el grupo tiene 50% de chicas, cada clase debe tener entre {50 - constraints.gender_tolerance}% y {Math.min(100, 50 + constraints.gender_tolerance)}% de chicas.
                </p>
              </div>
            )}
          </div>

          <div className="border-t" />

          {/* Equal class size */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-muted-foreground" />
                <div>
                  <Label className="text-sm font-medium">Igualar número de alumnos por clase</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Las clases destino deben tener el mismo número de alumnos (diferencia máxima de 1)
                  </p>
                </div>
              </div>
              <Switch
                checked={constraints.enforce_equal_size}
                onCheckedChange={v => setConstraints(prev => ({ ...prev, enforce_equal_size: v }))}
              />
            </div>
            {constraints.enforce_equal_size && (
              <p className="pl-6 text-xs text-blue-700 bg-blue-50 rounded px-2 py-1">
                Con este ajuste activo, ninguna clase puede tener más de un alumno de diferencia con las demás.
              </p>
            )}
          </div>

        </CardContent>
      </Card>

      {/* Number of proposals */}
      <Card className="mb-8">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Número de propuestas a generar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <Slider
              min={1}
              max={10}
              step={1}
              value={[numProposals]}
              onValueChange={([v]) => setNumProposals(v)}
              className="flex-1 cursor-pointer"
            />
            <span className="text-2xl font-bold text-primary w-8 text-center">{numProposals}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Más propuestas = mayor variedad para comparar, pero mayor tiempo de cómputo.
          </p>
        </CardContent>
      </Card>

      </>}

      {/* Run button */}
      <div className="flex items-center gap-4">
        <Button
          onClick={handleRun}
          disabled={running}
          size="lg"
          className={`gap-2 ${mode === "ai" ? "bg-violet-600 hover:bg-violet-700 text-white" : ""}`}
        >
          {running ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Generando propuestas...</>
          ) : mode === "ai" ? (
            <><Sparkles className="w-4 h-4" /> Generar con IA</>
          ) : (
            <><Zap className="w-4 h-4" /> Ejecutar algoritmo</>
          )}
        </Button>
        <Link href={`/processes/${id}/proposals`}>
          <Button variant="outline" size="lg">Ver propuestas existentes</Button>
        </Link>
      </div>

      <div className="mt-6 text-xs text-muted-foreground space-y-1 max-w-lg">
        <p>El algoritmo nunca toma decisiones definitivas. Todas las propuestas requieren revisión y aprobación manual.</p>
        <p>Cada generación se guarda en el historial. Las propuestas anteriores no se eliminan.</p>
      </div>
    </div>
  )
}
