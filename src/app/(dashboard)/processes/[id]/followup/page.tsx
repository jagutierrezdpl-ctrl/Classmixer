"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft, RefreshCw, Loader2, CheckCircle2,
  ArrowRight, Users, Network, ClipboardList,
} from "lucide-react"

interface FollowupProcess {
  id: string
  name: string
  school_year: string
  status: string
  created_at: string
}

export default function FollowupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [followups, setFollowups] = useState<FollowupProcess[]>([])
  const [loadingFollowups, setLoadingFollowups] = useState(true)
  const [processName, setProcessName] = useState("")

  useEffect(() => {
    fetch(`/api/processes/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) setProcessName(d.name ?? "")
      })
    fetch(`/api/processes?parent_id=${id}`)
      .then(r => r.ok ? r.json() : { processes: [] })
      .then(d => setFollowups(d.processes?.filter((p: FollowupProcess & { process_type?: string }) => p.process_type === "followup") ?? []))
      .finally(() => setLoadingFollowups(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleCreate() {
    setLoading(true)
    try {
      const res = await fetch(`/api/processes/${id}/followup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? "Error al crear el seguimiento")
        return
      }
      toast.success("Proceso de seguimiento creado")
      router.push(`/processes/${json.id}`)
    } finally {
      setLoading(false)
    }
  }

  const STATUS_LABEL: Record<string, string> = {
    borrador: "Borrador",
    cuestionario_abierto: "Cuestionario abierto",
    cuestionario_cerrado: "Cuestionario cerrado",
    en_analisis: "En análisis",
    propuestas_generadas: "Propuestas generadas",
    propuesta_seleccionada: "Completado",
    cerrado: "Cerrado",
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/processes/${id}`}><ArrowLeft className="w-4 h-4" /></Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold">Cuestionario de seguimiento post-mezcla</h1>
          {processName && (
            <p className="text-muted-foreground text-sm">{processName}</p>
          )}
        </div>
      </div>

      {/* Explanation */}
      <Card className="mb-6 border-blue-200 bg-blue-50">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-start gap-3">
            <RefreshCw className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <p className="font-semibold text-sm text-blue-900">¿Qué es el seguimiento post-mezcla?</p>
              <p className="text-sm text-blue-800">
                Pasado un trimestre (o un curso completo), puedes lanzar un nuevo cuestionario sociométrico
                en las clases destino para comprobar cómo ha evolucionado la integración social.
              </p>
              <ul className="text-sm text-blue-700 space-y-1 mt-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  Compara el sociograma antes y después de la mezcla
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  Detecta si los alumnos aislados han encontrado vínculos
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  Valida si las reglas docentes aplicadas fueron efectivas
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  Genera un informe de evolución social para orientación
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Existing followups */}
      {loadingFollowups ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : followups.length > 0 ? (
        <div className="mb-6">
          <h2 className="text-base font-semibold mb-3">Procesos de seguimiento existentes</h2>
          <div className="space-y-3">
            {followups.map(f => (
              <Card key={f.id} className="border-green-200">
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{f.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {f.school_year} · {STATUS_LABEL[f.status] ?? f.status}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs text-green-700 border-green-300">
                        Seguimiento
                      </Badge>
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/processes/${f.id}`}>
                          Ver <ArrowRight className="w-3 h-3 ml-1" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      {/* How it works */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Cómo funciona</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3">
            {[
              { n: 1, icon: Network, title: "Se crea un proceso nuevo", desc: "Vinculado a este proceso original. Usa las clases destino como grupos de origen." },
              { n: 2, icon: ClipboardList, title: "Lanzas el cuestionario en las nuevas clases", desc: "El alumnado ahora está mezclado. El cuestionario recoge sus nuevas relaciones." },
              { n: 3, icon: Users, title: "Comparas los sociogramas", desc: "ClassMixer te muestra la evolución: alumnos que encontraron vínculos, nuevas relaciones recíprocas, cambios en el estatus CDC." },
            ].map(step => (
              <div key={step.n} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {step.n}
                </div>
                <div>
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="text-xs text-muted-foreground">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Create button */}
      <Button
        onClick={handleCreate}
        disabled={loading}
        className="w-full"
        size="lg"
      >
        {loading ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creando proceso de seguimiento...</>
        ) : (
          <><RefreshCw className="w-4 h-4 mr-2" /> Crear proceso de seguimiento</>
        )}
      </Button>
      <p className="text-xs text-muted-foreground text-center mt-2">
        Se creará un nuevo proceso en estado Borrador vinculado a este. Podrás configurarlo y lanzarlo cuando estés listo.
      </p>
    </div>
  )
}
