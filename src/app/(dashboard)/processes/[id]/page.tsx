import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Users, BookOpen, Network, Shield, LayoutGrid, Upload, Zap, CalendarDays, MessageSquare, FileText, ArrowRight, AlertTriangle, CheckCircle2, RefreshCw, ShieldAlert } from "lucide-react"
import ProcessActions from "./ProcessActions"
import ProcessTeam from "./ProcessTeam"
import { ProcessStepper } from "@/components/processes/ProcessStepper"

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "success" | "warning" | "outline" }> = {
  borrador: { label: "Borrador", variant: "secondary" },
  cuestionario_abierto: { label: "Cuestionario abierto", variant: "success" },
  cuestionario_cerrado: { label: "Cuestionario cerrado", variant: "warning" },
  en_analisis: { label: "En análisis", variant: "warning" },
  propuestas_generadas: { label: "Propuestas generadas", variant: "default" },
  propuesta_seleccionada: { label: "Propuesta seleccionada", variant: "success" },
  cerrado: { label: "Cerrado", variant: "outline" },
  archivado: { label: "Archivado", variant: "outline" },
}

const SECTIONS_MEZCLA = [
  { href: "students", label: "Alumnos", icon: Users, description: "Importar y gestionar el alumnado" },
  { href: "questionnaire", label: "Cuestionario", icon: BookOpen, description: "Configurar y lanzar el cuestionario sociométrico" },
  { href: "responses", label: "Respuestas", icon: MessageSquare, description: "Ver quién ha respondido y sus elecciones" },
  { href: "sociogram", label: "Sociograma", icon: Network, description: "Visualizar las relaciones sociales" },
  { href: "convivencia", label: "Convivencia", icon: ShieldAlert, description: "Señales de riesgo y bullying (orientación)" },
  { href: "rules", label: "Reglas", icon: Shield, description: "Definir restricciones entre alumnos" },
  { href: "algorithm", label: "Algoritmo", icon: Zap, description: "Configurar criterios y ejecutar la mezcla" },
  { href: "proposals", label: "Propuestas", icon: LayoutGrid, description: "Comparar, editar y aprobar la distribución" },
]

const SECTIONS_SOCIOGRAMA = [
  { href: "students", label: "Alumnos", icon: Users, description: "Importar y gestionar el alumnado" },
  { href: "questionnaire", label: "Cuestionario", icon: BookOpen, description: "Configurar y lanzar el cuestionario sociométrico" },
  { href: "responses", label: "Respuestas", icon: MessageSquare, description: "Ver quién ha respondido y sus elecciones" },
  { href: "sociogram", label: "Sociograma", icon: Network, description: "Visualizar las relaciones sociales e informes" },
  { href: "convivencia", label: "Convivencia", icon: ShieldAlert, description: "Señales de riesgo y bullying (orientación)" },
]

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })
}

