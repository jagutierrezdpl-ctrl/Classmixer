import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, logAudit } from "@/lib/auth"
import { NextResponse } from "next/server"
import { exportProposalToExcel } from "@/lib/excel/export"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: proposalRaw, error } = await (supabase as any)
    .from("proposals")
    .select("*, processes!inner(center_id), proposal_assignments(*, students(*)), proposal_metrics(*)")
    .eq("id", id)
    .single()

  if (error || !proposalRaw) return NextResponse.json({ error: "No encontrada" }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((proposalRaw as any).processes?.center_id !== profile.center_id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proposal = proposalRaw as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const students = (proposal.proposal_assignments ?? []).map((a: any) => a.students).filter(Boolean)

  const [{ data: rules }, { data: responses }] = await Promise.all([
    supabase.from("rules").select("*, rule_students(student_id, students(first_name, last_name))").eq("process_id", proposal.process_id).eq("active", true),
    supabase.from("responses").select("*").eq("process_id", proposal.process_id),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rulesWithStudents = ((rules ?? []) as any[]).map((r: any) => ({
    ...r,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    students: (r.rule_students ?? []).map((rs: any) => ({
      student_id: rs.student_id,
      student: rs.students ?? undefined,
    })),
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = exportProposalToExcel(proposal, students, rulesWithStudents, (responses ?? []) as any, proposal.proposal_metrics ?? [])

  await logAudit(profile.id, profile.center_id, "export_proposal_excel", "proposal", {
    processId: proposal.process_id,
    entityId: id,
  })

  return new Response(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${proposal.name.replace(/\s+/g, "_")}.xlsx"`,
    },
  })
}
