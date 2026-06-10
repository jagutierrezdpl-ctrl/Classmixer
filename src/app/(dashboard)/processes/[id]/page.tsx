import { createClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Users, BookOpen, Network, Shield, LayoutGrid, Upload, Zap } from "lucide-react"

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

const SECTIONS = [
  { href: "students", label: "Alumnos", icon: Users, description: "Importar y gestionar el alumnado" },
  { href: "questionnaire", label: "Cuestionario", icon: BookOpen, description: "Configurar y lanzar el cuestionario sociométrico" },
  { href: "sociogram", label: "Sociograma", icon: Network, description: "Visualizar las relaciones sociales" },
  { href: "rules", label: "Reglas", icon: Shield, description: "Definir restricciones entre alumnos" },
  { href: "algorithm", label: "Algoritmo", icon: Zap, description: "Configurar criterios y ejecutar la mezcla" },
  { href: "proposals", label: "Propuestas", icon: LayoutGrid, description: "Comparar, editar y aprobar la distribución" },
]

export default async function ProcessDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await getUserProfile()
  const supabase = await createClient()

  const { data: process } = await supabase
    .from("processes")
    .select("*")
    .eq("id", id)
    .eq("center_id", profile!.center_id)
    .single()

  if (!process) notFound()

  const { count: studentCount } = await supabase
    .from("students")
    .select("id", { count: "exact", head: true })
    .eq("process_id", id)
    .eq("active", true)

  const { count: responseCount } = await supabase
    .from("responses")
    .select("id", { count: "exact", head: true })
    .eq("process_id", id)

  const { count: completedTokens } = await supabase
    .from("questionnaire_tokens")
    .select("id", { count: "exact", head: true })
    .eq("process_id", id)
    .eq("used", true)

  const st = STATUS_MAP[process.status] ?? { label: process.status, variant: "outline" as const }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/processes"><ArrowLeft className="w-4 h-4" /></Link>
          </Button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold">{process.name}</h1>
              <Badge variant={st.variant}>{st.label}</Badge>
            </div>
            <p className="text-muted-foreground text-sm">
              {process.source_level} → {process.target_level} · Curso {process.school_year}
            </p>
          </div>
        </div>
      </div>

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
            <p className="text-2xl font-bold">{completedTokens ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Cuestionarios completados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-bold">{responseCount ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Respuestas recogidas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-bold">{process.target_class_count}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Clases destino</p>
          </CardContent>
        </Card>
      </div>

      {/* Navigation sections */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

        {/* Quick import shortcut */}
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
      </div>
    </div>
  )
}
