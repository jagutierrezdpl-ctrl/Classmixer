import Link from "next/link"
import {
  GraduationCap, Network, BarChart3, Shield, Users, Zap,
  CheckCircle, ArrowRight, BookOpen, FileSpreadsheet,
  Mail, Brain, ClipboardList, Lock, Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"

const FEATURES = [
  {
    icon: FileSpreadsheet,
    title: "Importación desde Excel",
    desc: "Valida columnas, detecta duplicados y muestra distribución por género, nivel y grupo antes de confirmar. Plantilla descargable incluida.",
  },
  {
    icon: BookOpen,
    title: "Cuestionario sociométrico",
    desc: "Enlace único o QR por alumno. Compatible con Google Workspace. Recordatorios por email individuales o masivos a quienes no han respondido.",
  },
  {
    icon: Network,
    title: "Sociograma interactivo",
    desc: "Grafo visual con Cytoscape. Detecta aislados, líderes, puentes y subgrupos. Filtra por clase, género, nivel o comunidad detectada.",
  },
  {
    icon: Brain,
    title: "Algoritmo de mezcla",
    desc: "Genera varias propuestas equilibradas. Cada una incluye puntuación social, académica y de convivencia, con reglas cumplidas e incumplidas.",
  },
  {
    icon: ClipboardList,
    title: "Motor de reglas pedagógicas",
    desc: "9 tipos de reglas entre alumnos con prioridad configurable. El algoritmo las respeta y avisa si hay incompatibilidades.",
  },
  {
    icon: BarChart3,
    title: "Exportaciones completas",
    desc: "Excel con clases finales, PDF de propuestas, sociograma en PNG e informes individuales por alumno para orientación y tutores.",
  },
]

const SOCIOGRAM_DETECTIONS = [
  "Alumnos sin elecciones recibidas",
  "Relaciones recíprocas y unilaterales",
  "Líderes sociales por centralidad",
  "Alumnos puente entre grupos",
  "Subgrupos y comunidades detectadas",
  "Dependencias de un único vínculo",
  "Alumnos en riesgo de aislamiento",
]

const RULE_TYPES = [
  "No juntar a dos alumnos",
  "Mantener juntos a dos alumnos",
  "Al menos uno del grupo",
  "Bloquear alumno en clase concreta",
  "Máximo N de un grupo conflictivo",
  "Proteger alumno vulnerable",
  "Excluir de la mezcla",
]

const STATS = [
  { value: "9", label: "tipos de reglas pedagógicas" },
  { value: "7", label: "patrones sociales detectados" },
  { value: "4", label: "roles con permisos diferenciados" },
  { value: "100%", label: "supervisión humana en cada decisión" },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">

      {/* Nav */}
      <header className="border-b border-white/8 bg-[#0a0a0f]/90 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <GraduationCap className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">ClassMixer</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" className="text-white/60 hover:text-white hover:bg-white/8" asChild>
              <Link href="/login">Iniciar sesión</Link>
            </Button>
            <Button className="bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg shadow-indigo-500/25 border-0" asChild>
              <Link href="/login">
                Acceder <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px]" />
          <div className="absolute top-40 left-1/4 w-[300px] h-[300px] bg-violet-600/10 rounded-full blur-[80px]" />
          <div className="absolute top-20 right-1/4 w-[200px] h-[200px] bg-blue-600/10 rounded-full blur-[60px]" />
        </div>
        {/* Subtle grid */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{ backgroundImage: "linear-gradient(white 1px,transparent 1px),linear-gradient(90deg,white 1px,transparent 1px)", backgroundSize: "60px 60px" }}
        />

        <div className="relative max-w-6xl mx-auto px-6 py-28 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-sm text-indigo-300 mb-8">
            <Sparkles className="w-3.5 h-3.5" />
            Sociograma + algoritmo de mezcla para centros educativos
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6 max-w-4xl mx-auto leading-[1.08]">
            Mezcla clases con{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-indigo-400 bg-clip-text text-transparent">
              datos reales
            </span>{" "}
            y supervisión docente
          </h1>
          <p className="text-xl text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed">
            ClassMixer combina sociogramas interactivos, datos académicos y criterios pedagógicos
            para distribuir el alumnado de forma equilibrada, transparente y revisable.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" className="bg-indigo-500 hover:bg-indigo-400 text-white shadow-xl shadow-indigo-500/30 border-0 h-12 px-8 text-base" asChild>
              <Link href="/login">
                Acceder a la plataforma <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-white/8 bg-white/[0.02]">
        <div className="max-w-4xl mx-auto px-6 py-12 grid grid-cols-2 lg:grid-cols-4 gap-8">
          {STATS.map(s => (
            <div key={s.label} className="text-center">
              <div className="text-4xl font-black bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent mb-1">{s.value}</div>
              <div className="text-sm text-white/40 leading-snug">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Steps */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <p className="text-indigo-400 text-sm font-medium tracking-widest uppercase mb-3">Flujo de trabajo</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">¿Cómo funciona?</h2>
          <p className="text-white/40 max-w-xl mx-auto">
            Un proceso diseñado para el equipo educativo, no para ingenieros.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            {
              n: "01",
              title: "Importa tus alumnos",
              desc: "Sube el Excel del grupo. Valida errores, detecta duplicados y muestra la distribución antes de confirmar.",
            },
            {
              n: "02",
              title: "Lanza el cuestionario",
              desc: "Configura las preguntas y genera un enlace único por alumno. Envía recordatorios por email a los que no han respondido.",
            },
            {
              n: "03",
              title: "Analiza el sociograma",
              desc: "Visualiza relaciones, detecta aislados y subgrupos, y define reglas pedagógicas entre alumnos.",
            },
            {
              n: "04",
              title: "Genera y aprueba la mezcla",
              desc: "El algoritmo propone distribuciones con métricas detalladas. Revisas, ajustas y exportas.",
            },
          ].map(step => (
            <div key={step.n} className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-6 hover:border-indigo-500/40 hover:bg-white/[0.05] transition-all duration-300">
              <div className="text-5xl font-black text-white/8 mb-4 leading-none">{step.n}</div>
              <h3 className="font-semibold text-white mb-2">{step.title}</h3>
              <p className="text-sm text-white/40 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features grid */}
      <section className="border-t border-white/8 bg-white/[0.02] py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-indigo-400 text-sm font-medium tracking-widest uppercase mb-3">Funcionalidades</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Todo lo que necesitas</h2>
            <p className="text-white/40 max-w-xl mx-auto">
              Una plataforma completa para análisis sociométrico y organización escolar.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(f => (
              <div key={f.title} className="group rounded-2xl border border-white/8 bg-white/[0.03] p-6 hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all duration-300">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center mb-5 group-hover:bg-indigo-500/25 transition-colors">
                  <f.icon className="w-5 h-5 text-indigo-400" />
                </div>
                <h3 className="font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sociogram + Rules */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Sociogram */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-sm text-indigo-300 mb-6">
              <Network className="w-3.5 h-3.5" />
              Sociograma inteligente
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">
              Entiende la dinámica social de tu grupo
            </h3>
            <p className="text-white/40 text-sm leading-relaxed mb-8">
              El sociograma calcula métricas de red, detecta patrones automáticamente
              y genera alertas para que el orientador pueda actuar antes de la mezcla.
            </p>
            <div className="space-y-2.5">
              {SOCIOGRAM_DETECTIONS.map(d => (
                <div key={d} className="flex items-center gap-3 text-sm text-white/60">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                  {d}
                </div>
              ))}
            </div>
          </div>

          {/* Rules */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-sm text-violet-300 mb-6">
              <Lock className="w-3.5 h-3.5" />
              Motor de reglas pedagógicas
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">
              El criterio docente siempre tiene la última palabra
            </h3>
            <p className="text-white/40 text-sm leading-relaxed mb-8">
              Define reglas entre alumnos con diferentes niveles de prioridad.
              El algoritmo las respeta y avisa si hay reglas incompatibles.
            </p>
            <div className="space-y-2.5">
              {RULE_TYPES.map(r => (
                <div key={r} className="flex items-center gap-3 text-sm text-white/60">
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                  {r}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Principles */}
      <section className="border-t border-white/8 bg-white/[0.02] py-24">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-indigo-400 text-sm font-medium tracking-widest uppercase mb-3">Principios</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            El algoritmo propone.<br />El docente decide.
          </h2>
          <p className="text-white/40 max-w-2xl mx-auto mb-12 leading-relaxed">
            ClassMixer nunca toma una decisión definitiva sin revisión humana.
            Cada propuesta explica métricas, reglas cumplidas e incumplidas y puntos débiles.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-left">
            {[
              {
                icon: Shield,
                title: "Privacidad RGPD",
                desc: "Datos de menores con acceso restringido por rol. Los alumnos nunca ven datos de otros.",
                color: "indigo",
              },
              {
                icon: Users,
                title: "Multi-rol",
                desc: "Director, jefe de estudios, tutor y orientador con permisos diferenciados y vistas adaptadas.",
                color: "violet",
              },
              {
                icon: Zap,
                title: "Auditoría completa",
                desc: "Toda acción sensible queda registrada con usuario, fecha y detalle.",
                color: "blue",
              },
            ].map(p => (
              <div key={p.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 hover:border-white/20 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center mb-4">
                  <p.icon className="w-4.5 h-4.5 text-indigo-400" />
                </div>
                <h3 className="font-semibold text-white mb-2">{p.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden py-28">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-indigo-600/20 rounded-full blur-[100px]" />
        </div>
        <div className="relative max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">¿Listo para empezar?</h2>
          <p className="text-white/40 mb-10 leading-relaxed">
            Accede a la plataforma con las credenciales de tu centro.
            Si no tienes acceso, contacta con tu administrador.
          </p>
          <Button size="lg" className="bg-indigo-500 hover:bg-indigo-400 text-white shadow-xl shadow-indigo-500/30 border-0 h-12 px-10 text-base" asChild>
            <Link href="/login">
              Iniciar sesión <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/8 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-white/30">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded bg-indigo-500 flex items-center justify-center">
              <GraduationCap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-white/70">ClassMixer</span>
            <span>· Plataforma de organización escolar</span>
          </div>
          <p>Diseñado para centros educativos · RGPD compliant</p>
        </div>
      </footer>
    </div>
  )
}
