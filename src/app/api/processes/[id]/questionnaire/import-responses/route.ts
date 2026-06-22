import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, logAudit } from "@/lib/auth"
import { NextResponse } from "next/server"
import {
  buildStudentLookup,
  mapSourceToTarget,
  remapResponses,
  persistImport,
} from "@/lib/services/response-import"

/** GET — returns processes of the same center that have responses */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  // Verify target process belongs to center
  const { data: target } = await supabase
    .from("processes")
    .select("id, name, center_id")
    .eq("id", id)
    .eq("center_id", profile.center_id)
    .single()
  if (!target) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  // All other processes of the center that have at least one response
  const { data: allProcesses } = await supabase
    .from("processes")
    .select("id, name, school_year, source_level, status")
    .eq("center_id", profile.center_id)
    .neq("id", id)
    .order("created_at", { ascending: false })

  if (!allProcesses?.length) return NextResponse.json([])

  // Filter to only those with responses
  const pIds = allProcesses.map(p => p.id)
  const { data: responseCounts } = await supabase
    .from("responses")
    .select("process_id")
    .in("process_id", pIds)

  const withResponses = new Set((responseCounts ?? []).map(r => r.process_id))
  const sources = allProcesses.filter(p => withResponses.has(p.id))

  return NextResponse.json(sources)
}

/** POST — preview or confirm import */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!["admin", "superadmin"].includes(profile.role)) {
    return NextResponse.json({ error: "Solo administradores pueden importar respuestas" }, { status: 403 })
  }

  const { id: targetProcessId } = await params
  const url = new URL(request.url)
  const action = url.searchParams.get("action") ?? "preview"
  const { sourceProcessId } = await request.json()

  if (!sourceProcessId) return NextResponse.json({ error: "Falta sourceProcessId" }, { status: 400 })

  const supabase = createServiceClient()

  // Verify both processes belong to center
  const [{ data: targetProc }, { data: sourceProc }] = await Promise.all([
    supabase.from("processes").select("id, center_id").eq("id", targetProcessId).eq("center_id", profile.center_id).single(),
    supabase.from("processes").select("id, center_id, name").eq("id", sourceProcessId).eq("center_id", profile.center_id).single(),
  ])
  if (!targetProc || !sourceProc) return NextResponse.json({ error: "Proceso no encontrado" }, { status: 404 })

  // Load students of both processes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [{ data: targetStudentsRaw }, { data: sourceStudentsRaw }] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("students").select("id, first_name, last_name, external_id, student_profile_id").eq("process_id", targetProcessId).eq("active", true),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("students").select("id, first_name, last_name, external_id, student_profile_id").eq("process_id", sourceProcessId).eq("active", true),
  ])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const targetStudents = targetStudentsRaw as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sourceStudents = sourceStudentsRaw as any[]

  if (!targetStudents?.length) return NextResponse.json({ error: "El proceso destino no tiene alumnos" }, { status: 400 })

  // Build lookup and map students
  const lookup = buildStudentLookup(targetStudents)
  const sourceToTarget = mapSourceToTarget(sourceStudents ?? [], lookup)
  const matchedStudents = sourceToTarget.size
  const unmatchedStudents = (sourceStudents?.length ?? 0) - matchedStudents

  // Load source responses and remap to target IDs
  const { data: sourceResponses } = await supabase
    .from("responses")
    .select("respondent_student_id, target_student_id, relation_type, weight")
    .eq("process_id", sourceProcessId)

  const mapped = remapResponses(sourceResponses ?? [], sourceToTarget, targetProcessId)

  if (action === "preview") {
    const matchedNames = [...sourceToTarget.keys()].slice(0, 5).map(srcId => {
      const s = (sourceStudents ?? []).find((st: { id: string }) => st.id === srcId)
      return s ? `${s.first_name} ${s.last_name}` : srcId
    })

    return NextResponse.json({
      source_name: sourceProc.name,
      total_source_students: sourceStudents?.length ?? 0,
      matched_students: matchedStudents,
      unmatched_students: unmatchedStudents,
      total_responses: sourceResponses?.length ?? 0,
      importable_responses: mapped.length,
      sample_matched: matchedNames,
    })
  }

  // action === "confirm"
  if (mapped.length === 0) {
    return NextResponse.json({ error: "No hay respuestas importables (sin coincidencias de alumnos)" }, { status: 400 })
  }

  const inserted = await persistImport(supabase, targetProcessId, mapped)

  await logAudit(profile.id, profile.center_id, "import_responses_from_process", "process", {
    processId: targetProcessId,
    metadata: { sourceProcessId, inserted, matched: matchedStudents },
  })

  return NextResponse.json({ imported: inserted, matched_students: matchedStudents })
}
