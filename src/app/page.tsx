import Link from "next/link"
import {
  GraduationCap, Network, BarChart3, Shield, Users, Zap,
  CheckCircle, ArrowRight, FileSpreadsheet,
  Brain, ClipboardList, Lock, Sparkles, AlertTriangle,
  TableProperties, UserCheck, BookOpen, Eye,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import SociogramIllustration from "@/components/landing/SociogramIllustration"
import ProposalPreviewChart from "@/components/landing/ProposalPreviewChart"

const FEATURES = [
  {
    icon: FileSpreadsheet,
    title: "Importación desde Excel",
    desc: "Valida columnas, detecta duplicados y muestra distribución por género, nivel y grupo antes de confirmar. Plantilla descargable incluida.",
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
  {
    icon: Shield,
    title: "Privacidad por diseño",
    desc: "Acceso por rol diferenciado. Los alumnos nunca ven datos de otros. Toda acción sensible queda en el log de auditoría.",
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

const BEFORE_AFTER = [
  {
    before: "Hojas de cálculo sin visibilidad social",
    after: "Sociograma interactivo con alertas automáticas",
  },
  {
    before: "Criterios subjetivos sin documentar",
    after: "Reglas pedagógicas explícitas con prioridad",
  },
  {
    before: "Una propuesta de mezcla sin métricas",
    after: "Varias propuestas comparadas con puntuación",
  },
  {
    before: "Alumnos aislados descubiertos semanas después",
    after: "Detección automática antes de la mezcla",
  },
  {
    before: "Revisión manual sin saber el impacto",
    after: "Editor con impacto en tiempo real al mover alumnos",
  },
  {
    before: "Sin trazabilidad de las decisiones tomadas",
    after: "Auditoría completa de cada acción del equipo",
  },
]

const ROLES = [
  {
    icon: UserCheck,
    role: "Director / Jefe de estudios",
    color: "indigo",
    benefits: [
      "Crea y supervisa todos los procesos de mezcla",
      "Aprueba la distribución final con un clic",
      "Exporta informes ejecutivos en PDF",
      "Ve el historial de decisiones del equipo",
    ],
  },
  {
    icon: Eye,
    role: "Orientador",
    color: "violet",
    benefits: [
      "Acceso completo al sociograma con datos sensibles",
      "Alertas de aislamiento y vulnerabilidad",
      "Informe de convivencia por alumno",
      "Registro automático de cada acceso",
    ],
  },
  {
    icon: BookOpen,
    role: "Tutor",
    color: "emerald",
    benefits: [
      "Ve solo los alumnos de sus grupos",
      "Añade observaciones y reglas entre alumnos",
      "Revisa las propuestas de su clase",
      "Descarga el listado final con un clic",
    ],
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">

      {/* Nav */}
      <header className="border-b bg-white/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-600/20">
              <GraduationCap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">ClassMixer</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-500">
            <a href="#como-funciona" className="hover:text-gray-900 transition-colors">Cómo funciona</a>
            <a href="#sociograma" className="hover:text-gray-900 transition-colors">Sociograma</a>
            <a href="#roles" className="hover:text-gray-900 transition-colors">Para quién</a>
          </nav>
          <div className="flex items-center gap-3">
            <Button variant="ghost" className="text-gray-500 hover:text-gray-900 hidden sm:flex" asChild>
              <Link href="/demo">Ver demo</Link>
            </Button>
            <Button className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 border-0" asChild>
              <Link href="/login">
                Acceder <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-white">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-indigo-50 rounded-full blur-[80px] opacity-80" />
        </div>

        <div className="relative max-w-6xl mx-auto px-6 pt-16 pb-12 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-200 bg-indigo-50 text-sm text-indigo-700 font-medium mb-8">
            <Sparkles className="w-3.5 h-3.5" />
            Diseñado para equipos docentes, no para ingenieros
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6 max-w-4xl mx-auto leading-[1.08] text-gray-900">
            Mezcla clases con{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              datos reales
            </span>{" "}
            y supervisión docente
          </h1>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            ClassMixer combina sociogramas interactivos, datos académicos y criterios pedagógicos
            para distribuir el alumnado de forma equilibrada, transparente y revisable.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-3 justify-center mb-14">
            <Button size="lg" className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-600/20 border-0 h-12 px-8 text-base" asChild>
              <Link href="/login">
                Acceder a la plataforma <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-8 text-base border-gray-200 text-gray-700 hover:bg-gray-50" asChild>
              <Link href="/demo">
                <Network className="w-4 h-4" /> Ver demo interactiva
              </Link>
            </Button>
          </div>

          {/* Pain point callout */}
          <div className="max-w-3xl mx-auto rounded-2xl border border-amber-200 bg-amber-50 p-5 text-left flex gap-4">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-900 mb-1">
                ¿Tu equipo sigue repartiendo alumnos en hojas de cálculo?
              </p>
              <p className="text-sm text-amber-700 leading-relaxed">
                Sin datos sociales, sin detección de alumnos aislados y sin forma de comparar
                alternativas — hasta que llega ClassMixer.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-8 grid grid-cols-2 lg:grid-cols-4 gap-8">
          {STATS.map(s => (
            <div key={s.label} className="text-center">
              <div className="text-4xl font-black text-indigo-600 mb-1">{s.value}</div>
              <div className="text-sm text-gray-500 leading-snug">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Steps */}
      <section id="como-funciona" className="max-w-6xl mx-auto px-6 py-14">
        <div className="text-center mb-10">
          <p className="text-indigo-600 text-sm font-semibold tracking-widest uppercase mb-3">Flujo de trabajo</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">¿Cómo funciona?</h2>
          <p className="text-gray-500 max-w-xl mx-auto">
            Un proceso diseñado para el equipo educativo, no para ingenieros.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { n: "01", title: "Importa tus alumnos", desc: "Sube el Excel del grupo. Valida errores, detecta duplicados y muestra la distribución antes de confirmar." },
            { n: "02", title: "Lanza el cuestionario", desc: "Genera un enlace único por alumno. Compatible con Google Workspace. Envía recordatorios por email." },
            { n: "03", title: "Analiza el sociograma", desc: "Visualiza relaciones, detecta aislados y subgrupos, y define reglas pedagógicas entre alumnos." },
            { n: "04", title: "Genera y aprueba la mezcla", desc: "El algoritmo propone distribuciones con métricas detalladas. Revisas, ajustas y exportas." },
          ].map(step => (
            <div key={step.n} className="rounded-2xl border border-gray-100 bg-white shadow-sm p-6 hover:shadow-md hover:border-indigo-100 transition-all duration-200">
              <div className="text-4xl font-black text-indigo-100 mb-4 leading-none">{step.n}</div>
              <h3 className="font-semibold text-gray-900 mb-2">{step.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Before / After */}
      <section className="bg-gray-50 border-y py-14">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className="text-indigo-600 text-sm font-semibold tracking-widest uppercase mb-3">Antes y después</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Lo que cambia con ClassMixer
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              De decisiones intuitivas basadas en experiencia a propuestas fundamentadas en datos.
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white shadow-sm">
            <div className="grid grid-cols-2 text-sm font-semibold">
              <div className="px-5 py-3 bg-red-50 text-red-700 border-b border-gray-200 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" /> Sin ClassMixer
              </div>
              <div className="px-5 py-3 bg-green-50 text-green-700 border-b border-gray-200 border-l flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" /> Con ClassMixer
              </div>
            </div>
            {BEFORE_AFTER.map((row, i) => (
              <div key={i} className={`grid grid-cols-2 text-sm ${i < BEFORE_AFTER.length - 1 ? "border-b border-gray-100" : ""}`}>
                <div className="px-5 py-3.5 text-gray-500 flex items-start gap-2.5">
                  <span className="text-red-400 font-bold shrink-0 mt-0.5">✗</span>
                  {row.before}
                </div>
                <div className="px-5 py-3.5 text-gray-700 border-l border-gray-100 flex items-start gap-2.5">
                  <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                  {row.after}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sociogram illustration */}
      <section id="sociograma" className="max-w-4xl mx-auto px-6 py-14">
        <div className="text-center mb-8">
          <p className="text-indigo-600 text-sm font-semibold tracking-widest uppercase mb-3">Sociograma</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Entiende las relaciones antes de mezclar
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto">
            El sociograma detecta automáticamente líderes, alumnos puente, subgrupos y
            alumnos en riesgo de aislamiento — antes de tomar ninguna decisión.
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          <SociogramIllustration />
        </div>
      </section>

      {/* Dashboard Preview Charts */}
      <section className="bg-gray-50 border-y py-14">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-8">
            <p className="text-indigo-600 text-sm font-semibold tracking-widest uppercase mb-3">Analítica</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Compara propuestas con métricas reales
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              Radar de equilibrio multidimensional, comparativa académica por clase y seguimiento de participación — todo en tiempo real.
            </p>
          </div>
          <ProposalPreviewChart />
          <p className="text-center text-xs text-gray-400 mt-4">Datos de muestra. En la plataforma se muestran los datos reales de tu centro.</p>
        </div>
      </section>

      {/* For whom */}
      <section id="roles" className="max-w-6xl mx-auto px-6 py-14">
        <div className="text-center mb-10">
          <p className="text-indigo-600 text-sm font-semibold tracking-widest uppercase mb-3">Para quién</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Cada rol, su propia experiencia
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto">
            Acceso diferenciado según el rol. Cada perfil ve lo que necesita y solo lo que puede ver.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {ROLES.map(r => {
            const colorMap: Record<string, { bg: string; border: string; text: string; icon: string }> = {
              indigo: { bg: "bg-indigo-50", border: "border-indigo-200", text: "text-indigo-700", icon: "bg-indigo-100 text-indigo-600" },
              violet: { bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-700", icon: "bg-violet-100 text-violet-600" },
              emerald: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", icon: "bg-emerald-100 text-emerald-600" },
            }
            const c = colorMap[r.color]
            return (
              <div key={r.role} className={`rounded-2xl border ${c.border} ${c.bg} p-6`}>
                <div className={`w-10 h-10 rounded-xl ${c.icon} flex items-center justify-center mb-4`}>
                  <r.icon className="w-5 h-5" />
                </div>
                <h3 className={`font-bold text-gray-900 mb-4 text-lg`}>{r.role}</h3>
                <ul className="space-y-2.5">
                  {r.benefits.map(b => (
                    <li key={b} className="flex items-start gap-2.5 text-sm text-gray-600">
                      <CheckCircle className={`w-4 h-4 ${c.text} shrink-0 mt-0.5`} />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </section>

      {/* Features grid */}
      <section className="bg-gray-50 border-y py-14">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className="text-indigo-600 text-sm font-semibold tracking-widest uppercase mb-3">Funcionalidades</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Todo lo que necesitas</h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              Una plataforma completa para análisis sociométrico y organización escolar.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(f => (
              <div key={f.title} className="group rounded-2xl border border-gray-100 bg-white shadow-sm p-6 hover:shadow-md hover:border-indigo-100 transition-all duration-200">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-5 group-hover:bg-indigo-100 transition-colors">
                  <f.icon className="w-5 h-5 text-indigo-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sociogram + Rules */}
      <section className="max-w-6xl mx-auto px-6 py-14">
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-200 bg-indigo-50 text-sm text-indigo-700 font-medium mb-6">
              <Network className="w-3.5 h-3.5" />
              Sociograma inteligente
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              Entiende la dinámica social de tu grupo
            </h3>
            <p className="text-gray-500 text-sm leading-relaxed mb-8">
              El sociograma calcula métricas de red, detecta patrones automáticamente
              y genera alertas para que el orientador pueda actuar antes de la mezcla.
            </p>
            <div className="space-y-2.5">
              {SOCIOGRAM_DETECTIONS.map(d => (
                <div key={d} className="flex items-center gap-3 text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-indigo-500 shrink-0" />
                  {d}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-200 bg-violet-50 text-sm text-violet-700 font-medium mb-6">
              <Lock className="w-3.5 h-3.5" />
              Motor de reglas pedagógicas
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              El criterio docente siempre tiene la última palabra
            </h3>
            <p className="text-gray-500 text-sm leading-relaxed mb-8">
              Define reglas entre alumnos con diferentes niveles de prioridad.
              El algoritmo las respeta y avisa si hay reglas incompatibles.
            </p>
            <div className="space-y-2.5">
              {RULE_TYPES.map(r => (
                <div key={r} className="flex items-center gap-3 text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-violet-500 shrink-0" />
                  {r}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Principles */}
      <section className="bg-gray-50 border-t py-14">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-indigo-600 text-sm font-semibold tracking-widest uppercase mb-3">Principios</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            El algoritmo propone.<br />El docente decide.
          </h2>
          <p className="text-gray-500 max-w-2xl mx-auto mb-8 leading-relaxed">
            ClassMixer nunca toma una decisión definitiva sin revisión humana.
            Cada propuesta explica métricas, reglas cumplidas e incumplidas y puntos débiles.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-left">
            {[
              { icon: Shield, title: "Privacidad RGPD", desc: "Datos de menores con acceso restringido por rol. Los alumnos nunca ven datos de otros." },
              { icon: Users, title: "Multi-rol", desc: "Director, jefe de estudios, tutor y orientador con permisos diferenciados y vistas adaptadas." },
              { icon: Zap, title: "Auditoría completa", desc: "Toda acción sensible queda registrada con usuario, fecha y detalle." },
            ].map(p => (
              <div key={p.title} className="rounded-2xl border border-gray-100 bg-white shadow-sm p-6 hover:shadow-md transition-shadow">
                <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-4">
                  <p.icon className="w-4 h-4 text-indigo-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{p.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-indigo-600 py-16">
        <div className="absolute inset-0 pointer-events-none opacity-10"
          style={{ backgroundImage: "linear-gradient(white 1px,transparent 1px),linear-gradient(90deg,white 1px,transparent 1px)", backgroundSize: "40px 40px" }}
        />
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">¿Listo para empezar?</h2>
          <p className="text-indigo-200 mb-8 leading-relaxed max-w-xl mx-auto">
            Accede a la plataforma con las credenciales de tu centro.
            Si no tienes acceso, contacta con tu administrador.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" className="bg-white text-indigo-600 hover:bg-indigo-50 border-0 h-12 px-10 text-base font-semibold shadow-xl" asChild>
              <Link href="/login">
                Iniciar sesión <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-8 text-base border-white/30 text-white hover:bg-white/10 bg-transparent" asChild>
              <Link href="/demo">
                <TableProperties className="w-4 h-4" /> Ver demo interactiva
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center">
              <GraduationCap className="w-3 h-3 text-white" />
            </div>
            <span className="font-semibold text-gray-700">ClassMixer</span>
            <span>· Plataforma de organización escolar</span>
          </div>
          <p>Diseñado para centros educativos · RGPD compliant</p>
        </div>
      </footer>
    </div>
  )
}
