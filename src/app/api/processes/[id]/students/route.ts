import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, logAudit } from "@/lib/auth"
import { NextResponse } from "next/server"
import { parseExcelImport, generateTemplateExcel } from "@/lib/excel/import"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from("students")
    .select("*")
    .eq("process_id", id)
    .eq("active", true)
    .order("last_name")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const url = new URL(request.url)
  const action = url.searchParams.get("action")

  // Download template
  if (action === "template") {
    const buffer = generateTemplateExcel()
    return new Response(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=plantilla_alumnos.xlsx",
      },
    })
  }

  // Preview import
  if (action === "preview") {
    const formData = await request.formData()
    const file = formData.get("file") as File
    if (!file) return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 })

    const buffer = await file.arrayBuffer()
    const preview = parseExcelImport(buffer)
    return NextResponse.json(preview)
  }

  // Confirm import
  if (action === "confirm") {
    const body = await request.json()
    const { rows } = body

    if (!rows || !Array.isArray(rows)) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const validRows = rows.filter((r: any) => r.status === "valid")

    const supabase = createServiceClient()

    // License check: max_students per center
    const { getCenterLicense } = await import("@/lib/license")
    const license = await getCenterLicense(supabase, profile.center_id)
    if (license.max_students !== null) {
      const { data: processIds } = await supabase
        .from("processes")
        .select("id")
        .eq("center_id", profile.center_id)
      const ids = (processIds ?? []).map((p: { id: string }) => p.id)
      let existingCount = 0
      if (ids.length > 0) {
        const { count } = await supabase
          .from("students")
          .select("id", { count: "exact", head: true })
          .in("process_id", ids)
          .eq("active", true)
        existingCount = count ?? 0
      }
      if (existingCount + validRows.length > license.max_students) {
        return NextResponse.json(
          {
            error: `Límite de alumnos alcanzado. Tu plan ${license.plan} permite hasta ${license.max_students} alumnos activos. Tienes ${existingCount} y estás añadiendo ${validRows.length}.`,
          },
          { status: 403 }
        )
      }
    }

    // Auto-match or create student_profiles for each row
    const profileIds: Record<string, string> = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const externalIds = validRows.map((r: any) => r.external_id).filter(Boolean)

    if (externalIds.length > 0) {
      // Fetch existing profiles for this center with matching external_ids
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existingProfiles } = await (supabase as any)
        .from("student_profiles")
        .select("id, external_id")
        .eq("center_id", profile.center_id)
        .in("external_id", externalIds)

      for (const p of (existingProfiles ?? [])) {
        profileIds[p.external_id] = p.id
      }

      // Update email on existing profiles if provided
      // Update email on existing profiles if provided
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const withEmail = (validRows as any[]).filter(r => r.external_id && r.email && profileIds[r.external_id])
      for (const r of withEmail) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("student_profiles")
          .update({ email: r.email as string })
          .eq("id", profileIds[r.external_id as string])
      }

      // Create profiles for students not found
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const toCreate = validRows.filter((r: any) => r.external_id && !profileIds[r.external_id])
      if (toCreate.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: created } = await (supabase as any)
          .from("student_profiles")
          .insert(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            toCreate.map((r: any) => ({
              center_id: profile.center_id,
              external_id: r.external_id,
              first_name: r.first_name,
              last_name: r.last_name,
              email: r.email ?? null,
              gender: r.gender ?? null,
              current_class: r.current_class ?? null,
              average_grade: r.average_grade ?? null,
              academic_level: r.academic_level ?? null,
              behavior_level: r.behavior_level ?? null,
              needs_type: r.needs_type ?? null,
              observations: r.observations ?? null,
            }))
          )
          .select("id, external_id")
        for (const p of (created ?? [])) {
          profileIds[p.external_id] = p.id
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const studentRows = validRows.map((r: any) => ({
      process_id: id,
      external_id: r.external_id,
      first_name: r.first_name,
      last_name: r.last_name,
      email: r.email ?? null,
      current_class: r.current_class,
      gender: r.gender,
      average_grade: r.average_grade,
      academic_level: r.academic_level ?? null,
      behavior_level: r.behavior_level ?? null,
      needs_type: r.needs_type ?? null,
      observations: r.observations ?? null,
      tutor: r.tutor ?? null,
      student_profile_id: (r.external_id && profileIds[r.external_id]) ? profileIds[r.external_id] : null,
    }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let { error } = await (supabase as any).from("students").insert(studentRows)
    if (error?.message?.includes("email")) {
      // Migration 018 not yet applied — retry without email
      const withoutEmail = studentRows.map(({ email: _e, ...rest }) => rest)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const retry = await (supabase as any).from("students").insert(withoutEmail)
      error = retry.error
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const profilesCreated = Object.keys(profileIds).length
    await logAudit(profile.id, profile.center_id, "import_students", "student", {
      processId: id,
      metadata: { count: validRows.length, profiles_created: profilesCreated },
    })

    return NextResponse.json({ imported: validRows.length, profiles_linked: profilesCreated })
  }

  return NextResponse.json({ error: "Acción no válida" }, { status: 400 })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!["admin", "superadmin"].includes(profile.role)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
  }

  const { id } = await params
  const { student_ids } = await request.json()
  if (!Array.isArray(student_ids) || student_ids.length === 0) {
    return NextResponse.json({ error: "Sin IDs" }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from("students")
    .update({ active: false })
    .in("id", student_ids)
    .eq("process_id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit(profile.id, profile.center_id, "delete_students", "student", {
    processId: id,
    metadata: { count: student_ids.length },
  })

  return NextResponse.json({ deleted: student_ids.length })
}
