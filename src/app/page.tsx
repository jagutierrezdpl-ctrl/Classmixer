import Link from "next/link"
import {
  GraduationCap, Network, BarChart3, Shield, Users, Zap,
  CheckCircle, ArrowRight, BookOpen, FileSpreadsheet,
} from "lucide-react"
import { Button } from "@/components/ui/button"

const FEATURES = [
  {
    icon: FileSpreadsheet,
    title: "Importación desde Excel",
    desc: "Sube tu listado de alumnos con un clic. El sistema valida, detecta duplicados y te muestra un resumen antes de guardar.",
  },
  {
    icon: BookOpen,
    title: "Cuestionario sociométrico",
    desc: "Genera enlaces individuales o QR para que el alumnado responda desde cualquier dispositivo. Sin cuentas, sin instalaciones.",
  },
  {
    icon: Network,
    title: "Sociograma interactivo",
    desc: "Visualiza las relaciones sociales del grupo en un grafo. Detecta alumnos aislados, líderes y subgrupos automáticamente.",
  },
  {
    icon: Zap,
    title: "Mezcla inteligente",
    desc: "El algoritmo genera propuestas equilibradas respetando criterios académicos, sociales y las reglas definidas por el equipo docente.",
  },
  {
    icon: BarChart3,
    title: "Informes detallados",
    desc: "Exporta en PDF o Excel para dirección, tutores y orientación. Cada propuesta explica sus métricas, reglas y puntos débiles.",
  },
  {
    icon: Shield,
    title: "Privacidad por diseño",
    desc: "Los alumnos nunca ven los datos de otros. El acceso es por rol. Toda acción sensible queda registrada en el log de auditoría.",
  },
]

const STEPS = [
  { n: "01", title: "Importa tus alumnos", desc: "Sube el Excel de tu grupo. El sistema detecta errores y te muestra una vista previa antes de confirmar." },
  { n: "02", title: "Lanza el cuestionario", desc: "Configura las preguntas y genera los enlaces. Los alumnos responden en minutos desde el móvil o el ordenador." },
  { n: "03", title: "Analiza el sociograma", desc: "Ve las relaciones del grupo, detecta aislamientos y define reglas pedagógicas entre alumnos." },
  { n: "04", title: "Genera y aprueba la mezcla", desc: "El algoritmo propone varias distribuciones. Tú revisas, ajustas y apruebas. Exporta cuando estés listo." },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg">ClassMixer</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link href="/login">Iniciar sesión</Link>
            </Button>
            <Button asChild>
              <Link href="/login">
                Acceder <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border bg-muted/50 text-sm text-muted-foreground mb-6">
          <Zap className="w-3.5 h-3.5 text-primary" />
          Mezcla de clases con criterio sociométrico
        </div>
        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-6 max-w-3xl mx-auto leading-tight">
          Mezcla clases con{" "}
          <span className="text-primary">datos reales</span>{" "}
          y supervisión docente
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
          ClassMixer combina sociogramas, datos académicos y criterios pedagógicos para ayudar al equipo directivo
          a distribuir el alumnado de forma equilibrada, transparente y revisable.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button size="lg" asChild>
            <Link href="/login">
              Acceder a la plataforma <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/login">Ver demo</Link>
          </Button>
        </div>
      </section>

      {/* Steps */}
      <section className="bg-muted/30 border-y py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-3">¿Cómo funciona?</h2>
          <p className="text-muted-foreground text-center mb-12 max-w-xl mx-auto">
            Un flujo diseñado para el equipo educativo, no para ingenieros.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map(step => (
              <div key={step.n} className="bg-background rounded-xl border p-6">
                <div className="text-3xl font-black text-primary/20 mb-3">{step.n}</div>
                <h3 className="font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-3">Todo lo que necesitas</h2>
        <p className="text-muted-foreground text-center mb-12 max-w-xl mx-auto">
          Una plataforma completa para análisis sociométrico y organización escolar.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map(f => (
            <div key={f.title} className="rounded-xl border p-6 hover:border-primary/40 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Principles */}
      <section className="bg-primary py-20">
        <div className="max-w-4xl mx-auto px-6 text-center text-primary-foreground">
          <h2 className="text-3xl font-bold mb-4">El algoritmo propone. El docente decide.</h2>
          <p className="text-lg opacity-80 mb-10 max-w-2xl mx-auto">
            ClassMixer nunca toma una decisión definitiva sin revisión humana. Cada propuesta explica
            sus métricas, reglas cumplidas e incumplidas, y puntos débiles.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
            {[
              { icon: Shield, title: "Privacidad RGPD", desc: "Datos de menores tratados con acceso restringido y registro de actividad." },
              { icon: Users, title: "Multi-rol", desc: "Director, jefe de estudios, tutor y orientador con permisos diferenciados." },
              { icon: CheckCircle, title: "Auditoría completa", desc: "Toda acción sensible queda registrada con usuario, fecha y detalle." },
            ].map(p => (
              <div key={p.title} className="bg-white/10 rounded-xl p-5">
                <p.icon className="w-5 h-5 mb-3 opacity-80" />
                <h3 className="font-semibold mb-1">{p.title}</h3>
                <p className="text-sm opacity-70">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-2xl mx-auto px-6 py-24 text-center">
        <h2 className="text-3xl font-bold mb-4">¿Listo para empezar?</h2>
        <p className="text-muted-foreground mb-8">
          Accede a la plataforma con las credenciales de tu centro.
          Si no tienes acceso, contacta con tu administrador.
        </p>
        <Button size="lg" asChild>
          <Link href="/login">
            Iniciar sesión <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
              <GraduationCap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-foreground">ClassMixer</span>
            <span>· Plataforma de organización escolar</span>
          </div>
          <p>Diseñado para centros educativos · RGPD compliant</p>
        </div>
      </footer>
    </div>
  )
}
