import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, logAudit } from "@/lib/auth"
import { NextResponse } from "next/server"
import { z } from "zod"

const UpdateSchema = z.object({
  role: z.enum(["admin", "tutor", "orientador"]).optional(),
  name: z.string().min(1).optional(),
  active: z.boolean().optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getUserProfile()
  if (!profile || !["admin", "superadmin"].includes(profile.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Ensure target user belongs to same center
  const { data: target } = await supabase
    .from("users")
    .select("center_id, role")
    .eq("id", id)
    .single()

  if (!target || target.center_id !== profile.center_id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  // Cannot change superadmin role
  if (target.role === "superadmin" && profile.role !== "superadmin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { error } = await supabase
    .from("users")
    .update(parsed.data)
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit(profile.id, profile.center_id, "update_user", "user", {
    entityId: id,
    metadata: parsed.data,
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getUserProfile()
  if (!profile || !["admin", "superadmin"].includes(profile.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { id } = await params

  // Cannot delete yourself
  if (id === profile.id) {
    return NextResponse.json({ error: "No puedes eliminarte a ti mismo" }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: target } = await supabase
    .from("users")
    .select("center_id, role")
    .eq("id", id)
    .single()

  if (!target || target.center_id !== profile.center_id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  if (target.role === "superadmin") {
    return NextResponse.json({ error: "No puedes eliminar un superadmin" }, { status: 403 })
  }

  const { error } = await supabase.from("users").delete().eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit(profile.id, profile.center_id, "delete_user", "user", { entityId: id })

  return NextResponse.json({ ok: true })
}
