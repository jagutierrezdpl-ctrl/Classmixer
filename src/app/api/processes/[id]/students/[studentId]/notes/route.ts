/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, logAudit } from "@/lib/auth"
import { NextResponse } from "next/server"

async function getProfileAndProcess(processId: string, studentId: string) {
  const profile = await getUserProfile()
  if (!profile) return { error: "No autorizado", status: 401 } as const
  if (!["admin", "superadmin", "orientador"].includes(profile.role)) {
    return { error: "Acceso restringido a admin/orientador", status: 403 } as const
  }

  const supabase = createServiceClient()
  const { data: process } = await supabase
    .from("processes")
    .select("center_id")
    .eq("id", processId)
    .single()
  if (!process || process.center_id !== profile.center_id) {
    return { error: "No encontrado", status: 404 } as const
  }

  const { data: student } = await supabase
    .from("students")
    .select("id")
    .eq("id", studentId)
    .eq("process_id", processId)
    .single()
  if (!student) return { error: "Alumno no encontrado", status: 404 } as const

  return { profile, supabase }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; studentId: string }> }
) {
  const { id, studentId } = await params
  const ctx = await getProfileAndProcess(id, studentId)
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const { supabase } = ctx
  const { data: notes } = await (supabase as any)
    .from("intervention_notes")
    .select("id, content, created_by_name, created_at")
    .eq("process_id", id)
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })

  return NextResponse.json(notes ?? [])
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; studentId: string }> }
) {
  const { id, studentId } = await params
  const ctx = await getProfileAndProcess(id, studentId)
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const { profile, supabase } = ctx
  const body = await req.json().catch(() => ({}))
  const content = typeof body.content === "string" ? body.content.trim() : ""
  if (!content) return NextResponse.json({ error: "El contenido no puede estar vacío" }, { status: 400 })
  if (content.length > 2000) return NextResponse.json({ error: "Máximo 2000 caracteres" }, { status: 400 })

  const { data: note, error } = await (supabase as any)
    .from("intervention_notes")
    .insert({
      process_id: id,
      student_id: studentId,
      content,
      created_by: profile.id,
      created_by_name: profile.name ?? profile.email,
    })
    .select("id, content, created_by_name, created_at")
    .single()

  if (error || !note) {
    return NextResponse.json({ error: "Error al guardar la nota" }, { status: 500 })
  }

  await logAudit(profile.id, profile.center_id, "add_intervention_note", "student", {
    processId: id,
    entityId: studentId,
  })

  return NextResponse.json(note, { status: 201 })
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; studentId: string }> }
) {
  const { id, studentId } = await params
  const ctx = await getProfileAndProcess(id, studentId)
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const { supabase } = ctx
  const url = new URL(req.url)
  const noteId = url.searchParams.get("noteId")
  if (!noteId) return NextResponse.json({ error: "noteId requerido" }, { status: 400 })

  await (supabase as any)
    .from("intervention_notes")
    .delete()
    .eq("id", noteId)
    .eq("process_id", id)
    .eq("student_id", studentId)

  return NextResponse.json({ ok: true })
}
