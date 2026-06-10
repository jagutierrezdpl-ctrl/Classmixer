import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { PLAN_LIMITS, getCenterLicense } from "@/lib/license"
import { NextResponse } from "next/server"
import { z } from "zod"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ centerId: string }> }
) {
  const profile = await getUserProfile()
  if (!profile || profile.role !== "superadmin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  const { centerId } = await params
  const supabase = createServiceClient()
  const license = await getCenterLicense(supabase, centerId)
  return NextResponse.json(license)
}

const UpdateSchema = z.object({
  plan: z.enum(["free", "basic", "pro", "enterprise"]),
  valid_until: z.string().nullable().optional(),
  // Override limits (optional, null = use plan defaults)
  max_processes: z.number().nullable().optional(),
  max_students: z.number().nullable().optional(),
  max_users: z.number().nullable().optional(),
})

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ centerId: string }> }
) {
  const profile = await getUserProfile()
  if (!profile || profile.role !== "superadmin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { centerId } = await params
  const body = await request.json()
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const planDefaults = PLAN_LIMITS[parsed.data.plan]
  const supabase = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("licenses")
    .upsert({
      center_id: centerId,
      plan: parsed.data.plan,
      max_processes: parsed.data.max_processes ?? planDefaults.max_processes,
      max_students: parsed.data.max_students ?? planDefaults.max_students,
      max_users: parsed.data.max_users ?? planDefaults.max_users,
      valid_until: parsed.data.valid_until ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "center_id" })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
