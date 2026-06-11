"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  GraduationCap, FileSpreadsheet, BookOpen, Network, ArrowRight, X, CheckCircle2,
} from "lucide-react"
import { Button } from "@/components/ui/button"

const STORAGE_KEY = "classmixer_onboarding_done"

const STEPS = [
  {
    icon: GraduationCap,
    title: "Bienvenido a ClassMixer",
    desc: "ClassMixer te ayuda a crear clases equilibradas combinando datos académicos, análisis sociométrico y criterios docentes. El algoritmo propone — tú decides.",
    cta: "Empezar",
    color: "bg-primary/10 text-primary",
  },
  {
    icon: FileSpreadsheet,
    title: "Crea un proceso y sube tus alumnos",
    desc: "El primer paso es crear un proceso (ej. «Mezcla 6º → 1º ESO 2025/2026») e importar el alumnado desde un Excel. Puedes descargar la plantilla desde la propia pantalla.",
    cta: "Siguiente",
    color: "bg-blue-100 text-blue-700",
  },
  {
    icon: BookOpen,
    title: "Lanza el cuestionario sociométrico",
    desc: "Configura las preguntas y genera enlaces únicos para cada alumno. Ellos responden desde cualquier dispositivo. Tú ves el progreso en tiempo real.",
    cta: "Siguiente",
    color: "bg-pink-100 text-pink-700",
  },
  {
    icon: Network,
    title: "Analiza y genera la mezcla",
    desc: "Con las respuestas del cuestionario, el sociograma se construye solo. Define las reglas pedagógicas, ejecuta el algoritmo y revisa las propuestas antes de aprobar.",
    cta: "Ir al dashboard",
    color: "bg-green-100 text-green-700",
    final: true,
  },
]

interface Props {
  userRole: string
}

export function OnboardingWizard({ userRole }: Props) {
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (!["admin", "superadmin"].includes(userRole)) return
    const done = localStorage.getItem(STORAGE_KEY)
    if (!done) setVisible(true)
  }, [userRole])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1")
    setVisible(false)
  }

  function next() {
    const current = STEPS[step]
    if (current.final) {
      dismiss()
      router.push("/processes/new")
      return
    }
    if (step < STEPS.length - 1) {
      setStep(s => s + 1)
    }
  }

  if (!visible) return null

  const current = STEPS[step]
  const Icon = current.icon

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-md p-8 relative animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={dismiss}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Progress */}
        <div className="flex gap-1.5 mb-8">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                i <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Icon */}
        <div className={`w-14 h-14 rounded-2xl ${current.color} flex items-center justify-center mb-6`}>
          <Icon className="w-7 h-7" />
        </div>

        {/* Content */}
        <h2 className="text-xl font-bold mb-3">{current.title}</h2>
        <p className="text-muted-foreground leading-relaxed mb-8">{current.desc}</p>

        {/* Step dots */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === step ? "bg-primary w-4" : i < step ? "bg-primary/40" : "bg-muted"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setStep(s => s - 1)}>
                Atrás
              </Button>
            )}
            <Button onClick={next} className="gap-1.5">
              {current.final ? (
                <><CheckCircle2 className="w-4 h-4" /> {current.cta}</>
              ) : (
                <>{current.cta} <ArrowRight className="w-4 h-4" /></>
              )}
            </Button>
          </div>
        </div>

        {step === 0 && (
          <button
            onClick={dismiss}
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground mt-4 transition-colors"
          >
            Ya conozco la plataforma, saltar introducción
          </button>
        )}
      </div>
    </div>
  )
}
