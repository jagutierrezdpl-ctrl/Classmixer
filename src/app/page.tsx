import Link from "next/link"
import {
  GraduationCap, Network, BarChart3, Shield, Users, Zap,
  CheckCircle, ArrowRight, FileSpreadsheet,
  Brain, ClipboardList, Lock, Sparkles, AlertTriangle,
  TableProperties, UserCheck, BookOpen, Eye, FileText, ShieldAlert,
  SplitSquareHorizontal, RefreshCw, Bell, Pencil,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import LogoBrand from "@/components/ui/LogoBrand"
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
    desc: "Grafo visual con Cytoscape. Detecta aislados, líderes, puentes y subgrupos. Clasificación CDC automática con z-scores (zSP, zSI).",
  },
  {
    icon: Brain,
    title: "Análisis con IA",
    desc: "El motor calcula métricas precisas (CIVSOC, CDC). La IA redacta diagnósticos clínicos, fichas individuales de riesgo y recomendaciones de mezcla con nombres reales.",
  },
  {
    icon: ClipboardList,
    title: "Motor de reglas pedagógicas",
    desc: "9 tipos de reglas con prioridad configurable. El análisis sociométrico propone reglas automáticamente — el docente las revisa y acepta con un clic.",
  },
  {
    icon: FileText,
    title: "4 informes PDF diferenciados",
    desc: "Sociograma (con CDC y análisis de puentes), convivencia, orientación (con sociograma de rechazos) y tutores. Más informe individual por alumno.",
  },
  {
    icon: Shield,
    title: "Privacidad por diseño",
    desc: "Acceso por rol diferenciado. Los alumnos nunca ven datos de otros. Datos de rechazo visibles solo para orientación y dirección. Auditoría completa.",
  },
  {
    icon: SplitSquareHorizontal,
    title: "Comparador de propuestas",
    desc: "Compara dos distribuciones lado a lado: diferencias por clase, scores social y académico, alumnos movidos. Elige con criterio, no por intuición.",
  },
  {
    icon: Pencil,
    title: "Anotaciones y fichas de intervención",
    desc: "El orientador añade notas privadas en el sociograma (sin acción, en seguimiento, intervención activa) y genera fichas de intervención imprimibles para alumnos de riesgo.",
  },
  {
    icon: RefreshCw,
    title: "Seguimiento post-mezcla",
    desc: "Lanza un cuestionario sociométrico al curso siguiente sobre las mismas clases formadas. Verifica si la mezcla logró sus objetivos con datos reales.",
  },
]

const SOCIOGRAM_DETECTIONS = [
  "Clasificación CDC: Popular, Rechazado, Ignorado, Controvertido, Promedio",
  "Riesgo de acoso — rechazo activo ≥5 nominaciones (alerta urgente)",
  "Alumnos puente entre comunidades (betweenness Brandes dirigido)",
  "Relaciones recíprocas y unilaterales por tipo",
  "Subgrupos y comunidades detectados (Louvain)",
  "Dependencias de un único vínculo afectivo",
  "Índices CIVSOC: cohesión, disociación, coherencia, intensidad",
]

const RULE_TYPES = [
  "No juntar a dos alumnos (obligatoria o recomendada)",
  "Mantener juntos — ancla afectiva de alumno vulnerable",
  "Al menos uno del grupo de referencia",
  "Bloquear alumno en clase concreta",
  "Máximo N de un subgrupo cerrado",
  "Proteger alumno vulnerable o rechazado",
  "Reglas propuestas automáticamente por el análisis",
]

const STATS = [
  { value: "5", label: "estatus CDC (Coie-Dodge, 1982)" },
  { value: "4", label: "informes PDF diferenciados por rol" },
  { value: "9", label: "módulos y funcionalidades integradas" },
  { value: "100%", label: "supervisión humana en cada decisión" },
]

