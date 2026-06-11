import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus, FolderOpen, ArrowRight } from "lucide-react"

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

export default async function ProcessesPage() {
  const profile = await getUserProfile()
  if (!profile || !profile.center_id) redirect("/pending")
  const supabase = createServiceClient()

  const isAdmin = ["admin", "superadmin"].includes(profile.role)

  let processes: unknown[] = []

  if (isAdmin) {
    const { data } = await supabase
      .from("processes")
      .select("*")
      .eq("center_id", profile.center_id)
      .order("created_at", { ascending: false })
    processes = data ?? []
  } else {
    // Tutors and orientadors only see processes they've been assigned to
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: assignments } = await (supabase as any)
      .from("process_tutors")
      .select("process_id")
      .eq("user_id", profile.id)

    const ids = (assignments ?? []).map((a: { process_id: string }) => a.process_id)

    if (ids.length > 0) {
      const { data } = await supabase
        .from("processes")
        .select("*")
        .in("id", ids)
        .eq("center_id", profile.center_id)
        .order("created_at", { ascending: false })
      processes = data ?? []
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const active = (processes as any[]).filter(p => !["cerrado", "archivado"].includes(p.status))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const archived = (processes as any[]).filter(p => ["cerrado", "archivado"].includes(p.status))

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Procesos</h1>
          <p className="text-muted-foreground text-sm mt-1">{processes.length} procesos en total</p>
        </div>
        {isAdmin && (
          <Button asChild>
            <Link href="/processes/new">
              <Plus className="w-4 h-4" />
              Nuevo proceso
            </Link>
          </Button>
        )}
      </div>

      {processes.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium mb-1">
            {isAdmin ? "No hay procesos todavía" : "No tienes procesos asignados"}
          </p>
          <p className="text-sm mb-6">
            {isAdmin ? "Crea tu primer proceso para empezar a mezclar clases" : "El administrador del centro debe asignarte a un proceso"}
          </p>
          {isAdmin && (
            <Button asChild>
              <Link href="/processes/new">
                <Plus className="w-4 h-4" />
                Crear primer proceso
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <section className="mb-8">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Activos ({active.length})
              </h2>
              <div className="grid gap-3">
                {active.map(p => {
                  const st = STATUS_MAP[p.status] ?? { label: p.status, variant: "outline" as const }
                  return (
                    <Link key={p.id} href={`/processes/${p.id}`}>
                      <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                        <CardContent className="flex items-center justify-between p-5">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold">{p.name}</p>
                              <Badge variant={st.variant} className="text-xs">{st.label}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {p.source_level} → {p.target_level} · Curso {p.school_year}
                            </p>
                          </div>
                          <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                        </CardContent>
                      </Card>
                    </Link>
                  )
                })}
              </div>
            </section>
          )}

          {archived.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Archivados ({archived.length})
              </h2>
              <div className="grid gap-3">
                {archived.map(p => (
                  <Link key={p.id} href={`/processes/${p.id}`}>
                    <Card className="opacity-60 hover:opacity-80 hover:border-primary/30 transition-all cursor-pointer">
                      <CardContent className="flex items-center justify-between p-5">
                        <div>
                          <p className="font-medium">{p.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {p.source_level} → {p.target_level} · {p.school_year}
                          </p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
