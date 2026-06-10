"use client"

import { use, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Zap, Loader2, AlertTriangle, CheckCircle2, Brain, GraduationCap, Heart, Shield } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import type { AlgorithmProfile, AlgorithmWeights } from "@/types"
import { WEIGHT_PROFILES, DEFAULT_WEIGHTS, WEIGHT_LABELS } from "@/lib/algorithm/weights"

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

  const [profile, setProfile] = useState<AlgorithmProfile>("equilibrado")
  const [weights, setWeights] = useState<AlgorithmWeights>(DEFAULT_WEIGHTS)
  const [numProposals, setNumProposals] = useState(3)
  const [running, setRunning] = useState(false)
  const [infeasibility, setInfeasibility] = useState<{ blocking_rules: string[]; explanation: string[] } | null>(null)

  function selectProfile(p: Exclude<AlgorithmProfile, "personalizado">) {
    setProfile(p)
    setWeights(WEIGHT_PROFILES[p])
  }

  function updateWeight(key: keyof AlgorithmWeights, value: number) {
    setProfile("personalizado")
    setWeights(prev => ({ ...prev, [key]: value }))
  }

  async function handleRun() {
    setRunning(true)
    setInfeasibility(null)
    try {
      const res = await fetch(`/api/processes/${id}/proposals/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weights, num_proposals: numProposals }),
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
      toast.error(e instanceof Error ? e.message : "Error al ejecutar el algoritmo")
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

      {/* Profile selector */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Perfil de configuración</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
          </div>
          {profile === "personalizado" && (
            <div className="mt-3">
              <Badge variant="secondary" className="text-xs">Pesos personalizados activos</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Weight sliders */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Pesos del algoritmo</CardTitle>
            <span className="text-xs text-muted-foreground">0 = ignorar · 100 = máxima prioridad</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(Object.keys(weights) as (keyof AlgorithmWeights)[]).map(key => (
              <div key={key}>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium">{WEIGHT_LABELS[key]}</label>
                  <span className="text-sm font-bold text-primary w-8 text-right">{weights[key]}</span>
                </div>
                <Slider
                  min={0}
                  max={100}
                  step={5}
                  value={[weights[key]]}
                  onValueChange={([v]) => updateWeight(key, v)}
                  className="cursor-pointer"
                />
              </div>
            ))}
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

      {/* Run button */}
      <div className="flex items-center gap-4">
        <Button onClick={handleRun} disabled={running} size="lg" className="gap-2">
          {running ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Generando propuestas...</>
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
        <p>Las propuestas generadas reemplazarán las anteriores no aprobadas.</p>
      </div>
    </div>
  )
}
