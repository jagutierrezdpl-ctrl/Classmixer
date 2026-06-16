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
  if (!["admin", "superadmin", "orientador"].includes(profile.role)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
  }

  const { id } = await params
  const supabase = createServiceClient()

  const { data: center } = await supabase
    .from("centers")
    .select("openrouter_api_key")
    .eq("id", profile.center_id)
    .single()

  // Fetch sociogram metrics summary
  const { data: metrics } = await supabase
    .from("sociogram_metrics")
    .select("*")
    .eq("process_id", id)

  const { data: proc } = await supabase
    .from("processes")
    .select("name, school_year")
    .eq("id", id)
    .eq("center_id", profile.center_id)
    .single()

  if (!proc) return NextResponse.json({ error: "Proceso no encontrado" }, { status: 404 })

  const rows = (metrics ?? []) as Record<string, number | string>[]
  const total = rows.length
  const isolated = rows.filter(m => (m.received_count as number) === 0).length
  const vulnerable = rows.filter(m => (m.reciprocal_count as number) === 1 && (m.received_count as number) > 0).length
  const avgReceived = total > 0
    ? (rows.reduce((s, m) => s + (m.received_count as number), 0) / total).toFixed(1)
    : "N/A"
  const avgBetweenness = total > 0
    ? (rows.reduce((s, m) => s + (m.betweenness as number), 0) / total).toFixed(3)
    : "N/A"

  const prompt = `Eres un orientador escolar experto en análisis sociométrico. Analiza los siguientes datos del sociograma del proceso "${proc.name}" (${proc.school_year}) y redacta un informe breve en español para el equipo docente.

Datos del grupo:
- Total de alumnos con métricas: ${total}
- Alumnos sin ninguna elección recibida (posible aislamiento): ${isolated}
- Alumnos con solo 1 relación recíproca (posible vulnerabilidad): ${vulnerable}
- Media de elecciones recibidas por alumno: ${avgReceived}
- Betweenness centralidad media: ${avgBetweenness}

Redacta el informe con estas tres secciones (máximo 250 palabras en total):
1. **Observaciones principales**: qué destaca del análisis social del grupo
2. **Puntos de atención**: qué situaciones merecen seguimiento del equipo orientador
3. **Recomendaciones**: acciones concretas para el momento de la mezcla de clases

Tono: profesional, objetivo, orientado a la acción docente. No uses tecnicismos innecesarios.`

  try {
    const summary = await generateAISummary(prompt, (center as { openrouter_api_key?: string | null } | null)?.openrouter_api_key)
    return NextResponse.json({ summary })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
