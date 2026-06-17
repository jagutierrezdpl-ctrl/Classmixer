import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, logAudit } from "@/lib/auth"
import { NextResponse } from "next/server"

const BUCKET = "center-logos"
const MAX_BYTES = 512 * 1024 // 512 KB

export async function POST(request: Request) {
  const profile = await getUserProfile()
  if (!profile || !["admin", "superadmin"].includes(profile.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const formData = await request.formData()
  const file = formData.get("logo") as File | null
  if (!file) return NextResponse.json({ error: "No se recibió ningún archivo" }, { status: 400 })

  const allowed = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"]
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: "Formato no permitido. Usa PNG, JPEG, WEBP o SVG." }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  if (bytes.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "El archivo supera el límite de 512 KB" }, { status: 400 })
  }

  const ext = file.type.split("/")[1].replace("jpeg", "jpg").replace("svg+xml", "svg")
  const path = `${profile.center_id}/logo.${ext}`

  const supabase = createServiceClient()

  // Remove any previous logo files for this center
  const { data: existing } = await supabase.storage.from(BUCKET).list(profile.center_id)
  if (existing && existing.length > 0) {
    await supabase.storage.from(BUCKET).remove(existing.map(f => `${profile.center_id}/${f.name}`))
  }

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: true })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)
  const logoUrl = urlData.publicUrl

  const { error: dbError } = await supabase
    .from("centers")
    .update({ logo_url: logoUrl })
    .eq("id", profile.center_id)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  await logAudit(profile.id, profile.center_id, "upload_center_logo", "center", {
    metadata: { path },
  })

  return NextResponse.json({ logo_url: logoUrl })
}

export async function DELETE() {
  const profile = await getUserProfile()
  if (!profile || !["admin", "superadmin"].includes(profile.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const supabase = createServiceClient()

  const { data: existing } = await supabase.storage.from(BUCKET).list(profile.center_id)
  if (existing && existing.length > 0) {
    await supabase.storage.from(BUCKET).remove(existing.map(f => `${profile.center_id}/${f.name}`))
  }

  await supabase.from("centers").update({ logo_url: null }).eq("id", profile.center_id)

  await logAudit(profile.id, profile.center_id, "delete_center_logo", "center", {})

  return NextResponse.json({ ok: true })
}
