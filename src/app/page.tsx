import Link from "next/link"
import {
  GraduationCap, Network, BarChart3, Shield, Users, Zap,
  CheckCircle, ArrowRight, BookOpen, FileSpreadsheet,
  Mail, Brain, ClipboardList, Eye, AlertTriangle, Lock,
} from "lucide-react"
import { Button } from "@/components/ui/button"

const FEATURES = [
  {
    icon: FileSpreadsheet,
    title: "Importación desde Excel",
    desc: "Sube tu listado de alumnos con un clic. El sistema valida columnas, detecta duplicados y muestra un resumen con distribución por género, nivel y grupo antes de confirmar.",
  },
  {
    icon: BookOpen,
    title: "Cuestionario sociométrico",
    desc: "Genera un enlace único o QR para cada alumno. Compatible con Google Workspace: los alumnos acceden con su cuenta del centro. Envía recordatorios por email a quienes no han respondido.",
  },
  {
    icon: Network,
    title: "Sociograma interactivo",
    desc: "Grafo visual con Cytoscape. Detecta alumnos aislados, líderes sociales, alumnos puente, subgrupos cerrados y dependencias. Filtra por clase, género, nivel o comunidad.",
  },
  {
    icon: Brain,
    title: "Algoritmo de mezcla",
    desc: "Genera varias propuestas equilibradas aplicando tus reglas. Cada propuesta incluye puntuación social, académica, de convivencia y de género, con las reglas cumplidas e incumplidas.",
  },
  {
    icon: ClipboardList,
    title: "Motor de reglas pedagógicas",
    desc: "Define reglas entre alumnos: no juntar, mantener juntos, bloquear en clase, proteger al alumno vulnerable, limitar alumnos de un grupo conflictivo. 9 tipos de reglas con prioridad.",
  },
  {
    icon: BarChart3,
    title: "Informes y exportaciones",
    desc: "Exporta en Excel o PDF. Informes por propuesta con métricas detalladas, sociograma en PNG, informes individuales por alumno e informes para orientación.",
  },
  {
    icon: Mail,
    title: "Recordatorios por email",
    desc: "Envía recordatorios a todos los alumnos pendientes o a uno en concreto. El email incluye su enlace personal. Integrado con Gmail y Google Workspace.",
  },
  {
    icon: Eye,
    title: "Análisis de respuestas",
    desc: "Visualiza el estado de participación en tiempo real: completados, pendientes, porcentaje por clase. Filtra, ordena y exporta el listado de pendientes.",
  },
  {
    icon: Shield,
    title: "Privacidad por diseño",
    desc: "Los alumnos nunca ven datos de otros. Acceso por rol (director, tutor, orientador). Toda acción sensible queda registrada en el log de auditoría con usuario, fecha y detalle.",
  },
]

const STEPS = [
  {
    n: "01",
    title: "Importa tus alumnos",
    desc: "Sube el Excel del grupo. El sistema valida errores, detecta duplicados y muestra la distribución antes de confirmar. También puedes cargar desde el registro central del centro.",
  },
  {
    n: "02",
    title: "Lanza el cuestionario",
    desc: "Configura las preguntas (amistad, trabajo, apoyo emocional) y genera un enlace único por alumno. Envía recordatorios por email a los que no han respondido.",
  },
  {
    n: "03",
    title: "Analiza el sociograma",
    desc: "Visualiza las relaciones del grupo, detecta aislados y subgrupos, y define reglas pedagógicas entre alumnos. El sistema genera alertas automáticas de riesgo social.",
  },
  {
    n: "04",
    title: "Genera y aprueba la mezcla",
    desc: "El algoritmo propone varias distribuciones con métricas detalladas. Revisas, ajustas y apruebas. Exporta en Excel o PDF cuando estés listo.",
  },
]

const SOCIOGRAM_DETECTIONS = [
  "Alumnos sin elecciones recibidas",
  "Relaciones recíprocas y unilaterales",
  "Líderes sociales por centralidad",
  "Alumnos puente entre grupos",
  "Subgrupos y comunidades",
  "Dependencias de un único vínculo",
  "Alumnos en riesgo de aislamiento",
]

const RULE_TYPES = [
  "No juntar a dos alumnos",
  "Mantener juntos a dos alumnos",
  "Mantener al menos uno del grupo",
  "Bloquear alumno en clase concreta",
  "Máximo N de un grupo conflictivo",
  "Proteger alumno vulnerable",
  "Excluir de la mezcla",
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
          Sociograma + algoritmo de mezcla para centros educativos
        </div>
        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-6 max-w-3xl mx-auto leading-tight">
          Mezcla clases con{" "}
          <span className="text-primary">datos reales</span>{" "}
          y supervisión docente
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
          ClassMixer combina sociogramas interactivos, datos académicos y criterios pedagógicos
          para ayudar al equipo directivo a distribuir el alumnado de forma equilibrada,
          transparente y revisable.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button size="lg" asChild>
            <Link href="/login">
              Acceder a la plataforma <ArrowRight className="w-4 h-4" />
            </Link>
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

      {/* Features grid */}
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

      {/* Sociogram detail */}
      <section className="bg-muted/30 border-y py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border bg-background text-sm text-muted-foreground mb-6">
                <Network className="w-3.5 h-3.5 text-primary" />
                Sociograma inteligente
              </div>
              <h2 className="text-3xl font-bold mb-4">
                Entiende la dinámica social de tu grupo
              </h2>
              <p className="text-muted-foreground mb-8 leading-relaxed">
                El sociograma no es solo un grafo. ClassMixer calcula métricas de red,
                detecta patrones automáticamente y genera alertas para que el orientador
                y el tutor puedan actuar antes de la mezcla.
              </p>
              <div className="space-y-2">
                {SOCIOGRAM_DETECTIONS.map(d => (
                  <div key={d} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                    <span>{d}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border bg-background text-sm text-muted-foreground mb-6">
                <Lock className="w-3.5 h-3.5 text-primary" />
                Motor de reglas pedagógicas
              </div>
              <h2 className="text-3xl font-bold mb-4">
                El criterio docente siempre tiene la última palabra
              </h2>
              <p className="text-muted-foreground mb-8 leading-relaxed">
                Define reglas entre alumnos con diferentes niveles de prioridad.
                El algoritmo las respeta al generar las propuestas y avisa si
                hay reglas incompatibles.
              </p>
              <div className="space-y-2">
                {RULE_TYPES.map(r => (
                  <div key={r} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                    <span>{r}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Principles */}
      <section className="bg-primary py-20">
        <div className="max-w-4xl mx-auto px-6 text-center text-primary-foreground">
          <h2 className="text-3xl font-bold mb-4">El algoritmo propone. El docente decide.</h2>
          <p className="text-lg opacity-80 mb-10 max-w-2xl mx-auto">
            ClassMixer nunca toma una decisión definitiva sin revisión humana. Cada propuesta explica
            sus métricas, reglas cumplidas e incumplidas, alumnos vulnerables y puntos débiles.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
            {[
              {
                icon: Shield,
                title: "Privacidad RGPD",
                desc: "Datos de menores tratados con acceso restringido por rol. Los alumnos nunca ven datos de otros.",
              },
              {
                icon: Users,
                title: "Multi-rol",
                desc: "Director, jefe de estudios, tutor y orientador con permisos diferenciados y vistas adaptadas.",
              },
              {
                icon: AlertTriangle,
                title: "Auditoría completa",
                desc: "Toda acción sensible queda registrada con usuario, fecha y detalle. Exportable para inspección.",
              },
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