const BEFORE_AFTER = [
  {
    before: "Hojas de cálculo sin visibilidad social",
    after: "Sociograma interactivo con alertas automáticas",
  },
  {
    before: "Alumno rechazado confundido con tímido o aislado",
    after: "Diagnóstico CDC diferenciado: rechazado activo vs. ignorado pasivo",
  },
  {
    before: "Criterios subjetivos sin documentar",
    after: "Reglas pedagógicas explícitas propuestas por el análisis",
  },
  {
    before: "Una propuesta de mezcla sin métricas",
    after: "Varias propuestas comparadas con puntuación multidimensional",
  },
  {
    before: "Alumnos aislados descubiertos semanas después",
    after: "Detección automática antes de la mezcla con acción recomendada",
  },
  {
    before: "Reglas de mezcla creadas a mano tras leer informes",
    after: "Reglas sugeridas por el análisis — aplica todas con un clic",
  },
  {
    before: "Sin trazabilidad de las decisiones tomadas",
    after: "Auditoría completa de cada acción del equipo",
  },
  {
    before: "Sin forma de saber si la mezcla funcionó al año siguiente",
    after: "Cuestionario de seguimiento post-mezcla para validar el impacto con datos reales",
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
      "Exporta informe ejecutivo en PDF para dirección",
      "Ve el historial de decisiones del equipo",
      "Notificaciones automáticas al generarse propuestas o detectarse riesgos",
    ],
  },
  {
    icon: Eye,
    role: "Orientador",
    color: "violet",
    benefits: [
      "Diagnóstico CDC completo con z-scores por alumno",
      "Alertas de rechazo activo y riesgo de acoso escolar",
      "Informe de orientación con sociograma de rechazos",
      "Registro automático de cada acceso a datos sensibles",
      "Anotaciones privadas en el sociograma con estado de seguimiento",
      "Ficha de intervención imprimible para alumnos de riesgo",
    ],
  },
  {
    icon: BookOpen,
    role: "Tutor",
    color: "emerald",
    benefits: [
      "Ve solo los alumnos de sus grupos",
      "Añade observaciones y reglas entre alumnos",
      "Informe de tutoría con relaciones sociales por alumno",
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
            <LogoBrand size="sm" />
            <span className="font-bold text-lg tracking-tight">ClassMixer</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-500">
            <a href="#como-funciona" className="hover:text-gray-900 transition-colors">Cómo funciona</a>
            <a href="#sociograma" className="hover:text-gray-900 transition-colors">Sociograma</a>
            <a href="#ia" className="hover:text-gray-900 transition-colors">Análisis IA</a>
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
            Análisis CDC + IA integrada · Diseñado para equipos docentes
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6 max-w-4xl mx-auto leading-[1.08] text-gray-900">
            Mezcla clases con{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              datos reales
            </span>{" "}
            y supervisión docente
          </h1>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            ClassMixer combina sociogramas científicos (CDC Coie-Dodge), análisis con IA
            y criterios pedagógicos para distribuir el alumnado de forma equilibrada,
            transparente y revisable.
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
                ¿Tu equipo confunde alumnos rechazados con alumnos tímidos?
              </p>
              <p className="text-sm text-amber-700 leading-relaxed">
                Un alumno rechazado activamente (CDC) no es simplemente tímido o con pocos amigos:
                recibe nominaciones explícitas de rechazo del grupo. Sin datos sociométricos,
                esta diferencia clínica pasa desapercibida hasta que es tarde.
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
            { n: "02", title: "Lanza el cuestionario", desc: "Genera un enlace único por alumno. Compatible con Google Workspace. Recoge elecciones positivas y negativas." },
            { n: "03", title: "Analiza con IA y sociograma", desc: "El algoritmo clasifica CDC, detecta rechazados activos y propone reglas. La IA redacta el diagnóstico con nombres." },
            { n: "04", title: "Genera y aprueba la mezcla", desc: "El algoritmo propone distribuciones respetando todas las reglas. Revisas, ajustas y exportas 4 informes PDF." },
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
          <p className="text-indigo-600 text-sm font-semibold tracking-widest uppercase mb-3">Sociograma científico</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Más allá del grafo — diagnóstico CDC
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto">
            El sociograma calcula z-scores de preferencia social (zSP) e impacto social (zSI)
            para clasificar a cada alumno según el modelo Coie-Dodge de 1982 —
            el estándar de referencia en psicología del desarrollo.
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          <SociogramIllustration />
        </div>

        {/* CDC statuses explanation */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { status: "Popular", color: "bg-green-50 border-green-200 text-green-800", desc: "Alto agrado, baja conflictividad" },
            { status: "Rechazado", color: "bg-red-50 border-red-200 text-red-800", desc: "Nominaciones de rechazo activo" },
            { status: "Ignorado", color: "bg-slate-50 border-slate-200 text-slate-700", desc: "Invisible para el grupo" },
            { status: "Controvertido", color: "bg-amber-50 border-amber-200 text-amber-800", desc: "Alto impacto polarizador" },
            { status: "Promedio", color: "bg-blue-50 border-blue-200 text-blue-700", desc: "Posición social estable" },
          ].map(s => (
            <div key={s.status} className={`rounded-xl border p-3 text-center text-xs ${s.color}`}>
              <p className="font-bold mb-1">{s.status}</p>
              <p className="opacity-80">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* AI Analysis section */}
      <section id="ia" className="bg-gray-50 border-y py-14">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className="text-indigo-600 text-sm font-semibold tracking-widest uppercase mb-3">Análisis con IA</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              El algoritmo calcula. La IA explica. El docente decide.
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              Un sistema de tres capas donde los datos matemáticos y la narrativa clínica
              se combinan para producir recomendaciones accionables — no solo números.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
            {[
              {
                n: "1",
                color: "indigo",
                title: "Motor algorítmico",
                icon: BarChart3,
                items: [
                  "z-scores CDC (zSP, zSI, zLM, zLL)",
                  "Betweenness Brandes dirigido",
                  "Detección de comunidades Louvain",
                  "Índices CIVSOC del grupo",
                  "Alertas de rechazo activo (≥5 nominaciones)",
                ],
              },
              {
                n: "2",
                color: "violet",
                title: "Capa de IA",
                icon: Brain,
                items: [
                  "Diagnóstico cualitativo del clima social",
                  "Fichas individuales de alumnos de riesgo",
                  "Perfil reactivo vs. víctima pasiva",
                  "Recomendaciones de mezcla con nombres",
                  "Párrafo de contexto clínico para orientación",
                ],
              },
              {
                n: "3",
                color: "emerald",
                title: "Mezcla inteligente",
                icon: Sparkles,
                items: [
                  "Restricciones duras y blandas por análisis",
                  "Reglas propuestas automáticamente",
                  "El docente aprueba con un clic",
                  "Algoritmo ejecuta respetando las reglas",
                  "Sociograma futuro simulado por propuesta",
                ],
              },
            ].map(layer => {
              const colorMap: Record<string, { bg: string; border: string; badge: string; icon: string; text: string }> = {
                indigo: { bg: "bg-white", border: "border-indigo-100", badge: "bg-indigo-600 text-white", icon: "bg-indigo-50 text-indigo-600", text: "text-indigo-600" },
                violet: { bg: "bg-white", border: "border-violet-100", badge: "bg-violet-600 text-white", icon: "bg-violet-50 text-violet-600", text: "text-violet-600" },
                emerald: { bg: "bg-white", border: "border-emerald-100", badge: "bg-emerald-600 text-white", icon: "bg-emerald-50 text-emerald-600", text: "text-emerald-600" },
              }
              const c = colorMap[layer.color]
              return (
                <div key={layer.n} className={`rounded-2xl border ${c.border} ${c.bg} shadow-sm p-6`}>
                  <div className="flex items-center gap-3 mb-5">
                    <span className={`w-7 h-7 rounded-full ${c.badge} flex items-center justify-center text-xs font-bold shrink-0`}>{layer.n}</span>
                    <div className={`w-8 h-8 rounded-lg ${c.icon} flex items-center justify-center`}>
                      <layer.icon className="w-4 h-4" />
                    </div>
                    <h3 className="font-bold text-gray-900">{layer.title}</h3>
                  </div>
                  <ul className="space-y-2">
                    {layer.items.map(item => (
                      <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
                        <CheckCircle className={`w-4 h-4 ${c.text} shrink-0 mt-0.5`} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>

          {/* Reports highlight */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <FileText className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-gray-900">4 informes PDF diferenciados por rol</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  title: "Informe de sociograma",
                  audience: "Dirección / Admin",
                  color: "border-indigo-200 bg-indigo-50",
                  items: ["Métricas CIVSOC del grupo", "Clasificación CDC completa", "Análisis de alumnos puente", "Análisis de rechazo activo"],
                },
                {
                  title: "Informe de orientación",
                  audience: "Orientador",
                  color: "border-violet-200 bg-violet-50",
                  items: ["Sociograma de rechazos activos", "Fichas individuales de riesgo", "Alertas de bullying (≥5 rechazos)", "Datos muy sensibles restringidos"],
                },
                {
                  title: "Informe de convivencia",
                  audience: "Orientador / Admin",
                  color: "border-rose-200 bg-rose-50",
                  items: ["Subgrupos conflictivos detectados", "Relaciones de tensión entre alumnos", "Índices de disociación grupal", "Comparativa por clase de origen"],
                },
                {
                  title: "Informe de tutoría",
                  audience: "Tutor",
                  color: "border-emerald-200 bg-emerald-50",
                  items: ["Listado por clase asignada", "Nivel académico y conducta", "Relaciones sociales del alumno", "Solo datos de su grupo"],
                },
              ].map(report => (
                <div key={report.title} className={`rounded-xl border p-4 ${report.color}`}>
                  <p className="font-semibold text-sm text-gray-900 mb-0.5">{report.title}</p>
                  <p className="text-xs text-muted-foreground mb-3">{report.audience}</p>
                  <ul className="space-y-1.5">
                    {report.items.map(item => (
                      <li key={item} className="text-xs text-gray-600 flex items-start gap-1.5">
                        <span className="mt-1 w-1 h-1 rounded-full bg-gray-400 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Dashboard Preview Charts */}
      <section className="py-14">
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

      {/* Comparator + Follow-up callout */}
      <section className="max-w-6xl mx-auto px-6 py-14">
        <div className="grid lg:grid-cols-2 gap-5">
          <div className="rounded-2xl border border-indigo-100 bg-white shadow-sm p-7 flex gap-5">
            <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
              <SplitSquareHorizontal className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-xs font-semibold tracking-widest uppercase text-indigo-600 mb-1">Comparador lado a lado</p>
              <h3 className="font-bold text-gray-900 mb-2">Elige la propuesta con datos, no con intuición</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Selecciona dos propuestas y compara en paralelo: score social, score académico, alumnos movidos por clase y diferencias de asignación. La decisión final siempre es tuya.
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-white shadow-sm p-7 flex gap-5">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
              <RefreshCw className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-semibold tracking-widest uppercase text-emerald-600 mb-1">Seguimiento post-mezcla</p>
              <h3 className="font-bold text-gray-900 mb-2">Valida el impacto un curso después</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Lanza un proceso de seguimiento sobre las clases ya formadas. Un nuevo cuestionario sociométrico muestra si las relaciones mejoraron y si los alumnos aislados se integraron.
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-violet-100 bg-white shadow-sm p-7 flex gap-5">
            <div className="w-11 h-11 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center shrink-0">
              <Pencil className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <p className="text-xs font-semibold tracking-widest uppercase text-violet-600 mb-1">Anotaciones del orientador</p>
              <h3 className="font-bold text-gray-900 mb-2">Capa privada sobre el sociograma</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                El orientador anota observaciones directamente sobre cada nodo del sociograma, asigna un estado de seguimiento y genera fichas de intervención imprimibles para alumnos de riesgo.
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-white shadow-sm p-7 flex gap-5">
            <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-semibold tracking-widest uppercase text-amber-600 mb-1">Notificaciones en tiempo real</p>
              <h3 className="font-bold text-gray-900 mb-2">El equipo siempre al día</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Alertas automáticas cuando se generan propuestas, se detecta un riesgo de acoso o el cuestionario supera el 80% de participación. Sin necesidad de entrar a revisar manualmente.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* For whom */}
      <section id="roles" className="bg-gray-50 border-y py-14">
        <div className="max-w-6xl mx-auto px-6">
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
                  <h3 className="font-bold text-gray-900 mb-4 text-lg">{r.role}</h3>
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
        </div>
      </section>

      {/* Features grid */}
      <section className="py-14">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className="text-indigo-600 text-sm font-semibold tracking-widest uppercase mb-3">Funcionalidades</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Todo lo que necesitas</h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              Una plataforma completa para análisis sociométrico científico y organización escolar.
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
      <section className="bg-gray-50 border-y py-14">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-8">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-200 bg-indigo-50 text-sm text-indigo-700 font-medium mb-6">
                <Network className="w-3.5 h-3.5" />
                Sociograma científico
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                Diagnóstico clínico, no solo un grafo
              </h3>
              <p className="text-gray-500 text-sm leading-relaxed mb-8">
                Más allá de visualizar relaciones, el sociograma aplica metodología
                CDC (Coie, Dodge & Coppotelli, 1982) e índices CIVSOC para un
                diagnóstico diferencial preciso de cada alumno.
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
                El análisis sociométrico propone reglas automáticamente basadas en los
                datos. El docente las revisa, aprueba con un clic y el algoritmo las
                aplica en todas las propuestas de mezcla.
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
        </div>
      </section>

      {/* Bullying detection highlight */}
      <section className="max-w-5xl mx-auto px-6 py-14">
        <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-8">
          <div className="flex items-start gap-5">
            <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-xs font-semibold tracking-widest uppercase text-red-600 mb-2">Prevención del acoso escolar</p>
              <h3 className="text-2xl font-bold text-red-900 mb-3">
                Detecta el rechazo activo antes de que escale
              </h3>
              <p className="text-gray-700 leading-relaxed mb-5 max-w-2xl">
                ClassMixer diferencia entre el alumno <strong>tímido o aislado</strong> (CDC ignorado)
                y el alumno <strong>activamente rechazado</strong> (CDC rechazado) —
                una distinción clínica crítica que los métodos tradicionales no capturan.
                Cuando un alumno acumula ≥5 nominaciones de rechazo, el sistema emite una
                alerta de riesgo de exclusión severa con nombre y apellidos, antes de cualquier decisión de mezcla.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                {[
                  { label: "CDC Ignorado", desc: "Baja visibilidad. Ni elegido ni rechazado. Riesgo de soledad crónica.", color: "bg-slate-100 text-slate-700" },
                  { label: "CDC Rechazado", desc: "Nominaciones de rechazo explícitas. Riesgo de exclusión activa y acoso.", color: "bg-red-100 text-red-800" },
                  { label: "Riesgo ≥5", desc: "Alerta urgente. Protocolo de convivencia antes de la mezcla.", color: "bg-red-200 text-red-900 font-medium" },
                ].map(item => (
                  <div key={item.label} className={`rounded-lg px-4 py-3 ${item.color}`}>
                    <p className="font-semibold mb-1">{item.label}</p>
                    <p className="text-xs opacity-80">{item.desc}</p>
                  </div>
                ))}
              </div>
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
              { icon: Shield, title: "Privacidad RGPD", desc: "Datos de menores con acceso restringido por rol. Los alumnos nunca ven datos de otros. Datos de rechazo solo para orientación." },
              { icon: Users, title: "Multi-rol", desc: "Director, jefe de estudios, tutor y orientador con permisos diferenciados. Los datos sensibles tienen un nivel extra de restricción." },
              { icon: Zap, title: "Auditoría completa", desc: "Toda acción sensible queda registrada con usuario, fecha y detalle. Trazabilidad total de cada decisión pedagógica." },
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
            <LogoBrand size="xs" />
            <span className="font-semibold text-gray-700">ClassMixer</span>
            <span>· Plataforma de análisis sociométrico y organización escolar</span>
          </div>
          <p>Metodología CDC (Coie-Dodge, 1982) · RGPD compliant</p>
        </div>
      </footer>
    </div>
  )
}
