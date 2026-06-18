/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, logAudit } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: processId } = await params
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!["admin", "superadmin", "orientador"].includes(profile.role)) {
    return NextResponse.json({ error: "Acceso restringido" }, { status: 403 })
  }

  const supabase = createServiceClient()

  const { data: process } = await supabase
    .from("processes")
    .select("center_id")
    .eq("id", processId)
    .single()
  if (!process || process.center_id !== profile.center_id) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  }

  const { data, error } = await (supabase as any)
    .from("sociogram_annotations")
    .select("*, author:users(id, name)")
    .eq("process_id", processId)
    .order("updated_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: processId } = await params
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!["admin", "superadmin", "orientador"].includes(profile.role)) {
    return NextResponse.json({ error: "Acceso restringido" }, { status: 403 })
  }

  const supabase = createServiceClient()

  const { data: process } = await supabase
    .from("processes")
    .select("center_id")
    .eq("id", processId)
    .single()
  if (!process || process.center_id !== profile.center_id) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  }

  const body = await req.json()
  const { student_id, note, status } = body

  if (!student_id) return NextResponse.json({ error: "student_id requerido" }, { status: 400 })

  const VALID_STATUSES = ["sin_accion", "revisado", "en_seguimiento", "intervencion_activa"]
  const safeStatus = VALID_STATUSES.includes(status) ? status : "sin_accion"

  // Upsert — one annotation per (process, student)
  const { data, error } = await (supabase as any)
    .from("sociogram_annotations")
    .upsert(
      {
        process_id: processId,
        student_id,
        author_id: profile.id,
        note: note ?? "",
        status: safeStatus,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "process_id,student_id" }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit(profile.id, profile.center_id, "upsert_sociogram_annotation", "student", {
    processId,
    entityId: student_id,
  })

  return NextResponse.json(data)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: processId } = await params
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!["admin", "superadmin", "orientador"].includes(profile.role)) {
    return NextResponse.json({ error: "Acceso restringido" }, { status: 403 })
  }

  const supabase = createServiceClient()
  const { searchParams } = new URL(req.url)
  const studentId = searchParams.get("student_id")
  if (!studentId) return NextResponse.json({ error: "student_id requerido" }, { status: 400 })

  await (supabase as any)
    .from("sociogram_annotations")
    .delete()
    .eq("process_id", processId)
    .eq("student_id", studentId)

  return NextResponse.json({ ok: true })
}
