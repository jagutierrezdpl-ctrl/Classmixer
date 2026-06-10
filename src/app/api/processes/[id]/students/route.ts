import { createClient } from "@/lib/supabase/server"
import { getUserProfile, logAudit } from "@/lib/auth"
import { NextResponse } from "next/server"
import { parseExcelImport, generateTemplateExcel } from "@/lib/excel/import"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const supabase = await createClient()

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

    const supabase = await createClient()
    const { error } = await supabase.from("students").insert(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      validRows.map((r: any) => ({
        process_id: id,
        external_id: r.external_id,
        first_name: r.first_name,
        last_name: r.last_name,
        current_class: r.current_class,
        gender: r.gender,
        average_grade: r.average_grade,
        academic_level: r.academic_level ?? null,
        behavior_level: r.behavior_level ?? null,
        needs_type: r.needs_type ?? null,
        observations: r.observations ?? null,
        tutor: r.tutor ?? null,
      }))
    )

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logAudit(profile.id, profile.center_id, "import_students", "student", {
      processId: id,
      metadata: { count: validRows.length },
    })

    return NextResponse.json({ imported: validRows.length })
  }

  return NextResponse.json({ error: "Acción no válida" }, { status: 400 })
}
