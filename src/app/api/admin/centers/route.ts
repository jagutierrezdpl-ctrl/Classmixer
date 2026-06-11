import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { NextResponse } from "next/server"
import { z } from "zod"

const CreateCenterSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  admin_name: z.string().min(1, "El nombre del administrador es obligatorio"),
  admin_email: z.string().email("Email del administrador no válido"),
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

  const centerIds = (centers ?? []).map(c => c.id)
  const safeIds = centerIds.length > 0 ? centerIds : ["__none__"]

  const [{ data: userCounts }, { data: processCounts }, { data: lastActivity }] = await Promise.all([
    supabase.from("users").select("center_id").in("center_id", safeIds),
    supabase.from("processes").select("center_id").in("center_id", safeIds),
    supabase.from("audit_logs")
      .select("center_id, created_at")
      .in("center_id", safeIds)
      .order("created_at", { ascending: false }),
  ])

  const userMap: Record<string, number> = {}
  const processMap: Record<string, number> = {}
  const activityMap: Record<string, string> = {}

  for (const u of (userCounts ?? [])) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    userMap[(u as any).center_id] = (userMap[(u as any).center_id] ?? 0) + 1
  }
  for (const p of (processCounts ?? [])) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    processMap[(p as any).center_id] = (processMap[(p as any).center_id] ?? 0) + 1
  }
  for (const a of (lastActivity ?? [])) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cid = (a as any).center_id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!activityMap[cid]) activityMap[cid] = (a as any).created_at
  }

  const enriched = (centers ?? []).map(c => ({
    ...c,
    user_count: userMap[c.id] ?? 0,
    process_count: processMap[c.id] ?? 0,
    last_activity: activityMap[c.id] ?? null,
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
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const { name, address, city, country, admin_name, admin_email } = parsed.data
  const supabase = createServiceClient()

  // 1. Create center
  const { data: center, error: centerError } = await supabase
    .from("centers")
    .insert({ name, address, city, country })
    .select()
    .single()

  if (centerError) return NextResponse.json({ error: centerError.message }, { status: 500 })

  const origin = request.headers.get("origin") ?? "https://classmixer-lovat.vercel.app"

  // 2. Invite admin user
  const { data: invited, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
    admin_email,
    {
      redirectTo: `${origin}/api/auth/callback?next=/set-password?invite=1`,
      data: { name: admin_name, center_id: center.id, role: "admin" },
    }
  )

  if (inviteError) {
    // Rollback center if invite fails
    await supabase.from("centers").delete().eq("id", center.id)
    return NextResponse.json({ error: `Centro creado pero error al invitar admin: ${inviteError.message}` }, { status: 500 })
  }

  // 3. Pre-create user profile
  const { error: profileError } = await supabase
    .from("users")
    .upsert({
      id: invited.user.id,
      email: admin_email,
      name: admin_name,
      role: "admin",
      center_id: center.id,
    }, { onConflict: "id" })

  if (profileError) {
    await supabase.auth.admin.deleteUser(invited.user.id)
    await supabase.from("centers").delete().eq("id", center.id)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({ ...center, admin_email }, { status: 201 })
}
