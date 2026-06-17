import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { generateAISummary } from "@/lib/ai"
import { NextResponse } from "next/server"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!["admin", "superadmin"].includes(profile.role)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
  }

  const { id } = await params
  const supabase = createServiceClient()

  const { data: center } = await supabase
    .from("centers")
    .select("openrouter_api_key, openrouter_model")
    .eq("id", profile.center_id)
    .single()

  const { data: proposal } = await supabase
    .from("proposals")
    .select("*, processes(name, school_year, center_id)")
    .eq("id", id)
    .single()

  if (!proposal) return NextResponse.json({ error: "Propuesta no encontrada" }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = proposal as any
  if (p.processes?.center_id !== profile.center_id) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
  }

  // Fetch per-class metrics
  const { data: classMetrics } = await supabase
    .from("proposal_metrics")
    .select("*")
    .eq("proposal_id", id)

  const metricsRows = (classMetrics ?? []) as Record<string, string | number>[]
  const classGroups: Record<string, Record<string, string | number>> = {}
  metricsRows.forEach(row => {
    const cls = row.target_class as string
    if (!classGroups[cls]) classGroups[cls] = {}
    classGroups[cls][row.metric_key as string] = row.metric_value
  })

  const classLines = Object.entries(classGroups)
    .map(([cls, m]) =>
      `  - ${cls}: ${m.total_students ?? "?"} alumnos, nota media ${Number(m.avg_grade ?? 0).toFixed(1)}, ${m.isolated_count ?? 0} aislados, ${m.girls ?? "?"} niñas / ${m.boys ?? "?"} niños`
    ).join("\n")

  const prompt = `Eres un orientador escolar. Analiza la siguiente propuesta de distribución de clases y redacta un resumen ejecutivo en español para el equipo directivo.

Proceso: "${p.processes?.name}" (${p.processes?.school_year})
Propuesta: "${p.name}"

Puntuaciones (0-100):
- Total: ${p.score_total?.toFixed(1) ?? "N/A"}
- Social: ${p.score_social?.toFixed(1) ?? "N/A"}
- Académico: ${p.score_academic?.toFixed(1) ?? "N/A"}
- Género: ${p.score_gender?.toFixed(1) ?? "N/A"}
- Convivencia: ${p.score_behavior?.toFixed(1) ?? "N/A"}

Distribución por clase:
${classLines || "  Sin datos de métricas por clase."}

Redacta el resumen con estas tres secciones (máximo 250 palabras):
1. **Valoración general**: puntos fuertes de esta distribución
2. **Aspectos a revisar**: lo que el equipo debería comprobar antes de aprobar
3. **Recomendación**: si aconsejas aprobarla, ajustarla o compararla con otras propuestas

Tono: directo, claro, orientado a la toma de decisiones.`

  try {
    const c = center as { openrouter_api_key?: string | null; openrouter_model?: string | null } | null
    const summary = await generateAISummary(prompt, c?.openrouter_api_key, undefined, c?.openrouter_model)
    return NextResponse.json({ summary })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
