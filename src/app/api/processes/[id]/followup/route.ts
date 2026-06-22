/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, hasFullAccess, logAudit } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"

// POST /api/processes/[id]/followup — create a follow-up process linked to this one
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: parentId } = await params
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!hasFullAccess(profile.role)) return NextResponse.json({ error: "Solo administradores" }, { status: 403 })

  const supabase = createServiceClient()

  const { data: parent } = await supabase
    .from("processes")
    .select("*")
    .eq("id", parentId)
    .eq("center_id", profile.center_id)
    .single()

  if (!parent) return NextResponse.json({ error: "Proceso no encontrado" }, { status: 404 })

  if (!["propuesta_seleccionada", "cerrado", "archivado"].includes(parent.status)) {
    return NextResponse.json({ error: "El proceso debe tener una propuesta aprobada" }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const targetYear = body.school_year ?? (parent.school_year
    ? String(Number(parent.school_year.split("/")[0]) + 1) + "/" + String(Number(parent.school_year.split("/")[1]) + 1)
    : parent.school_year)

  const { data: followup, error } = await (supabase as any)
    .from("processes")
    .insert({
      center_id: profile.center_id,
      name: body.name ?? `Seguimiento — ${parent.name}`,
      school_year: targetYear,
      source_level: parent.target_level ?? parent.source_level,
      target_level: parent.target_level ?? parent.source_level,
      source_groups: parent.target_groups ?? parent.source_groups,
      target_groups: parent.target_groups ?? parent.source_groups,
      status: "borrador",
      created_by: profile.id,
      parent_process_id: parentId,
      process_type: "followup",
    })
    .select()
    .single()

  if (error || !followup) {
    return NextResponse.json({ error: error?.message ?? "Error al crear el proceso" }, { status: 500 })
  }

  // ── Auto-copy students from the parent's approved proposal ──────────────────
  // Find the approved proposal for the parent process, then copy its assigned
  // students into the new followup process. The destination class in the
  // proposal (target_class) becomes the starting class (current_class) for the
  // followup, reflecting the real classroom situation after the mix.
  const { data: approvedProposal } = await (supabase as any)
    .from("proposals")
    .select("id")
    .eq("process_id", parentId)
    .eq("status", "aprobada")
    .single()

  if (approvedProposal) {
    // Fetch assignments joined with the full student record
    const { data: assignments } = await (supabase as any)
      .from("proposal_assignments")
      .select(`
        target_class,
        students (
          external_id,
          first_name,
          last_name,
          gender,
          average_grade,
          academic_level,
          behavior_level,
          needs_type,
          observations,
          student_profile_id
        )
      `)
      .eq("proposal_id", approvedProposal.id)

    if (assignments && assignments.length > 0) {
      const studentsToInsert = assignments
        .filter((a: any) => a.students)
        .map((a: any) => ({
          process_id: followup.id,
          external_id: a.students.external_id,
          first_name: a.students.first_name,
          last_name: a.students.last_name,
          // The mixed destination class becomes the new starting class
          current_class: a.target_class,
          gender: a.students.gender,
          average_grade: a.students.average_grade,
          academic_level: a.students.academic_level,
          behavior_level: a.students.behavior_level,
          needs_type: a.students.needs_type,
          observations: a.students.observations,
          active: true,
          ...(a.students.student_profile_id
            ? { student_profile_id: a.students.student_profile_id }
            : {}),
        }))

      if (studentsToInsert.length > 0) {
        await (supabase as any).from("students").insert(studentsToInsert)
      }
    }
  }
  // ── End auto-copy ───────────────────────────────────────────────────────────

  await logAudit(profile.id, profile.center_id, "create_followup_process", "process", {
    processId: followup.id,
    entityId: followup.id,
  })

  return NextResponse.json({ id: followup.id, name: followup.name })
}