export default async function ProcessDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await getUserProfile()
  const supabase = createServiceClient()

  const { data: process } = await supabase
    .from("processes")
    .select("*")
    .eq("id", id)
    .eq("center_id", profile!.center_id)
    .single()

  if (!process) notFound()

  const [
    { count: studentCount },
    { count: responseCount },
    { count: completedTokens },
    { count: totalTokens },
    { count: proposalCount },
    { count: sociogramCount },
    { count: ruleCount },
  ] = await Promise.all([
    supabase.from("students").select("id", { count: "exact", head: true }).eq("process_id", id).eq("active", true),
    supabase.from("responses").select("id", { count: "exact", head: true }).eq("process_id", id),
    supabase.from("questionnaire_tokens").select("id", { count: "exact", head: true }).eq("process_id", id).eq("used", true),
    supabase.from("questionnaire_tokens").select("id", { count: "exact", head: true }).eq("process_id", id),
    supabase.from("proposals").select("id", { count: "exact", head: true }).eq("process_id", id),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("sociogram_metrics").select("id", { count: "exact", head: true }).eq("process_id", id),
    supabase.from("rules").select("id", { count: "exact", head: true }).eq("process_id", id).eq("active", true),
  ])

  const st = STATUS_MAP[process.status] ?? { label: process.status, variant: "outline" as const }
  const isAdmin = ["admin", "superadmin"].includes(profile!.role)
  const completionPct = totalTokens ? Math.round(((completedTokens ?? 0) / totalTokens) * 100) : 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isSociograma = (process as any).process_type === "sociograma"
  const SECTIONS = isSociograma ? SECTIONS_SOCIOGRAMA : SECTIONS_MEZCLA

  const approved = ["propuesta_seleccionada", "cerrado", "archivado"].includes(process.status)
  const stepperSteps = isSociograma ? [
    { label: "Alumnos", href: "students", done: (studentCount ?? 0) > 0 },
    { label: "Cuestionario", href: "questionnaire", done: (totalTokens ?? 0) > 0 },
    { label: "Respuestas", href: "responses", done: (responseCount ?? 0) > 0 },
    { label: "Sociograma", href: "sociogram", done: (sociogramCount ?? 0) > 0 },
  ] : [
    { label: "Alumnos", href: "students", done: (studentCount ?? 0) > 0 },
    { label: "Cuestionario", href: "questionnaire", done: (totalTokens ?? 0) > 0 },
    { label: "Respuestas", href: "responses", done: (responseCount ?? 0) > 0 },
    { label: "Sociograma", href: "sociogram", done: (sociogramCount ?? 0) > 0 },
    { label: "Reglas", href: "rules", done: (ruleCount ?? 0) > 0, optional: true },
    { label: "Algoritmo", href: "algorithm", done: (proposalCount ?? 0) > 0 },
    { label: "Propuestas", href: "proposals", done: approved },
  ]

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:justify-between mb-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/processes"><ArrowLeft className="w-4 h-4" /></Link>
          </Button>
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h1 className="text-2xl font-bold">{process.name}</h1>
              <Badge variant={st.variant}>{st.label}</Badge>
              {isSociograma && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Network className="w-3 h-3" /> Sociograma
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm">
              {isSociograma
                ? `${process.source_level} · Curso ${process.school_year}`
                : `${process.source_level} → ${process.target_level} · Curso ${process.school_year}`}
            </p>
          </div>
        </div>
        <ProcessActions
          processId={id}
          status={process.status}
          isAdmin={isAdmin}
        />
      </div>

      {/* Progress stepper */}
      <ProcessStepper processId={id} steps={stepperSteps} />

      {/* Smart Next Step Banner */}
      {(() => {
        if (approved) return (
          <div className="mb-6 rounded-xl border border-green-300 bg-green-50 px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
              <div>
                <p className="font-semibold text-sm text-green-900">Proceso completado — distribución aprobada</p>
                <p className="text-xs text-green-700 mt-0.5">Puedes exportar las clases finales, los informes PDF y los listados para tutores.</p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              {isAdmin && (
                <Button size="sm" variant="outline" asChild className="border-blue-300 text-blue-700 hover:bg-blue-50">
                  <Link href={`/processes/${id}/followup`}>
                    <RefreshCw className="w-3 h-3 mr-1" /> Cuestionario de seguimiento
                  </Link>
                </Button>
              )}
              <Button size="sm" variant="outline" asChild className="border-green-400 text-green-800 hover:bg-green-100">
                <Link href={`/processes/${id}/proposals`}>Ver propuesta <ArrowRight className="w-3 h-3 ml-1" /></Link>
              </Button>
            </div>
          </div>
        )
        if ((studentCount ?? 0) === 0) return (
          <div className="mb-6 rounded-xl border-2 border-blue-200 bg-blue-50 px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold shrink-0">1</div>
              <div>
                <p className="font-semibold text-sm text-blue-900">Empieza importando el alumnado</p>
                <p className="text-xs text-blue-700 mt-0.5">Sube un Excel con los datos del alumnado para comenzar el proceso.</p>
              </div>
            </div>
            <Button size="sm" asChild className="shrink-0 bg-blue-600 hover:bg-blue-700">
              <Link href={`/processes/${id}/students`}>Importar alumnos <ArrowRight className="w-3 h-3 ml-1" /></Link>
            </Button>
          </div>
        )
        if ((totalTokens ?? 0) === 0) return (
          <div className="mb-6 rounded-xl border-2 border-blue-200 bg-blue-50 px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold shrink-0">2</div>
              <div>
                <p className="font-semibold text-sm text-blue-900">Lanza el cuestionario sociométrico</p>
                <p className="text-xs text-blue-700 mt-0.5">{studentCount} alumno{(studentCount ?? 0) !== 1 ? "s" : ""} listo{(studentCount ?? 0) !== 1 ? "s" : ""}. Genera los enlaces individuales y compártelos con el alumnado.</p>
              </div>
            </div>
            <Button size="sm" asChild className="shrink-0 bg-blue-600 hover:bg-blue-700">
              <Link href={`/processes/${id}/questionnaire`}>Configurar cuestionario <ArrowRight className="w-3 h-3 ml-1" /></Link>
            </Button>
          </div>
        )
        if (completionPct < 60) return (
          <div className="mb-6 rounded-xl border-2 border-amber-200 bg-amber-50 px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <p className="font-semibold text-sm text-amber-900">Solo el {completionPct}% ha respondido — más respuestas, mejor análisis</p>
                <p className="text-xs text-amber-700 mt-0.5">{(totalTokens ?? 0) - (completedTokens ?? 0)} alumnos pendientes. Envía recordatorios para aumentar la participación.</p>
              </div>
            </div>
            <Button size="sm" variant="outline" asChild className="shrink-0 border-amber-400 text-amber-800 hover:bg-amber-100">
              <Link href={`/processes/${id}/questionnaire`}>Enviar recordatorios <ArrowRight className="w-3 h-3 ml-1" /></Link>
            </Button>
          </div>
        )
        if ((sociogramCount ?? 0) === 0 && (responseCount ?? 0) > 0) return (
          <div className="mb-6 rounded-xl border-2 border-indigo-200 bg-indigo-50 px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0">3</div>
              <div>
                <p className="font-semibold text-sm text-indigo-900">Explora el sociograma</p>
                <p className="text-xs text-indigo-700 mt-0.5">{completedTokens} respuestas recogidas ({completionPct}%). Analiza las relaciones sociales antes de mezclar las clases.</p>
              </div>
            </div>
            <Button size="sm" asChild className="shrink-0 bg-indigo-600 hover:bg-indigo-700">
              <Link href={`/processes/${id}/sociogram`}>Ver sociograma <ArrowRight className="w-3 h-3 ml-1" /></Link>
            </Button>
          </div>
        )
        if (!isSociograma && (proposalCount ?? 0) === 0) return (
          <div className="mb-6 rounded-xl border-2 border-blue-200 bg-blue-50 px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold shrink-0">4</div>
              <div>
                <p className="font-semibold text-sm text-blue-900">Ejecuta el algoritmo de mezcla</p>
                <p className="text-xs text-blue-700 mt-0.5">Configura los criterios de distribución y genera las propuestas de nuevas clases.</p>
              </div>
            </div>
            <Button size="sm" asChild className="shrink-0 bg-blue-600 hover:bg-blue-700">
              <Link href={`/processes/${id}/algorithm`}>Ejecutar algoritmo <ArrowRight className="w-3 h-3 ml-1" /></Link>
            </Button>
          </div>
        )
        if (!isSociograma && (proposalCount ?? 0) > 0) return (
          <div className="mb-6 rounded-xl border-2 border-green-200 bg-green-50 px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold shrink-0">5</div>
              <div>
                <p className="font-semibold text-sm text-green-900">{proposalCount} propuesta{(proposalCount ?? 0) > 1 ? "s" : ""} lista{(proposalCount ?? 0) > 1 ? "s" : ""} para revisar</p>
                <p className="text-xs text-green-700 mt-0.5">Compara las opciones, edítalas si es necesario y aprueba la distribución final.</p>
              </div>
            </div>
            <Button size="sm" asChild className="shrink-0 bg-green-600 hover:bg-green-700">
              <Link href={`/processes/${id}/proposals`}>Revisar propuestas <ArrowRight className="w-3 h-3 ml-1" /></Link>
            </Button>
          </div>
        )
        return null
      })()}

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-bold">{studentCount ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Alumnos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-bold">
              {completedTokens ?? 0}
              {(totalTokens ?? 0) > 0 && (
                <span className="text-sm font-normal text-muted-foreground ml-1">/ {totalTokens}</span>
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Cuestionarios {completionPct > 0 ? `(${completionPct}%)` : "completados"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-bold">{responseCount ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Respuestas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-bold">{process.target_class_count}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Clases destino</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Navigation sections */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {SECTIONS.map(({ href, label, icon: Icon, description }) => (
            <Link key={href} href={`/processes/${id}/${href}`}>
              <Card className="hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <CardTitle className="text-base">{label}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}

          {(studentCount ?? 0) === 0 && (
            <Link href={`/processes/${id}/students`}>
              <Card className="border-dashed hover:border-primary/50 transition-all cursor-pointer h-full bg-muted/30">
                <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                  <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                  <p className="font-medium text-sm">Importar alumnos</p>
                  <p className="text-xs text-muted-foreground mt-1">Empieza subiendo un Excel</p>
                </CardContent>
              </Card>
            </Link>
          )}

          {(sociogramCount ?? 0) > 0 && (
            <Link href={`/processes/${id}/sociogram/report`} target="_blank">
              <Card className="border-indigo-100 bg-indigo-50/50 hover:bg-indigo-50 hover:border-indigo-200 hover:shadow-sm transition-all cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                      <FileText className="w-4 h-4 text-indigo-600" />
                    </div>
                    <CardTitle className="text-base text-indigo-900">Informe del sociograma</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-indigo-700">Ver el informe analítico con métricas, alertas y recomendaciones</p>
                </CardContent>
              </Card>
            </Link>
          )}
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          {/* Dates */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <CalendarDays className="w-4 h-4" /> Fechas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Creado</span>
                <span>{formatDate(process.created_at)}</span>
              </div>
              {process.questionnaire_deadline && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Límite cuestionario</span>
                  <span>{formatDate(process.questionnaire_deadline)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Grupos origen</span>
                <span>{process.source_groups?.join(", ") || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Grupos destino</span>
                <span>{process.target_groups?.join(", ") || "—"}</span>
              </div>
            </CardContent>
          </Card>

          {/* Team */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="w-4 h-4" /> Equipo asignado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ProcessTeam processId={id} isAdmin={isAdmin} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
