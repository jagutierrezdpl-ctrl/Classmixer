import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { NextResponse } from "next/server"
import { z } from "zod"

const CreateCenterSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
})

export async function GET() {
  const profile = await getUserProfile()
  if (!profile || profile.role !== "superadmin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const supabase = createServiceClient()

  const { data: centers, error } = await supabase
    .from("centers")
    .select("*")
    .order("created_at", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Count users and processes per center
  const centerIds = (centers ?? []).map(c => c.id)
  const [{ data: userCounts }, { data: processCounts }] = await Promise.all([
    supabase
      .from("users")
      .select("center_id")
      .in("center_id", centerIds.length > 0 ? centerIds : ["__none__"]),
    supabase
      .from("processes")
      .select("center_id")
      .in("center_id", centerIds.length > 0 ? centerIds : ["__none__"]),
  ])

  const userMap: Record<string, number> = {}
  const processMap: Record<string, number> = {}
  for (const u of (userCounts ?? [])) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    userMap[(u as any).center_id] = (userMap[(u as any).center_id] ?? 0) + 1
  }
  for (const p of (processCounts ?? [])) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    processMap[(p as any).center_id] = (processMap[(p as any).center_id] ?? 0) + 1
  }

  const enriched = (centers ?? []).map(c => ({
    ...c,
    user_count: userMap[c.id] ?? 0,
    process_count: processMap[c.id] ?? 0,
  }))

  return NextResponse.json(enriched)
}

export async function POST(request: Request) {
  const profile = await getUserProfile()
  if (!profile || profile.role !== "superadmin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = CreateCenterSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("centers")
    .insert(parsed.data)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data, { status: 201 })
}
