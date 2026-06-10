import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, logAudit } from "@/lib/auth"
import { NextResponse } from "next/server"
import { createProcessSchema } from "@/schemas"

export async function GET() {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("processes")
    .select("*")
    .eq("center_id", profile.center_id)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!["admin", "superadmin"].includes(profile.role)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createProcessSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { source_groups, target_groups, ...rest } = parsed.data

  const supabase = createServiceClient()

  // License check: max_processes
  const { getCenterLicense } = await import("@/lib/license")
  const license = await getCenterLicense(supabase, profile.center_id)
  if (license.max_processes !== null) {
    const { count } = await supabase
      .from("processes")
      .select("id", { count: "exact", head: true })
      .eq("center_id", profile.center_id)
      .not("status", "eq", "archivado")
    if ((count ?? 0) >= license.max_processes) {
      return NextResponse.json(
        { error: `Límite de procesos alcanzado (${license.max_processes}) en tu plan ${license.plan}. Archiva procesos anteriores o actualiza tu licencia.` },
        { status: 403 }
      )
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("processes")
    .insert({
      ...rest,
      source_groups: source_groups.split(",").map((s: string) => s.trim()).filter(Boolean),
      target_groups: (target_groups ?? "").split(",").map((s: string) => s.trim()).filter(Boolean),
      center_id: profile.center_id,
      created_by: profile.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit(profile.id, profile.center_id, "create_process", "process", {
    entityId: data.id,
    metadata: { name: data.name },
  })

  return NextResponse.json({ id: data.id }, { status: 201 })
}
